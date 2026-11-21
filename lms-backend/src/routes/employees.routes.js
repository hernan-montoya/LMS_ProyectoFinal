import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();
const ILUO_LEVELS = ['I', 'L', 'U', 'O'];

router.get('/', async (req, res, next) => {
  try {
    const { q, department_id, work_area_id, status = 'Activo' } = req.query;
    const conditions = [];
    const params = [];

    if (status !== 'Todos') {
      conditions.push('e.employment_status = ?');
      params.push(status);
    }
    if (department_id) {
      conditions.push('e.department_id = ?');
      params.push(Number(department_id));
    }
    if (work_area_id) {
      conditions.push('e.work_area_id = ?');
      params.push(Number(work_area_id));
    }
    if (q) {
      conditions.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.job_title LIKE ?)');
      const search = `%${q}%`;
      params.push(search, search, search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT e.employee_id, e.employee_code, e.full_name,
              e.department_id, d.department_name,
              e.work_area_id, wa.area_name,
              e.job_title, e.hire_date, e.employment_status
       FROM employees e
       INNER JOIN departments d ON d.department_id = e.department_id
       INNER JOIN work_areas wa ON wa.work_area_id = e.work_area_id
       ${where}
       ORDER BY d.department_name, wa.area_name, e.full_name`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de empleado no es válido.' });
    }

    const [rows] = await pool.execute(
      `SELECT e.employee_id, e.employee_code, e.full_name,
              e.department_id, d.department_name,
              e.work_area_id, wa.area_name,
              e.job_title, e.hire_date, e.employment_status
       FROM employees e
       INNER JOIN departments d ON d.department_id = e.department_id
       INNER JOIN work_areas wa ON wa.work_area_id = e.work_area_id
       WHERE e.employee_id = ?`,
      [employeeId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'No se encontró el colaborador.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      employee_code, full_name, department_id, work_area_id,
      job_title, hire_date, employment_status = 'Activo'
    } = req.body;

    if (!employee_code || !full_name || !department_id || !work_area_id || !job_title || !hire_date) {
      return res.status(400).json({
        success: false,
        message: 'Completa employee_code, full_name, department_id, work_area_id, job_title y hire_date.'
      });
    }
    if (!['Activo', 'Inactivo'].includes(employment_status)) {
      return res.status(400).json({ success: false, message: 'employment_status debe ser Activo o Inactivo.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO employees
       (employee_code, full_name, department_id, work_area_id, job_title, hire_date, employment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [employee_code, full_name, Number(department_id), Number(work_area_id), job_title, hire_date, employment_status]
    );

    const [created] = await pool.execute(
      'SELECT * FROM employees WHERE employee_id = ?',
      [result.insertId]
    );
    res.status(201).json({ success: true, message: 'Colaborador creado correctamente.', data: created[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de empleado ya existe.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'El departamento o área seleccionados no existen o no corresponden entre sí.' });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de empleado no es válido.' });
    }

    const allowedFields = {
      employee_code: 'employee_code',
      full_name: 'full_name',
      department_id: 'department_id',
      work_area_id: 'work_area_id',
      job_title: 'job_title',
      hire_date: 'hire_date',
      employment_status: 'employment_status'
    };
    const updates = Object.entries(allowedFields)
      .filter(([key]) => Object.hasOwn(req.body, key));

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No se recibieron campos para actualizar.' });
    }
    if (Object.hasOwn(req.body, 'employment_status') && !['Activo', 'Inactivo'].includes(req.body.employment_status)) {
      return res.status(400).json({ success: false, message: 'employment_status debe ser Activo o Inactivo.' });
    }

    const setClause = updates.map(([, column]) => `${column} = ?`).join(', ');
    const values = updates.map(([key]) => req.body[key]);
    const [result] = await pool.execute(
      `UPDATE employees SET ${setClause} WHERE employee_id = ?`,
      [...values, employeeId]
    );

    if (!result.affectedRows) {
      const [exists] = await pool.execute('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
      if (!exists.length) {
        return res.status(404).json({ success: false, message: 'No se encontró el colaborador.' });
      }
    }

    const [rows] = await pool.execute('SELECT * FROM employees WHERE employee_id = ?', [employeeId]);
    res.json({ success: true, message: 'Colaborador actualizado correctamente.', data: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de empleado ya existe.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'El departamento o área seleccionados no existen o no corresponden entre sí.' });
    }
    next(error);
  }
});

// Baja lógica: conserva el historial de evaluaciones y capacitaciones.
router.delete('/:id', async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de empleado no es válido.' });
    }

    const [result] = await pool.execute(
      "UPDATE employees SET employment_status = 'Inactivo' WHERE employee_id = ?",
      [employeeId]
    );
    if (!result.affectedRows) {
      const [exists] = await pool.execute('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
      if (!exists.length) {
        return res.status(404).json({ success: false, message: 'No se encontró el colaborador.' });
      }
    }
    res.json({ success: true, message: 'Colaborador marcado como inactivo. Su historial se conserva.' });
  } catch (error) {
    next(error);
  }
});

export default router;
