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
      `SELECT m.employee_id, m.employee_code, m.full_name, m.job_title,
          m.department_id, m.department_name, m.work_area_id, m.area_name,
          m.competency_id, m.competency_code, m.competency_name,
          m.assessment_id, m.iluo_level, m.evaluation_date,
          m.evaluator_name, m.observations
   FROM vw_employee_competency_matrix m
   INNER JOIN employees e
      ON e.employee_id = m.employee_id
   WHERE m.work_area_id = ?
     AND e.employment_status = 'Activo'
   ORDER BY m.full_name, m.competency_id`,
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

// CONSULTAR HISTORIAL DE UNA EVALUACIÓN ILUO
router.get('/assessments/:assessmentId/history', async (req, res, next) => {

  try {

    const assessmentId = Number(req.params.assessmentId);

    // 1. Validar identificador
    if (!Number.isInteger(assessmentId) || assessmentId < 1) {
      return res.status(400).json({
        success: false,
        message: 'El ID de evaluación no es válido.'
      });
    }

    // 2. Consultar información de la evaluación vigente
    const [assessmentRows] = await pool.execute(
      `SELECT
          ec.assessment_id,
          ec.employee_id,
          e.employee_code,
          e.full_name,
          ec.competency_id,
          c.competency_code,
          c.competency_name,
          ec.iluo_level AS current_iluo_level,
          ec.evaluation_date AS current_evaluation_date,
          ec.evaluator_name AS current_evaluator_name,
          ec.observations AS current_observations
       FROM employee_competencies ec
       INNER JOIN employees e
          ON e.employee_id = ec.employee_id
       INNER JOIN competencies c
          ON c.competency_id = ec.competency_id
       WHERE ec.assessment_id = ?`,
      [assessmentId]
    );

    // 3. Comprobar que exista la evaluación
    if (!assessmentRows.length) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró la evaluación solicitada.'
      });
    }

    // 4. Consultar todas las modificaciones históricas
    const [historyRows] = await pool.execute(
      `SELECT
          history_id,
          assessment_id,
          employee_id,
          competency_id,
          previous_iluo_level,
          new_iluo_level,
          previous_evaluator_name,
          new_evaluator_name,
          previous_observations,
          new_observations,
          changed_at
       FROM employee_competency_history
       WHERE assessment_id = ?
       ORDER BY changed_at ASC, history_id ASC`,
      [assessmentId]
    );

    // 5. Devolver evaluación e historial
    res.json({
      success: true,
      assessment: assessmentRows[0],
      total: historyRows.length,
      data: historyRows
    });

  } catch (error) {

    next(error);

  }

});

router.put('/assessments/:assessmentId', async (req, res, next) => {

  let connection;

  try {

    const assessmentId = Number(req.params.assessmentId);

    const {
      iluo_level,
      evaluator_name = null,
      observations = null
    } = req.body;

    // 1. Validar identificador
    if (!Number.isInteger(assessmentId) || assessmentId < 1) {
      return res.status(400).json({
        success: false,
        message: 'El ID de evaluación no es válido.'
      });
    }

    // 2. Validar nivel ILUO
    if (!VALID_LEVELS.includes(iluo_level)) {
      return res.status(400).json({
        success: false,
        message: 'iluo_level debe ser I, L, U u O.'
      });
    }

    // 3. Validar evaluador y observaciones
    if (
      evaluator_name !== null &&
      (typeof evaluator_name !== 'string' || evaluator_name.length > 150)
    ) {
      return res.status(400).json({
        success: false,
        message: 'El evaluador debe ser un texto de máximo 150 caracteres.'
      });
    }

    if (
      observations !== null &&
      (typeof observations !== 'string' || observations.length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Las observaciones deben tener máximo 500 caracteres.'
      });
    }

    const normalizedEvaluator = evaluator_name?.trim() || null;
    const normalizedObservations = observations?.trim() || null;

    // 4. Obtener conexión exclusiva para la transacción
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // 5. Consultar la evaluación actual y bloquearla durante la operación
    const [currentRows] = await connection.execute(
      `SELECT
          assessment_id,
          employee_id,
          competency_id,
          iluo_level,
          evaluator_name,
          observations
       FROM employee_competencies
       WHERE assessment_id = ?
       FOR UPDATE`,
      [assessmentId]
    );

    if (!currentRows.length) {

      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'No se encontró la evaluación.'
      });

    }

    const previous = currentRows[0];

    // 6. Identificar si realmente existen cambios
    const hasChanges =
      previous.iluo_level !== iluo_level ||
      (previous.evaluator_name ?? null) !== normalizedEvaluator ||
      (previous.observations ?? null) !== normalizedObservations;

    if (hasChanges) {

      // 7. Guardar el estado anterior y el nuevo en el historial
      await connection.execute(
        `INSERT INTO employee_competency_history (
            assessment_id,
            employee_id,
            competency_id,
            previous_iluo_level,
            new_iluo_level,
            previous_evaluator_name,
            new_evaluator_name,
            previous_observations,
            new_observations
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          previous.assessment_id,
          previous.employee_id,
          previous.competency_id,
          previous.iluo_level,
          iluo_level,
          previous.evaluator_name,
          normalizedEvaluator,
          previous.observations,
          normalizedObservations
        ]
      );

      // 8. Actualizar la evaluación vigente
      await connection.execute(
        `UPDATE employee_competencies
         SET
            iluo_level = ?,
            evaluation_date = CURDATE(),
            evaluator_name = ?,
            observations = ?
         WHERE assessment_id = ?`,
        [
          iluo_level,
          normalizedEvaluator,
          normalizedObservations,
          assessmentId
        ]
      );

    }

    // 9. Confirmar ambas operaciones
    await connection.commit();

    // 10. Recuperar la evaluación actualizada
    const [updatedRows] = await connection.execute(
      `SELECT
          assessment_id,
          employee_id,
          competency_id,
          iluo_level,
          evaluation_date,
          evaluator_name,
          observations
       FROM employee_competencies
       WHERE assessment_id = ?`,
      [assessmentId]
    );

    res.json({
      success: true,
      changed: hasChanges,
      message: hasChanges
        ? 'Evaluación actualizada e historial registrado correctamente.'
        : 'No se detectaron cambios en la evaluación.',
      data: updatedRows[0]
    });

  } catch (error) {

    // Si algo falla, revertir toda la transacción
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir la transacción:', rollbackError);
      }
    }

    next(error);

  } finally {

    // Liberar la conexión
    if (connection) {
      connection.release();
    }

  }

});

export default router;
