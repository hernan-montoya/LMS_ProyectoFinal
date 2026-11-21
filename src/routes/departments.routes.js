import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.department_id, d.department_code, d.department_name, d.description,
              COUNT(DISTINCT e.employee_id) AS employee_count
       FROM departments d
       LEFT JOIN employees e
         ON e.department_id = d.department_id AND e.employment_status = 'Activo'
       WHERE d.active = 1
       GROUP BY d.department_id, d.department_code, d.department_name, d.description
       ORDER BY d.department_id`
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:departmentId/areas', async (req, res, next) => {
  try {
    const departmentId = Number(req.params.departmentId);
    if (!Number.isInteger(departmentId) || departmentId < 1) {
      return res.status(400).json({ success: false, message: 'El ID del departamento no es válido.' });
    }
    const [rows] = await pool.execute(
      `SELECT wa.work_area_id, wa.area_code, wa.area_name, wa.description,
              wa.is_management_area,
              COUNT(DISTINCT e.employee_id) AS employee_count
       FROM work_areas wa
       LEFT JOIN employees e
         ON e.work_area_id = wa.work_area_id AND e.employment_status = 'Activo'
       WHERE wa.department_id = ? AND wa.active = 1
       GROUP BY wa.work_area_id, wa.area_code, wa.area_name, wa.description, wa.is_management_area
       ORDER BY wa.work_area_id`,
      [departmentId]
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
