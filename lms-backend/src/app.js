import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerSwagger } from './config/swagger.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LMS - API de Gestión de Competencias y Capacitación',
    api: '/api',
    health: '/api/health'
  });
});

// Documentación interactiva Swagger
registerSwagger(app);

// Rutas principales de la API
app.use('/api', apiRoutes);

// Manejo de rutas y errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
