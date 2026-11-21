import { Router } from 'express';
import healthRoutes from './health.routes.js';
import employeesRoutes from './employees.routes.js';
import departmentsRoutes from './departments.routes.js';
import matrixRoutes from './matrix.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/employees', employeesRoutes);
router.use('/departments', departmentsRoutes);
router.use('/', matrixRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
