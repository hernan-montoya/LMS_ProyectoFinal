import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();
const VALID_LEVELS = ['I', 'L', 'U', 'O'];

router.get('/areas/:workAreaId/competencies', async (req, res, next) => {
  try {
    const workAreaId = Number(req.params.workAreaId);
    if (!Number.isInteger(workAreaId) || workAreaId < 1) {
      return res.status(400).json({ success: false, message: 'El ID del área no es válido.' });
    }

    const [rows] = await pool.execute(
      `SELECT employee_id, employee_code, full_name, job_title,
              department_id, department_name, work_area_id, area_name,
              competency_id, competency_code, competency_name,
              assessment_id, iluo_level, evaluation_date, evaluator_name, observations
       FROM vw_employee_competency_matrix
       WHERE work_area_id = ?
       ORDER BY full_name, competency_id`,
      [workAreaId]
    );

    if (!rows.length) {
      const [area] = await pool.execute('SELECT work_area_id, area_name FROM work_areas WHERE work_area_id = ?', [workAreaId]);
      if (!area.length) {
        return res.status(404).json({ success: false, message: 'No se encontró el área de trabajo.' });
      }
    }

    res.json({
      success: true,
      work_area_id: workAreaId,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

router.put('/assessments/:assessmentId', async (req, res, next) => {
  try {
    const assessmentId = Number(req.params.assessmentId);
    const { iluo_level, evaluator_name = null, observations = null } = req.body;

    if (!Number.isInteger(assessmentId) || assessmentId < 1) {
      return res.status(400).json({ success: false, message: 'El ID de evaluación no es válido.' });
    }
    if (!VALID_LEVELS.includes(iluo_level)) {
      return res.status(400).json({ success: false, message: 'iluo_level debe ser I, L, U u O.' });
    }

    const [result] = await pool.execute(
      `UPDATE employee_competencies
       SET iluo_level = ?, evaluation_date = CURDATE(), evaluator_name = ?, observations = ?
       WHERE assessment_id = ?`,
      [iluo_level, evaluator_name, observations, assessmentId]
    );

    if (!result.affectedRows) {
      const [exists] = await pool.execute(
        'SELECT assessment_id FROM employee_competencies WHERE assessment_id = ?',
        [assessmentId]
      );
      if (!exists.length) {
        return res.status(404).json({ success: false, message: 'No se encontró la evaluación.' });
      }
    }

    const [rows] = await pool.execute(
      `SELECT assessment_id, employee_id, competency_id, iluo_level,
              evaluation_date, evaluator_name, observations
       FROM employee_competencies WHERE assessment_id = ?`,
      [assessmentId]
    );
    res.json({ success: true, message: 'Evaluación ILUO actualizada correctamente.', data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
