import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const [[global]] = await pool.execute(
      `SELECT
          COUNT(DISTINCT e.employee_id) AS total_employees,
          COUNT(ec.assessment_id) AS total_assessments,
          COALESCE(SUM(ec.iluo_level = 'I'), 0) AS level_i_count,
          COALESCE(SUM(ec.iluo_level = 'L'), 0) AS level_l_count,
          COALESCE(SUM(ec.iluo_level = 'U'), 0) AS level_u_count,
          COALESCE(SUM(ec.iluo_level = 'O'), 0) AS level_o_count,
          ROUND(
            100 * SUM(ec.iluo_level IN ('U', 'O')) / NULLIF(COUNT(ec.assessment_id), 0),
            1
          ) AS proficiency_percent
       FROM employees e
       LEFT JOIN employee_competencies ec ON ec.employee_id = e.employee_id
       WHERE e.employment_status = 'Activo'`
    );

    const [departments] = await pool.execute(
      'SELECT * FROM vw_department_iluo_summary ORDER BY department_id'
    );
    const [areas] = await pool.execute(
      'SELECT * FROM vw_area_iluo_summary ORDER BY department_id, work_area_id'
    );

    res.json({
      success: true,
      data: {
        global,
        departments,
        areas
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
