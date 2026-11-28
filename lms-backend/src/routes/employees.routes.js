import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();
const EMPLOYEE_STATUSES = ['Activo', 'Inactivo'];
const LIST_STATUSES = [...EMPLOYEE_STATUSES, 'Todos'];
const EDITABLE_FIELDS = [
  'employee_code',
  'full_name',
  'department_id',
  'work_area_id',
  'job_title',
  'hire_date',
  'employment_status'
];

const isPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
};

const isValidISODate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// Normaliza y valida los campos del colaborador antes de consultar o modificar MySQL.
const validateEmployee = (input) => {
  const errors = [];
  const data = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { data, errors: ['El cuerpo de la solicitud debe ser un objeto JSON.'] };
  }

  const stringFields = [
    { key: 'employee_code', label: 'El ID del empleado', min: 1, max: 20 },
    { key: 'full_name', label: 'El nombre completo', min: 2, max: 150 },
    { key: 'job_title', label: 'El puesto', min: 2, max: 120 }
  ];

  for (const field of stringFields) {
    const value = input[field.key];

    if (typeof value !== 'string') {
      errors.push(`${field.label} es obligatorio y debe ser texto.`);
      continue;
    }

    const normalized = value.trim();
    if (normalized.length < field.min) {
      errors.push(`${field.label} debe tener al menos ${field.min} carácter(es).`);
    } else if (normalized.length > field.max) {
      errors.push(`${field.label} no puede superar ${field.max} caracteres.`);
    } else {
      data[field.key] = normalized;
    }
  }

  for (const key of ['department_id', 'work_area_id']) {
    if (!isPositiveInteger(input[key])) {
      errors.push(`${key} debe ser un número entero positivo.`);
    } else {
      data[key] = Number(input[key]);
    }
  }

  if (!isValidISODate(input.hire_date)) {
    errors.push('hire_date debe ser una fecha válida con formato YYYY-MM-DD.');
  } else {
    data.hire_date = input.hire_date;
  }

  if (!EMPLOYEE_STATUSES.includes(input.employment_status)) {
    errors.push("employment_status debe ser 'Activo' o 'Inactivo'.");
  } else {
    data.employment_status = input.employment_status;
  }

  return { data, errors };
};

const validateWorkAreaDepartment = async (departmentId, workAreaId) => {
  const [rows] = await pool.execute(
    `SELECT wa.work_area_id
     FROM work_areas wa
     WHERE wa.work_area_id = ?
       AND wa.department_id = ?`,
    [workAreaId, departmentId]
  );

  return rows.length > 0;
};

router.get('/', async (req, res, next) => {
  try {
    const { q, department_id, work_area_id, status = 'Activo' } = req.query;

    if (!LIST_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status debe ser 'Activo', 'Inactivo' o 'Todos'."
      });
    }

    if (department_id !== undefined && !isPositiveInteger(department_id)) {
      return res.status(400).json({
        success: false,
        message: 'department_id debe ser un número entero positivo.'
      });
    }

    if (work_area_id !== undefined && !isPositiveInteger(work_area_id)) {
      return res.status(400).json({
        success: false,
        message: 'work_area_id debe ser un número entero positivo.'
      });
    }

    if (q !== undefined && (typeof q !== 'string' || q.trim().length > 100)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro de búsqueda debe ser texto y no superar 100 caracteres.'
      });
    }

    const conditions = [];
    const params = [];

    if (status !== 'Todos') {
      conditions.push('e.employment_status = ?');
      params.push(status);
    }

    if (department_id !== undefined) {
      conditions.push('e.department_id = ?');
      params.push(Number(department_id));
    }

    if (work_area_id !== undefined) {
      conditions.push('e.work_area_id = ?');
      params.push(Number(work_area_id));
    }

    if (q?.trim()) {
      conditions.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.job_title LIKE ?)');
      const search = `%${q.trim()}%`;
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
    if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
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
    const input = {
      ...(req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}),
      employment_status: req.body?.employment_status ?? 'Activo'
    };

    const { data, errors } = validateEmployee(input);
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'No fue posible registrar el colaborador. Revisa los campos.',
        errors
      });
    }

    const areaBelongsToDepartment = await validateWorkAreaDepartment(
      data.department_id,
      data.work_area_id
    );

    if (!areaBelongsToDepartment) {
      return res.status(400).json({
        success: false,
        message: 'El área seleccionada no existe o no pertenece al departamento indicado.'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO employees
       (employee_code, full_name, department_id, work_area_id, job_title, hire_date, employment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.employee_code,
        data.full_name,
        data.department_id,
        data.work_area_id,
        data.job_title,
        data.hire_date,
        data.employment_status
      ]
    );

    const [created] = await pool.execute(
      `SELECT e.employee_id, e.employee_code, e.full_name,
              e.department_id, d.department_name,
              e.work_area_id, wa.area_name,
              e.job_title, e.hire_date, e.employment_status
       FROM employees e
       INNER JOIN departments d ON d.department_id = e.department_id
       INNER JOIN work_areas wa ON wa.work_area_id = e.work_area_id
       WHERE e.employee_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Colaborador creado correctamente.',
      data: created[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'El código de empleado ya existe. Utiliza un ID diferente.'
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'El departamento o área seleccionados no existen o no corresponden entre sí.'
      });
    }

    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de empleado no es válido.' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
    }

    const receivedFields = Object.keys(req.body);
    const unknownFields = receivedFields.filter((key) => !EDITABLE_FIELDS.includes(key));

    if (unknownFields.length) {
      return res.status(400).json({
        success: false,
        message: `Se recibieron campos no permitidos: ${unknownFields.join(', ')}.`
      });
    }

    if (!receivedFields.length) {
      return res.status(400).json({
        success: false,
        message: 'No se recibieron campos para actualizar.'
      });
    }

    const [existingRows] = await pool.execute(
      `SELECT employee_id, employee_code, full_name,
              department_id, work_area_id, job_title,
              DATE_FORMAT(hire_date, '%Y-%m-%d') AS hire_date,
              employment_status
       FROM employees
       WHERE employee_id = ?`,
      [employeeId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: 'No se encontró el colaborador.' });
    }

    // Valida el registro completo resultante, incluso cuando el PUT modifica pocos campos.
    const mergedEmployee = { ...existingRows[0], ...req.body };
    const { data, errors } = validateEmployee(mergedEmployee);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'No fue posible actualizar el colaborador. Revisa los campos.',
        errors
      });
    }

    const areaBelongsToDepartment = await validateWorkAreaDepartment(
      data.department_id,
      data.work_area_id
    );

    if (!areaBelongsToDepartment) {
      return res.status(400).json({
        success: false,
        message: 'El área seleccionada no existe o no pertenece al departamento indicado.'
      });
    }

    const updateValues = receivedFields.map((field) => data[field]);
    const setClause = receivedFields.map((field) => `${field} = ?`).join(', ');

    await pool.execute(
      `UPDATE employees SET ${setClause} WHERE employee_id = ?`,
      [...updateValues, employeeId]
    );

    const [updatedRows] = await pool.execute(
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

    res.json({
      success: true,
      message: 'Colaborador actualizado correctamente.',
      data: updatedRows[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'El código de empleado ya existe. Utiliza un ID diferente.'
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'El departamento o área seleccionados no existen o no corresponden entre sí.'
      });
    }

    next(error);
  }
});

// Baja lógica: conserva el historial de evaluaciones y capacitaciones.
router.delete('/:id', async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de empleado no es válido.' });
    }

    const [result] = await pool.execute(
      "UPDATE employees SET employment_status = 'Inactivo' WHERE employee_id = ?",
      [employeeId]
    );

    if (!result.affectedRows) {
      const [exists] = await pool.execute(
        'SELECT employee_id FROM employees WHERE employee_id = ?',
        [employeeId]
      );

      if (!exists.length) {
        return res.status(404).json({ success: false, message: 'No se encontró el colaborador.' });
      }
    }

    res.json({
      success: true,
      message: 'Colaborador marcado como inactivo. Su historial se conserva.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
