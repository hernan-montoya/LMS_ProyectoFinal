import { Router } from 'express';
import { testDatabaseConnection } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const database = await testDatabaseConnection();
    res.json({
      success: true,
      message: 'API del LMS funcionando y conexión con MySQL establecida.',
      database
    });
  } catch (error) {
    next(error);
  }
});

export default router;
