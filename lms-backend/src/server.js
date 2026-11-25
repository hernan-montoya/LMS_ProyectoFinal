import 'dotenv/config';
import app from './app.js';
import { pool, testDatabaseConnection } from './config/db.js';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    const database = await testDatabaseConnection();
    console.log(`MySQL conectado: ${database.databaseName} (versión ${database.mysqlVersion})`);

    const server = app.listen(PORT, () => {
      console.log(`Servidor LMS disponible en http://localhost:${PORT}`);
      console.log(`Prueba de conexión: http://localhost:${PORT}/api/health`);
      console.log(`Documentación Swagger: http://localhost:${PORT}/api-docs`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido. Cerrando servidor...`);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('No fue posible iniciar el backend. Revisa la configuración de MySQL y el archivo .env.');
    console.error(error.message);
    await pool.end();
    process.exit(1);
  }
}

startServer();
