import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();
const MODALITIES = ['Presencial', 'Virtual', 'Hibrida'];
const LEVELS = ['I', 'L', 'U', 'O'];
const ENROLLMENT_STATUSES = ['Asignado', 'En progreso', 'Completado', 'Cancelado'];

const isPositiveInteger = (value) =>
  (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

const toISODate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  return value;
};

const isValidDate = (value) => {
  if (value == null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validCompetencies = (items) => {
  if (items === undefined) return { ok: true, items: null };
  if (!Array.isArray(items)) return { ok: false, message: 'competencies debe ser una lista.' };
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    const competencyId = Number(item?.competency_id);
    if (!isPositiveInteger(item?.competency_id)) return { ok: false, message: 'Cada competencia debe tener un competency_id válido.' };
    const level = item?.target_iluo_level ?? 'U';
    const notes = item?.notes == null ? null : String(item.notes).trim();
    if (!Number.isSafeInteger(competencyId) || competencyId < 1) {
      return { ok: false, message: 'Cada competencia debe tener un competency_id válido.' };
    }
    if (!LEVELS.includes(level)) return { ok: false, message: 'El nivel objetivo debe ser I, L, U u O.' };
    if (notes && notes.length > 255) return { ok: false, message: 'Las notas de competencia no pueden superar 255 caracteres.' };
    if (!seen.has(competencyId)) {
      seen.add(competencyId);
      normalized.push({ competency_id: competencyId, target_iluo_level: level, notes });
    }
  }
  return { ok: true, items: normalized };
};

const validateCourse = (body) => {
  const errors = [];
  const course_code = typeof body?.course_code === 'string' ? body.course_code.trim() : '';
  const course_name = typeof body?.course_name === 'string' ? body.course_name.trim() : '';
  const description = body?.description == null ? null : String(body.description).trim();
  const modality = body?.modality;
  const duration_hours = Number(body?.duration_hours);
  if (!course_code || course_code.length > 20) errors.push('course_code es obligatorio y no puede superar 20 caracteres.');
  if (!course_name || course_name.length > 150) errors.push('course_name es obligatorio y no puede superar 150 caracteres.');
  if (description && description.length > 500) errors.push('description no puede superar 500 caracteres.');
  if (!MODALITIES.includes(modality)) errors.push('modality debe ser Presencial, Virtual o Hibrida.');
  if (!Number.isFinite(duration_hours) || duration_hours <= 0 || duration_hours > 999.99) errors.push('duration_hours debe ser mayor que 0 y no superar 999.99.');
  const competencyValidation = validCompetencies(body?.competencies);
  if (!competencyValidation.ok) errors.push(competencyValidation.message);
  return {
    errors,
    data: { course_code, course_name, description, modality, duration_hours, competencies: competencyValidation.items }
  };
};

const saveCourseCompetencies = async (connection, courseId, competencies) => {
  if (competencies === null) return;
  await connection.execute('DELETE FROM course_competencies WHERE course_id = ?', [courseId]);
  for (const item of competencies) {
    await connection.execute(
      `INSERT INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
       VALUES (?, ?, ?, ?)`,
      [courseId, item.competency_id, item.target_iluo_level, item.notes]
    );
  }
};

// -----------------------------------------------------------------------------
// Catálogo de competencias activas para relacionarlas con los cursos.
// GET /api/training/competencies
// -----------------------------------------------------------------------------
router.get('/competencies', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.competency_id, c.competency_code, c.competency_name,
              wa.work_area_id, wa.area_name,
              d.department_id, d.department_name
       FROM competencies c
       INNER JOIN work_areas wa ON wa.work_area_id = c.work_area_id
       INNER JOIN departments d ON d.department_id = wa.department_id
       WHERE c.active = 1 AND wa.active = 1 AND d.active = 1
       ORDER BY d.department_name, wa.area_name, c.sort_order, c.competency_name`
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { next(error); }
});

// -----------------------------------------------------------------------------
// Cursos: consulta, alta, edición y baja lógica.
// -----------------------------------------------------------------------------
router.get('/courses', async (req, res, next) => {
  try {
    const { q = '', active = '1' } = req.query;
    const conditions = [];
    const params = [];
    if (active !== 'Todos') {
      if (!['0', '1'].includes(String(active))) {
        return res.status(400).json({ success: false, message: 'active debe ser 1, 0 o Todos.' });
      }
      conditions.push('c.active = ?');
      params.push(Number(active));
    }
    if (String(q).trim()) {
      conditions.push('(c.course_code LIKE ? OR c.course_name LIKE ? OR c.description LIKE ?)');
      const term = `%${String(q).trim()}%`;
      params.push(term, term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT c.course_id, c.course_code, c.course_name, c.description,
              c.modality, c.duration_hours, c.active, c.created_at,
              COUNT(DISTINCT cc.competency_id) AS competency_count,
              GROUP_CONCAT(DISTINCT CONCAT(cp.competency_name, ' — ', wa.area_name)
                           ORDER BY cp.competency_name SEPARATOR ' | ') AS competency_names
       FROM courses c
       LEFT JOIN course_competencies cc ON cc.course_id = c.course_id
       LEFT JOIN competencies cp ON cp.competency_id = cc.competency_id
       LEFT JOIN work_areas wa ON wa.work_area_id = cp.work_area_id
       ${where}
       GROUP BY c.course_id
       ORDER BY c.active DESC, c.course_name`,
      params
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!isPositiveInteger(courseId)) return res.status(400).json({ success: false, message: 'El ID del curso no es válido.' });
    const [courses] = await pool.execute('SELECT * FROM courses WHERE course_id = ?', [courseId]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'No se encontró el curso.' });
    const [competencies] = await pool.execute(
      `SELECT cc.competency_id, cc.target_iluo_level, cc.notes,
              c.competency_code, c.competency_name,
              wa.area_name, d.department_name
       FROM course_competencies cc
       INNER JOIN competencies c ON c.competency_id = cc.competency_id
       INNER JOIN work_areas wa ON wa.work_area_id = c.work_area_id
       INNER JOIN departments d ON d.department_id = wa.department_id
       WHERE cc.course_id = ?
       ORDER BY d.department_name, wa.area_name, c.competency_name`,
      [courseId]
    );
    res.json({ success: true, data: { ...courses[0], competencies } });
  } catch (error) { next(error); }
});

router.post('/courses', async (req, res, next) => {
  const validation = validateCourse(req.body);
  if (validation.errors.length) return res.status(400).json({ success: false, message: 'Revisa los datos del curso.', errors: validation.errors });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const { course_code, course_name, description, modality, duration_hours, competencies } = validation.data;
    const [result] = await connection.execute(
      `INSERT INTO courses (course_code, course_name, description, modality, duration_hours)
       VALUES (?, ?, ?, ?, ?)`,
      [course_code, course_name, description, modality, duration_hours]
    );
    await saveCourseCompetencies(connection, result.insertId, competencies);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Curso registrado correctamente.', data: { course_id: result.insertId } });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'El código del curso ya existe.' });
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'Una de las competencias seleccionadas no existe.' });
    next(error);
  } finally { connection?.release(); }
});

router.put('/courses/:courseId', async (req, res, next) => {
  const courseId = Number(req.params.courseId);
  if (!isPositiveInteger(courseId)) return res.status(400).json({ success: false, message: 'El ID del curso no es válido.' });
  const validation = validateCourse(req.body);
  if (validation.errors.length) return res.status(400).json({ success: false, message: 'Revisa los datos del curso.', errors: validation.errors });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT course_id FROM courses WHERE course_id = ? FOR UPDATE', [courseId]);
    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'No se encontró el curso.' });
    }
    const { course_code, course_name, description, modality, duration_hours, competencies } = validation.data;
    await connection.execute(
      `UPDATE courses
       SET course_code = ?, course_name = ?, description = ?, modality = ?, duration_hours = ?
       WHERE course_id = ?`,
      [course_code, course_name, description, modality, duration_hours, courseId]
    );
    await saveCourseCompetencies(connection, courseId, competencies);
    await connection.commit();
    res.json({ success: true, message: 'Curso actualizado correctamente.' });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'El código del curso ya existe.' });
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'Una de las competencias seleccionadas no existe.' });
    next(error);
  } finally { connection?.release(); }
});

router.patch('/courses/:courseId/status', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const active = req.body?.active;
    if (!isPositiveInteger(courseId) || ![true, false, 0, 1].includes(active)) {
      return res.status(400).json({ success: false, message: 'Indica un courseId válido y active como true o false.' });
    }
    const [exists] = await pool.execute('SELECT course_id FROM courses WHERE course_id = ?', [courseId]);
    if (!exists.length) return res.status(404).json({ success: false, message: 'No se encontró el curso.' });
    await pool.execute('UPDATE courses SET active = ? WHERE course_id = ?', [Number(Boolean(active)), courseId]);
    res.json({ success: true, message: active ? 'Curso activado.' : 'Curso desactivado.' });
  } catch (error) { next(error); }
});

// -----------------------------------------------------------------------------
// Resumen de capacitación, con filtro opcional por departamento.
// -----------------------------------------------------------------------------
router.get('/summary', async (req, res, next) => {
  try {
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    if (departmentId !== null && !isPositiveInteger(departmentId)) {
      return res.status(400).json({ success: false, message: 'department_id no es válido.' });
    }
    const [rows] = await pool.execute(
      `SELECT COUNT(en.enrollment_id) AS total_enrollments,
              SUM(en.enrollment_status = 'Asignado') AS assigned_count,
              SUM(en.enrollment_status = 'En progreso') AS in_progress_count,
              SUM(en.enrollment_status = 'Completado') AS completed_count,
              SUM(en.enrollment_status = 'Cancelado') AS cancelled_count,
              SUM(en.due_date < CURDATE() AND en.enrollment_status IN ('Asignado', 'En progreso')) AS overdue_count,
              COUNT(DISTINCT en.course_id) AS courses_with_enrollments
       FROM enrollments en
       INNER JOIN employees e ON e.employee_id = en.employee_id
       WHERE (? IS NULL OR e.department_id = ?)`,
      [departmentId, departmentId]
    );
    const [courseRows] = await pool.execute('SELECT COUNT(*) AS active_courses FROM courses WHERE active = 1');
    res.json({ success: true, data: { ...rows[0], active_courses: courseRows[0].active_courses } });
  } catch (error) { next(error); }
});

// -----------------------------------------------------------------------------
// Listado y asignación de cursos.
// -----------------------------------------------------------------------------
router.get('/enrollments', async (req, res, next) => {
  try {
    const { q = '', department_id, course_id, status } = req.query;
    const conditions = [];
    const params = [];
    if (department_id) {
      if (!isPositiveInteger(department_id)) return res.status(400).json({ success: false, message: 'department_id no es válido.' });
      conditions.push('e.department_id = ?'); params.push(Number(department_id));
    }
    if (course_id) {
      if (!isPositiveInteger(course_id)) return res.status(400).json({ success: false, message: 'course_id no es válido.' });
      conditions.push('c.course_id = ?'); params.push(Number(course_id));
    }
    if (status && status !== 'Todos') {
      if (!ENROLLMENT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'El estatus de asignación no es válido.' });
      conditions.push('en.enrollment_status = ?'); params.push(status);
    }
    if (String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      conditions.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR c.course_name LIKE ? OR c.course_code LIKE ?)');
      params.push(term, term, term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT en.enrollment_id, en.employee_id, en.course_id,
              en.assigned_date, en.due_date, en.completion_date,
              en.enrollment_status, en.score, en.notes, en.created_at, en.updated_at,
              e.employee_code, e.full_name, e.job_title, e.employment_status,
              e.department_id, d.department_name, wa.area_name,
              c.course_code, c.course_name, c.modality, c.duration_hours,
              (en.due_date < CURDATE() AND en.enrollment_status IN ('Asignado', 'En progreso')) AS is_overdue
       FROM enrollments en
       INNER JOIN employees e ON e.employee_id = en.employee_id
       INNER JOIN departments d ON d.department_id = e.department_id
       INNER JOIN work_areas wa ON wa.work_area_id = e.work_area_id
       INNER JOIN courses c ON c.course_id = en.course_id
       ${where}
       ORDER BY en.assigned_date DESC, en.enrollment_id DESC`,
      params
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { next(error); }
});

router.post('/enrollments', async (req, res, next) => {
  const rawEmployeeIds = Array.isArray(req.body?.employee_ids)
    ? req.body.employee_ids
    : (req.body?.employee_id !== undefined ? [req.body.employee_id] : []);
  const employeeIdsValid = rawEmployeeIds.length > 0 && rawEmployeeIds.every(isPositiveInteger);
  const employeeIds = [...new Set(rawEmployeeIds.filter(isPositiveInteger).map(Number))];
  const rawCourseId = req.body?.course_id;
  const courseId = Number(rawCourseId);
  const assignedDate = req.body?.assigned_date;
  const dueDate = req.body?.due_date || null;
  const notes = req.body?.notes == null ? null : String(req.body.notes).trim();
  const errors = [];
  if (!employeeIdsValid || !employeeIds.length) errors.push('Selecciona al menos un colaborador válido.');
  if (!isPositiveInteger(rawCourseId)) errors.push('Selecciona un curso válido.');
  if (!isValidDate(assignedDate) || !assignedDate) errors.push('assigned_date debe tener formato YYYY-MM-DD y ser válida.');
  if (!isValidDate(dueDate)) errors.push('due_date debe ser una fecha válida con formato YYYY-MM-DD.');
  if (dueDate && assignedDate && dueDate < assignedDate) errors.push('La fecha límite no puede ser anterior a la fecha de asignación.');
  if (notes && notes.length > 500) errors.push('notes no puede superar 500 caracteres.');
  if (errors.length) return res.status(400).json({ success: false, message: 'Revisa los datos de asignación.', errors });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [courseRows] = await connection.execute('SELECT course_id FROM courses WHERE course_id = ? AND active = 1 FOR UPDATE', [courseId]);
    if (!courseRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El curso no existe o está desactivado.' });
    }
    const placeholders = employeeIds.map(() => '?').join(',');
    const [employees] = await connection.execute(
      `SELECT employee_id FROM employees WHERE employment_status = 'Activo' AND employee_id IN (${placeholders})`,
      employeeIds
    );
    if (employees.length !== employeeIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Todos los colaboradores deben existir y estar activos.' });
    }
    const [duplicates] = await connection.execute(
      `SELECT employee_id FROM enrollments
       WHERE course_id = ? AND enrollment_status IN ('Asignado', 'En progreso')
         AND employee_id IN (${placeholders})`,
      [courseId, ...employeeIds]
    );
    if (duplicates.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Uno o más colaboradores ya tienen este curso asignado o en progreso.', duplicate_employee_ids: duplicates.map((row) => row.employee_id) });
    }
    for (const employeeId of employeeIds) {
      await connection.execute(
        `INSERT INTO enrollments (employee_id, course_id, assigned_date, due_date, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [employeeId, courseId, assignedDate, dueDate, notes]
      );
    }
    await connection.commit();
    res.status(201).json({ success: true, message: `Curso asignado a ${employeeIds.length} colaborador(es).`, total_created: employeeIds.length });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'El colaborador o curso seleccionado no existe.' });
    next(error);
  } finally { connection?.release(); }
});

router.patch('/enrollments/:enrollmentId', async (req, res, next) => {
  try {
    const enrollmentId = Number(req.params.enrollmentId);
    if (!isPositiveInteger(enrollmentId)) return res.status(400).json({ success: false, message: 'El ID de asignación no es válido.' });
    const [currentRows] = await pool.execute('SELECT * FROM enrollments WHERE enrollment_id = ?', [enrollmentId]);
    if (!currentRows.length) return res.status(404).json({ success: false, message: 'No se encontró la asignación.' });
    const current = currentRows[0];
    const status = req.body?.enrollment_status ?? current.enrollment_status;
    const dueDate = req.body?.due_date === undefined ? toISODate(current.due_date) : (req.body.due_date || null);
    let completionDate = req.body?.completion_date === undefined ? toISODate(current.completion_date) : (req.body.completion_date || null);
    const score = req.body?.score === undefined ? current.score : (req.body.score === '' || req.body.score == null ? null : Number(req.body.score));
    const notes = req.body?.notes === undefined ? current.notes : (req.body.notes == null ? null : String(req.body.notes).trim());
    if (!ENROLLMENT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'enrollment_status no es válido.' });
    if (!isValidDate(dueDate) || !isValidDate(completionDate)) return res.status(400).json({ success: false, message: 'Las fechas deben tener formato YYYY-MM-DD.' });
    if (dueDate && dueDate < toISODate(current.assigned_date)) return res.status(400).json({ success: false, message: 'La fecha límite no puede ser anterior a la asignación.' });
    if (status === 'Completado' && !completionDate) {
      const [dateRows] = await pool.execute('SELECT CURDATE() AS today');
      completionDate = toISODate(dateRows[0].today);
    }
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) return res.status(400).json({ success: false, message: 'La calificación debe estar entre 0 y 100.' });
    if (notes && notes.length > 500) return res.status(400).json({ success: false, message: 'Las observaciones no pueden superar 500 caracteres.' });
    await pool.execute(
      `UPDATE enrollments
       SET enrollment_status = ?, due_date = ?, completion_date = ?, score = ?, notes = ?
       WHERE enrollment_id = ?`,
      [status, dueDate, completionDate, score, notes, enrollmentId]
    );
    res.json({ success: true, message: 'Seguimiento de capacitación actualizado.' });
  } catch (error) { next(error); }
});

// -----------------------------------------------------------------------------
// Recomendaciones: cursos vinculados a competencias actualmente en I o L.
// Se omiten cursos que el colaborador ya tenga asignados o en progreso.
// -----------------------------------------------------------------------------
router.get('/recommendations', async (req, res, next) => {
  try {
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    if (departmentId !== null && !isPositiveInteger(departmentId)) return res.status(400).json({ success: false, message: 'department_id no es válido.' });
    const [rows] = await pool.execute(
      `SELECT e.employee_id, e.employee_code, e.full_name,
              d.department_id, d.department_name, wa.area_name,
              cp.competency_id, cp.competency_code, cp.competency_name,
              ec.iluo_level AS current_iluo_level,
              c.course_id, c.course_code, c.course_name, c.modality, c.duration_hours,
              cc.target_iluo_level
       FROM employees e
       INNER JOIN departments d ON d.department_id = e.department_id
       INNER JOIN work_areas wa ON wa.work_area_id = e.work_area_id
       INNER JOIN employee_competencies ec ON ec.employee_id = e.employee_id
       INNER JOIN competencies cp ON cp.competency_id = ec.competency_id
       INNER JOIN course_competencies cc ON cc.competency_id = cp.competency_id
       INNER JOIN courses c ON c.course_id = cc.course_id AND c.active = 1
       WHERE e.employment_status = 'Activo'
         AND cp.active = 1
         AND ec.iluo_level IN ('I', 'L')
         AND (? IS NULL OR e.department_id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM enrollments en
           WHERE en.employee_id = e.employee_id
             AND en.course_id = c.course_id
             AND en.enrollment_status IN ('Asignado', 'En progreso')
         )
       ORDER BY d.department_name, e.full_name, cp.competency_name, c.course_name`,
      [departmentId, departmentId]
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { next(error); }
});

export default router;
