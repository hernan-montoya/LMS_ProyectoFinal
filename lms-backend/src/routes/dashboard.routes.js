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

// ============================================
// ANÁLISIS DE BRECHAS POR COMPETENCIA
// ============================================

router.get('/gaps', async (req, res, next) => {

  try {

    const [rows] = await pool.execute(`

      SELECT

        d.department_id,
        d.department_name,

        wa.work_area_id,
        wa.area_name,

        c.competency_id,
        c.competency_code,
        c.competency_name,

        COUNT(ec.assessment_id) AS total_assessments,

        SUM(
          CASE WHEN ec.iluo_level = 'I'
          THEN 1 ELSE 0 END
        ) AS level_i_count,

        SUM(
          CASE WHEN ec.iluo_level = 'L'
          THEN 1 ELSE 0 END
        ) AS level_l_count,

        SUM(
          CASE WHEN ec.iluo_level = 'U'
          THEN 1 ELSE 0 END
        ) AS level_u_count,

        SUM(
          CASE WHEN ec.iluo_level = 'O'
          THEN 1 ELSE 0 END
        ) AS level_o_count,

        SUM(
          CASE WHEN ec.iluo_level IN ('I', 'L')
          THEN 1 ELSE 0 END
        ) AS gap_count,

        ROUND(

          100.0 * SUM(
            CASE WHEN ec.iluo_level IN ('I', 'L')
            THEN 1 ELSE 0 END
          ) / NULLIF(COUNT(ec.assessment_id), 0),

          1

        ) AS gap_percentage

      FROM employee_competencies ec

      INNER JOIN employees e
        ON ec.employee_id = e.employee_id

      INNER JOIN competencies c
        ON ec.competency_id = c.competency_id

      INNER JOIN work_areas wa
        ON e.work_area_id = wa.work_area_id

      INNER JOIN departments d
        ON wa.department_id = d.department_id

      GROUP BY

        d.department_id,
        d.department_name,

        wa.work_area_id,
        wa.area_name,

        c.competency_id,
        c.competency_code,
        c.competency_name

      ORDER BY

        gap_percentage DESC,
        gap_count DESC

    `);

    res.json({

      success: true,

      total: rows.length,

      data: rows

    });

  } catch (error) {

    next(error);

  }

});

export default router;
