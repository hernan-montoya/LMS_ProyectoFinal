# LMS - Backend

API REST inicial para el Sistema de Gestión de Competencias y Capacitación.

## Requisitos

- Node.js y npm instalados.
- MySQL Server en ejecución.
- Base de datos `lms_competencias` creada a partir del script SQL del proyecto.

## Instalación

```bash
npm install express mysql2 cors dotenv
npm install --save-dev nodemon
```

Copia `.env.example` y renómbralo a `.env`. Ajusta `DB_USER` y `DB_PASSWORD` con las credenciales de tu MySQL local.

## Ejecución en desarrollo

```bash
npm run dev
```

La API queda disponible en `http://localhost:3000`.

## Endpoints iniciales

- `GET /api/health` - comprueba API y conexión a MySQL.
- `GET /api/employees` - lista colaboradores activos. Admite `q`, `department_id`, `work_area_id` y `status=Todos`.
- `GET /api/employees/:id` - consulta un colaborador.
- `POST /api/employees` - crea un colaborador.
- `PUT /api/employees/:id` - actualiza los campos enviados.
- `DELETE /api/employees/:id` - realiza baja lógica, marcándolo como Inactivo.
- `GET /api/departments` - lista departamentos con cantidad de colaboradores activos.
- `GET /api/departments/:departmentId/areas` - lista áreas de un departamento.
- `GET /api/areas/:workAreaId/competencies` - obtiene las filas de la matriz ILUO del área (empleados x competencias).
- `PUT /api/assessments/:assessmentId` - actualiza un nivel ILUO existente.
- `GET /api/dashboard/summary` - devuelve indicadores generales, por departamento y por área.

## Ejemplo de actualización ILUO

`PUT /api/assessments/1`

```json
{
  "iluo_level": "U",
  "evaluator_name": "Administrador LMS",
  "observations": "Evaluación de demostración actualizada."
}
```

Los niveles válidos son `I`, `L`, `U` y `O`.
