# LMS – Sistema de Gestión de Competencias y Capacitación

Aplicación web local para administrar colaboradores, consultar la estructura organizacional y evaluar competencias mediante una matriz ILUO. El sistema integra un frontend en React, una API REST desarrollada con Node.js y Express, y una base de datos MySQL.

> **Estado del proyecto:** versión académica funcional para ejecución local. Incluye administración de colaboradores, matriz ILUO, análisis de brechas, administración y seguimiento de capacitación, reportes y exportación a Excel. La impartición de cursos en línea y la exportación a PDF quedan fuera del alcance de esta versión.

## 1. Objetivo

Centralizar información de colaboradores y competencias por área de trabajo, facilitar la consulta de resultados ILUO y ofrecer indicadores generales y análisis de brechas de capacitación.

## 2. Funcionalidades implementadas

- **Dashboard:** indicadores generales, distribución de niveles ILUO y resultados por departamento.
- **Departamentos y áreas:** consulta de los departamentos y sus áreas de trabajo registradas.
- **Matriz ILUO:** consulta de competencias por área y actualización de evaluaciones.
- **Brechas de capacitación:** consulta y filtrado de brechas por departamento, área y competencia.
- **Colaboradores:** alta, consulta, edición y baja lógica. El directorio permite consultar colaboradores activos e inactivos.
- **Perfil individual:** consulta de información general, resultados de competencias e historial de cambios ILUO.
- **Capacitación:** catálogo de cursos, relación con competencias, asignación a colaboradores activos, seguimiento de estatus, fechas, calificaciones y recomendaciones vinculadas con brechas ILUO I/L.
- **Reportes:** indicadores globales y departamentales, distribución ILUO y análisis de brechas.
- **Exportación a Excel:** reportes en un libro `.xlsx` con cinco hojas (Resumen, Distribución ILUO, Dominio por departamento, Brechas y Colaboradores), además del historial de asignaciones de capacitación.
- **Widget del clima:** consulta del clima actual mediante Open-Meteo y ubicación del navegador, con permiso del usuario.
- **Documentación de API:** Swagger UI / OpenAPI para consultar y probar los endpoints disponibles, incluidos los de capacitación.

### Regla de visualización por estado laboral

| Módulo | Colaboradores activos | Colaboradores inactivos |
|---|:---:|:---:|
| Colaboradores | Sí | Sí |
| Departamentos | Sí | No |
| Matriz ILUO | Sí | No |

La baja de un colaborador es lógica: el registro se conserva en MySQL y su estado cambia a `Inactivo`. No se elimina físicamente al colaborador ni sus evaluaciones.

## 3. Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React, JavaScript, Vite |
| Interfaz y visualizaciones | CSS, Recharts, Lucide React |
| Exportación Excel | SheetJS (`xlsx`) |
| Backend | Node.js, Express |
| Acceso a datos | mysql2 |
| Base de datos | MySQL 8.0 o superior |
| Variables de entorno | dotenv |
| Documentación de API | OpenAPI y Swagger UI (`swagger-ui-express`, `yaml`) |
| Servicio externo de clima | Open-Meteo |
| Control de versiones | Git y GitHub |

## 4. Arquitectura general

La aplicación está organizada en tres partes:

1. **Frontend (`lms-frontend`):** presenta las pantallas y consume la API mediante solicitudes HTTP.
2. **Backend (`lms-backend`):** valida las solicitudes, ejecuta consultas en MySQL y devuelve respuestas JSON.
3. **Base de datos (`lms_competencias`):** almacena colaboradores, departamentos, áreas, competencias y evaluaciones, entre otros catálogos del proyecto.

Flujo general:

```text
Navegador (React + Vite)
          |
          | HTTP / JSON
          v
API REST (Node.js + Express)
          |
          | mysql2
          v
Base de datos MySQL (lms_competencias)
```

El widget del clima consulta Open-Meteo desde el frontend. Para obtener condiciones locales, el navegador solicita permiso para compartir la ubicación; las coordenadas se usan para la consulta del clima y no forman parte del modelo de datos de MySQL.

## 5. Estructura del repositorio

Estructura principal de referencia:

```text
LMS-ProyectoFinal/
├── lms-backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── openapi.yaml
│   │   │   └── swagger.js
│   │   ├── middleware/
│   │   │   ├── error-handler.js
│   │   │   └── not-found.js
│   │   ├── routes/
│   │   │   ├── dashboard.routes.js
│   │   │   ├── departments.routes.js
│   │   │   ├── employees.routes.js
│   │   │   ├── health.routes.js
│   │   │   ├── index.js
│   │   │   └── matrix.routes.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── README.md
├── lms-frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Reports.jsx
│   │   │   ├── Reports.css
│   │   │   ├── TrainingManagement.jsx
│   │   │   ├── TrainingManagement.css
│   │   │   └── ...
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   └── package.json
├── lms_competencias.sql
└── README.md
```

La estructura puede variar ligeramente conforme se incorporen componentes o rutas. El archivo `lms_competencias.sql` contiene el script de creación y carga inicial de la base de datos.

## 6. Requisitos previos

- Node.js y npm instalados.
- MySQL Server 8.0 o superior en ejecución.
- MySQL Workbench (recomendado para ejecutar y consultar el script SQL).
- Git (opcional, para clonar y actualizar el repositorio).

## 7. Configuración de la base de datos

1. Inicia MySQL Server.
2. Abre MySQL Workbench y conéctate a tu instancia local.
3. Abre el archivo `lms_competencias.sql`, ubicado en la raíz del proyecto.
4. Ejecuta el script completo.
5. Comprueba que exista la base `lms_competencias` y que se hayan creado sus tablas y vistas.

El script incluye datos ficticios de ejemplo para facilitar las pruebas. Las evaluaciones ILUO iniciales se generan con niveles demostrativos; deben reemplazarse por evaluaciones reales cuando el sistema se utilice en un escenario operativo.

## 8. Configuración del backend

Abre una terminal y entra en la carpeta del backend:

```bash
cd LMS-ProyectoFinal/lms-backend
```

Instala las dependencias declaradas por el proyecto:

```bash
npm install
```

Crea el archivo `.env` a partir de `.env.example` y configura las credenciales de tu MySQL local. Ejemplo de las variables utilizadas por el backend:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TU_PASSWORD_MYSQL
DB_NAME=lms_competencias
DB_CONNECTION_LIMIT=10

FRONTEND_URL=http://localhost:5173
```

Reemplaza `TU_PASSWORD_MYSQL` por la contraseña correspondiente a tu instalación. Si tu usuario de MySQL no es `root`, actualiza `DB_USER`. No compartas el archivo `.env` ni subas credenciales al repositorio.

Inicia el backend en modo desarrollo:

```bash
npm run dev
```

Direcciones locales:

- API: `http://localhost:3000/api`
- Comprobación de servicio y conexión: `http://localhost:3000/api/health`
- Documentación interactiva: `http://localhost:3000/api-docs`

El backend debe poder conectarse a MySQL para iniciar correctamente.

## 9. Configuración del frontend

Abre una **segunda terminal** y entra en la carpeta del frontend:

```bash
cd LMS-ProyectoFinal/lms-frontend
```

Instala sus dependencias:

```bash
npm install
```

Crea el archivo `.env` en `lms-frontend` con la dirección de la API:

```env
VITE_API_URL=http://localhost:3000/api
```

Inicia Vite:

```bash
npm run dev
```

Abre la dirección que muestre la terminal; normalmente es:

```text
http://localhost:5173
```

**Importante:** mantén abiertas las dos terminales mientras utilices la aplicación: una para el backend y otra para el frontend. Si Vite informa que el puerto 5173 está ocupado, detén la instancia anterior con `Ctrl + C` antes de iniciar otra.

## 10. Endpoints principales

Todas las rutas de la tabla usan el prefijo `/api`. La documentación interactiva en Swagger UI contiene los parámetros, esquemas y ejemplos declarados en `src/config/openapi.yaml`.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/health` | Comprueba el servicio y la conexión con MySQL. |
| GET | `/api/employees` | Lista y filtra colaboradores. Admite `q`, `department_id`, `work_area_id` y `status`. |
| GET | `/api/employees/:id` | Consulta un colaborador por ID. |
| POST | `/api/employees` | Registra un colaborador. |
| PUT | `/api/employees/:id` | Actualiza los datos enviados de un colaborador. |
| DELETE | `/api/employees/:id` | Realiza baja lógica: cambia el estado a `Inactivo`. |
| GET | `/api/departments` | Lista departamentos con el conteo de colaboradores activos. |
| GET | `/api/departments/:departmentId/areas` | Lista las áreas activas de un departamento y su conteo de colaboradores activos. |
| GET | `/api/areas/:workAreaId/competencies` | Consulta las competencias y evaluaciones del área para la matriz ILUO. |
| PUT | `/api/assessments/:assessmentId` | Actualiza el nivel ILUO y los datos de evaluación. |
| GET | `/api/assessments/:assessmentId/history` | Consulta los cambios históricos de una evaluación ILUO. |
| GET | `/api/dashboard/summary` | Obtiene indicadores generales, por departamento y por área. |
| GET | `/api/dashboard/gaps` | Obtiene el análisis de brechas por departamento, área y competencia. |
| GET | `/api/training/competencies` | Lista competencias activas para relacionarlas con cursos. |
| GET | `/api/training/courses` | Consulta y filtra el catálogo de cursos. |
| GET | `/api/training/courses/:courseId` | Consulta el detalle de un curso y sus competencias. |
| POST | `/api/training/courses` | Registra un curso y sus competencias relacionadas. |
| PUT | `/api/training/courses/:courseId` | Actualiza un curso y sus relaciones con competencias. |
| PATCH | `/api/training/courses/:courseId/status` | Activa o desactiva un curso sin eliminarlo. |
| GET | `/api/training/summary` | Obtiene indicadores de capacitación. Admite filtro por departamento. |
| GET | `/api/training/enrollments` | Consulta y filtra las asignaciones de cursos. |
| POST | `/api/training/enrollments` | Asigna un curso a uno o varios colaboradores activos. |
| PATCH | `/api/training/enrollments/:enrollmentId` | Actualiza el estado y los datos de seguimiento de una asignación. |
| GET | `/api/training/recommendations` | Sugiere cursos relacionados con competencias en niveles ILUO I o L. |

### Parámetro de estado de colaboradores

El endpoint `GET /api/employees` permite consultar los estados:

- `status=Activo`: devuelve colaboradores activos.
- `status=Inactivo`: devuelve colaboradores inactivos.
- `status=Todos`: devuelve ambos estados.

Ejemplo:

```text
http://localhost:3000/api/employees?status=Todos
```

Si no se especifica `status`, el backend utiliza `Activo` como valor predeterminado.

### Niveles de la matriz ILUO

| Nivel | Nombre utilizado en el proyecto |
|---|---|
| I | Inicial |
| L | Limitado |
| U | Autónomo |
| O | Orientador |

En los indicadores del proyecto, los niveles `I` y `L` se consideran brechas por desarrollar, mientras que `U` y `O` se consideran dominio de la competencia. Esta clasificación corresponde al criterio analítico adoptado para este proyecto.

## 11. Documentación y pruebas con Swagger

Con el backend iniciado, abre:

```text
http://localhost:3000/api-docs
```

Swagger UI permite:

- Consultar las operaciones y métodos HTTP declarados en `src/config/openapi.yaml`.
- Revisar parámetros, cuerpos JSON y respuestas documentadas.
- Ejecutar solicitudes contra el backend local.

El módulo de Capacitación agrega las operaciones bajo `/api/training`. Para que también aparezcan en Swagger, el archivo `openapi.yaml` debe incluir la etiqueta y las rutas del fragmento `openapi-training.yaml` entregado con la Etapa 3.15. El montaje funcional de las rutas en Express es independiente de su documentación en Swagger.

Para probar endpoints de lectura (`GET`), selecciona la operación, pulsa **Try it out** y después **Execute**.

Las operaciones `POST`, `PUT` y `DELETE` modifican datos reales de MySQL. Utiliza registros de prueba y confirma los datos antes de ejecutar estas operaciones.

## 12. Pruebas funcionales recomendadas

1. Comprobar `/api/health` y verificar que indique una conexión correcta con MySQL.
2. Consultar `GET /api/employees?status=Todos` y comparar los registros con la tabla `employees` de MySQL.
3. Consultar departamentos y áreas; comprobar que sus conteos consideran únicamente colaboradores activos.
4. Abrir una matriz ILUO y confirmar que muestra colaboradores activos del área seleccionada.
5. Actualizar una evaluación de prueba y verificar el cambio en MySQL.
6. Dar de baja un colaborador de prueba y comprobar que permanece en el directorio con estado `Inactivo`, pero deja de aparecer en Departamentos y en la Matriz ILUO.
7. Consultar Dashboard y Brechas para comparar los indicadores con las respuestas de la API.
8. Probar el catálogo de cursos, las asignaciones, el seguimiento de estatus y las recomendaciones ILUO del módulo Capacitación.
9. Generar el Excel de Reportes y comprobar sus cinco hojas: Resumen, Distribución ILUO, Dominio por departamento, Brechas y Colaboradores.
10. Generar el Excel de Capacitación y comprobar las asignaciones exportadas, respetando los filtros aplicados.
11. Probar el widget del clima y conceder permiso de ubicación al navegador cuando lo solicite.

## 13. Seguridad y consideraciones

- El proyecto está preparado para uso y demostración en entorno local; no se debe exponer públicamente sin implementar autenticación, autorización, transporte seguro y otras medidas de seguridad apropiadas.
- Mantén las credenciales de MySQL en `.env` y excluye ese archivo del control de versiones.
- Antes de probar operaciones de escritura, realiza una copia de seguridad o utiliza registros de prueba.
- Los datos iniciales son demostrativos y no deben interpretarse como evaluaciones reales del personal.
- La ubicación del navegador se solicita para consultar el clima; el usuario puede denegar ese permiso.

## 14. Validación funcional y alcance

Durante la integración final se comprobó manualmente la carga del catálogo de cursos desde MySQL, el registro de una asignación de capacitación, la actualización de su estado a `En progreso` y la generación de los archivos Excel desde Reportes y Capacitación. Las exportaciones se verificaron en la aplicación local.

El módulo de Capacitación administra el catálogo, las asignaciones y el seguimiento de cursos; no ofrece aulas virtuales, reproducción de video, lecciones, exámenes en línea ni emisión de certificados. La versión actual incorpora exportación a Excel, pero no exportación a PDF. Las pruebas manuales no sustituyen una suite automatizada de pruebas.

Antes de utilizar el sistema con información real, deben incorporarse autenticación, autorización por roles, controles de acceso y una política de respaldos. Los niveles ILUO iniciales del script SQL son datos de demostración aleatorios y deben sustituirse por evaluaciones reales.

## 15. Control de versiones

Repositorio del proyecto:

```text
https://github.com/hernan-montoya/LMS_ProyectoFinal.git
```

Comandos habituales desde la carpeta raíz del repositorio:

```bash
git status
git add -A
git commit -m "docs: actualizar documentación del proyecto"
git push
```

Antes de realizar un commit, verifica que `.env`, `node_modules` y otros archivos locales o sensibles estén excluidos.

---

**LMS – Sistema de Gestión de Competencias y Capacitación**  
Proyecto académico de Backend Intermedio.
