-- ============================================================================
-- LMS - Sistema de Gestión de Competencias y Capacitación
-- Base de datos inicial para el proyecto Backend Intermedio
-- Versión: MySQL 8.0+
--
-- NOTAS:
-- 1) Todos los colaboradores y resultados de ILUO son datos ficticios de ejemplo.
-- 2) Se crean 51 colaboradores, distribuidos según la estructura acordada.
-- 3) Cada colaborador recibe cinco evaluaciones iniciales, una por competencia
--    de su área. Los niveles ILUO se asignan aleatoriamente al ejecutar este script.
-- 4) Para los gerentes se crean áreas de gestión separadas. Así se conservan las
--    tres áreas operativas de Producción y las dos de Embarques solicitadas.
-- 5) El script es reejecutable: usa IF NOT EXISTS, claves explícitas y INSERT IGNORE
--    para evitar duplicar los datos iniciales. Las evaluaciones ya existentes no
--    se vuelven a sortear al ejecutar el archivo por segunda vez.
-- ============================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS lms_competencias
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE lms_competencias;

-- ---------------------------------------------------------------------------
-- 1. Catálogos organizacionales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_code VARCHAR(20) NOT NULL UNIQUE,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS work_areas (
    work_area_id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    area_code VARCHAR(30) NOT NULL UNIQUE,
    area_name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    is_management_area TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT uq_work_area_department UNIQUE (work_area_id, department_id),
    CONSTRAINT uq_area_name_per_department UNIQUE (department_id, area_name),
    CONSTRAINT fk_work_areas_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. Colaboradores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    department_id INT NOT NULL,
    work_area_id INT NOT NULL,
    job_title VARCHAR(120) NOT NULL,
    hire_date DATE NOT NULL,
    employment_status ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_employee_area UNIQUE (employee_id, work_area_id),
    CONSTRAINT fk_employees_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_employees_work_area_department
        FOREIGN KEY (work_area_id, department_id)
        REFERENCES work_areas(work_area_id, department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_employees_name (full_name),
    INDEX idx_employees_department (department_id),
    INDEX idx_employees_work_area (work_area_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. Catálogo de competencias por área
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competencies (
    competency_id INT AUTO_INCREMENT PRIMARY KEY,
    work_area_id INT NOT NULL,
    competency_code VARCHAR(40) NOT NULL,
    competency_name VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
    active TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT uq_competency_code_per_area UNIQUE (work_area_id, competency_code),
    CONSTRAINT uq_competency_area UNIQUE (competency_id, work_area_id),
    CONSTRAINT fk_competencies_work_area
        FOREIGN KEY (work_area_id) REFERENCES work_areas(work_area_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. Evaluaciones ILUO por colaborador y competencia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_competencies (
    assessment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    work_area_id INT NOT NULL,
    competency_id INT NOT NULL,
    iluo_level ENUM('I', 'L', 'U', 'O') NOT NULL,
    evaluation_date DATE NOT NULL,
    evaluator_name VARCHAR(150) NULL,
    observations VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_employee_competency UNIQUE (employee_id, competency_id),
    CONSTRAINT fk_assessments_employee_area
        FOREIGN KEY (employee_id, work_area_id)
        REFERENCES employees(employee_id, work_area_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_assessments_competency_area
        FOREIGN KEY (competency_id, work_area_id)
        REFERENCES competencies(competency_id, work_area_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_assessments_level (iluo_level),
    INDEX idx_assessments_area (work_area_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. Catálogo de cursos y su relación con competencias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    modality ENUM('Presencial', 'Virtual', 'Hibrida') NOT NULL DEFAULT 'Presencial',
    duration_hours DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_competencies (
    course_id INT NOT NULL,
    competency_id INT NOT NULL,
    target_iluo_level ENUM('I', 'L', 'U', 'O') NOT NULL DEFAULT 'U',
    notes VARCHAR(255) NULL,
    PRIMARY KEY (course_id, competency_id),
    CONSTRAINT fk_course_competencies_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_course_competencies_competency
        FOREIGN KEY (competency_id) REFERENCES competencies(competency_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. Asignación y seguimiento de cursos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    course_id INT NOT NULL,
    assigned_date DATE NOT NULL,
    due_date DATE NULL,
    completion_date DATE NULL,
    enrollment_status ENUM('Asignado', 'En progreso', 'Completado', 'Cancelado')
        NOT NULL DEFAULT 'Asignado',
    score DECIMAL(5,2) NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_enrollments_employee
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_enrollment_score CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    CONSTRAINT chk_enrollment_dates CHECK (due_date IS NULL OR due_date >= assigned_date),
    INDEX idx_enrollments_status (enrollment_status),
    INDEX idx_enrollments_employee (employee_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. Departamentos
-- ---------------------------------------------------------------------------
INSERT INTO departments (department_id, department_code, department_name, description) VALUES
(1, 'RH', 'Recursos Humanos', 'Administración y desarrollo del talento.'),
(2, 'FIN', 'Contabilidad / Finanzas', 'Control contable, financiero y presupuestal.'),
(3, 'COM', 'Ventas / Mercadotecnia', 'Gestión comercial, clientes y mercadotecnia.'),
(4, 'LOG', 'Logística', 'Planeación de materiales, inventarios y transporte.'),
(5, 'DIR', 'Dirección', 'Dirección operativa y financiera.'),
(6, 'PROD', 'Producción', 'Gestión y ejecución de procesos productivos.'),
(7, 'EMB', 'Embarques', 'Preparación, carga y despacho de pedidos.')
ON DUPLICATE KEY UPDATE
    department_name = VALUES(department_name),
    description = VALUES(description);

-- Áreas de gestión separadas para asignar competencias adecuadas a gerentes.
-- Producción conserva sus tres áreas operativas y Embarques sus dos áreas operativas.
INSERT INTO work_areas
(work_area_id, department_id, area_code, area_name, description, is_management_area) VALUES
(1, 1, 'RH_GENERAL', 'Recursos Humanos - General', 'Funciones generales de Recursos Humanos.', 0),
(2, 2, 'FIN_GENERAL', 'Contabilidad y Finanzas', 'Funciones contables y financieras.', 0),
(3, 3, 'COM_GENERAL', 'Ventas y Mercadotecnia', 'Funciones comerciales y de mercadotecnia.', 0),
(4, 4, 'LOG_GENERAL', 'Logística', 'Funciones de logística y control de materiales.', 0),
(5, 5, 'DIR_OPER', 'Dirección Operativa', 'Competencias del director operativo.', 1),
(6, 5, 'DIR_FIN', 'Dirección Financiera', 'Competencias del director financiero.', 1),
(7, 6, 'PROD_GESTION', 'Gestión de Producción', 'Competencias de gestión del gerente de Producción.', 1),
(8, 6, 'PROD_CORTE', 'Corte y preparación de materiales', 'Preparación y corte de materias primas.', 0),
(9, 6, 'PROD_MAQUINADO', 'Maquinado y conformado', 'Operación y control de procesos de maquinado y conformado.', 0),
(10, 6, 'PROD_ENSAMBLE', 'Ensamble y acabado', 'Ensamble, inspección y acabado de producto.', 0),
(11, 7, 'EMB_GESTION', 'Gestión de Embarques', 'Competencias de gestión del gerente de Embarques.', 1),
(12, 7, 'EMB_PICK_PACK', 'Preparación de pedidos (Picking & Packing)', 'Localización, surtido, verificación y empaque.', 0),
(13, 7, 'EMB_DESPACHO', 'Carga y despacho', 'Verificación, carga y despacho de pedidos.', 0)
ON DUPLICATE KEY UPDATE
    department_id = VALUES(department_id),
    area_name = VALUES(area_name),
    description = VALUES(description),
    is_management_area = VALUES(is_management_area);

-- ---------------------------------------------------------------------------
-- 8. Plantilla ficticia de 51 colaboradores
-- ---------------------------------------------------------------------------
INSERT INTO employees
(employee_id, employee_code, full_name, department_id, work_area_id, job_title, hire_date)
VALUES
(1, 'EMP001', 'Ana Sofía Martínez López', 1, 1, 'Coordinadora de Recursos Humanos', '2021-03-15'),
(2, 'EMP002', 'Diego Alejandro Torres Ruiz', 1, 1, 'Analista de Reclutamiento y Selección', '2022-08-01'),
(3, 'EMP003', 'Fernanda Castillo Gómez', 1, 1, 'Analista de Capacitación y Desarrollo', '2020-11-09'),
(4, 'EMP004', 'Luis Fernando Ríos Vega', 1, 1, 'Generalista de Recursos Humanos', '2023-05-22'),
(5, 'EMP005', 'Patricia Hernández Mora', 2, 2, 'Coordinadora de Contabilidad y Finanzas', '2019-02-18'),
(6, 'EMP006', 'Jorge Alberto Salinas Cruz', 2, 2, 'Contador General', '2018-07-02'),
(7, 'EMP007', 'Gabriela Rangel Soto', 2, 2, 'Analista de Cuentas por Pagar', '2022-01-17'),
(8, 'EMP008', 'Miguel Ángel Ponce Díaz', 2, 2, 'Analista de Cuentas por Cobrar', '2024-04-08'),
(9, 'EMP009', 'Ricardo Navarro Silva', 3, 3, 'Gerente Comercial', '2017-09-11'),
(10, 'EMP010', 'Daniela Flores Méndez', 3, 3, 'Ejecutiva de Ventas', '2021-06-14'),
(11, 'EMP011', 'Emilio Vargas León', 3, 3, 'Ejecutivo de Ventas', '2023-02-06'),
(12, 'EMP012', 'Karen Jiménez Ortiz', 3, 3, 'Analista de Mercadotecnia', '2022-10-03'),
(13, 'EMP013', 'Arturo Campos Reyes', 3, 3, 'Coordinador de Marketing Digital', '2020-04-20'),
(14, 'EMP014', 'Sergio Lozano Pérez', 4, 4, 'Coordinador de Logística', '2018-12-03'),
(15, 'EMP015', 'Paola Medina Castro', 4, 4, 'Planeadora de Materiales', '2022-05-16'),
(16, 'EMP016', 'Óscar Fuentes Lara', 4, 4, 'Analista de Inventarios', '2024-01-29'),
(17, 'EMP017', 'Alejandro Cárdenas Ruiz', 5, 5, 'Director Operativo', '2016-08-01'),
(18, 'EMP018', 'Claudia Espinoza Vega', 5, 6, 'Directora Financiera', '2017-04-17'),
(19, 'EMP019', 'Martín Aguilar Soto', 6, 7, 'Gerente de Producción', '2018-03-12'),
(20, 'EMP020', 'Brenda Salgado Núñez', 6, 8, 'Líder de Corte y Preparación', '2019-06-24'),
(21, 'EMP021', 'Héctor Ramírez Gil', 6, 8, 'Operador de Corte y Preparación', '2023-01-09'),
(22, 'EMP022', 'Valeria Moreno Díaz', 6, 8, 'Operadora de Corte y Preparación', '2024-07-15'),
(23, 'EMP023', 'Raúl Pérez Campos', 6, 8, 'Operador de Corte y Preparación', '2021-11-08'),
(24, 'EMP024', 'Ximena Robles Luna', 6, 8, 'Operadora de Corte y Preparación', '2025-02-10'),
(25, 'EMP025', 'Iván Cabrera Ortiz', 6, 8, 'Operador de Corte y Preparación', '2020-09-21'),
(26, 'EMP026', 'Mónica Serrano Cruz', 6, 8, 'Operadora de Corte y Preparación', '2022-12-05'),
(27, 'EMP027', 'Eduardo Navarro Ríos', 6, 9, 'Líder de Maquinado y Conformado', '2019-10-14'),
(28, 'EMP028', 'Laura Delgado Mora', 6, 9, 'Operadora de Maquinado y Conformado', '2022-02-28'),
(29, 'EMP029', 'Francisco Rojas Silva', 6, 9, 'Operador de Maquinado y Conformado', '2020-06-08'),
(30, 'EMP030', 'Karla Fuentes León', 6, 9, 'Operadora de Maquinado y Conformado', '2024-09-02'),
(31, 'EMP031', 'Daniel Ortega Vázquez', 6, 9, 'Operador de Maquinado y Conformado', '2021-04-19'),
(32, 'EMP032', 'Abril Mendoza Solís', 6, 9, 'Operadora de Maquinado y Conformado', '2025-05-12'),
(33, 'EMP033', 'José Manuel Reyes Paredes', 6, 9, 'Operador de Maquinado y Conformado', '2023-08-07'),
(34, 'EMP034', 'Gabriela Peña Torres', 6, 10, 'Líder de Ensamble y Acabado', '2018-11-26'),
(35, 'EMP035', 'Pablo Herrera Ruiz', 6, 10, 'Operador de Ensamble y Acabado', '2021-01-18'),
(36, 'EMP036', 'Natalia Campos Vega', 6, 10, 'Operadora de Ensamble y Acabado', '2022-09-12'),
(37, 'EMP037', 'Andrés Molina Cruz', 6, 10, 'Operador de Ensamble y Acabado', '2020-03-02'),
(38, 'EMP038', 'Fernanda Ortiz Lara', 6, 10, 'Operadora de Ensamble y Acabado', '2024-05-20'),
(39, 'EMP039', 'César Romero Díaz', 6, 10, 'Operador de Ensamble y Acabado', '2023-11-13'),
(40, 'EMP040', 'Lucía Aguilar Méndez', 6, 10, 'Operadora de Ensamble y Acabado', '2025-07-07'),
(41, 'EMP041', 'Esteban Castillo Romero', 7, 11, 'Gerente de Embarques', '2019-01-07'),
(42, 'EMP042', 'Vanessa Torres Medina', 7, 12, 'Líder de Preparación de Pedidos', '2020-08-17'),
(43, 'EMP043', 'Marco Antonio León Silva', 7, 12, 'Operador de Preparación de Pedidos', '2021-06-28'),
(44, 'EMP044', 'Sofía Ríos Hernández', 7, 12, 'Operadora de Preparación de Pedidos', '2023-03-13'),
(45, 'EMP045', 'Luis Miguel Paredes Cruz', 7, 12, 'Operador de Preparación de Pedidos', '2024-10-21'),
(46, 'EMP046', 'Camila Ortega Soto', 7, 12, 'Operadora de Preparación de Pedidos', '2025-01-13'),
(47, 'EMP047', 'Ricardo Fuentes Mora', 7, 13, 'Líder de Carga y Despacho', '2021-02-15'),
(48, 'EMP048', 'Alan Jiménez Reyes', 7, 13, 'Operador de Carga y Despacho', '2022-06-06'),
(49, 'EMP049', 'Regina Salas Vargas', 7, 13, 'Operadora de Carga y Despacho', '2023-09-18'),
(50, 'EMP050', 'David Núñez Campos', 7, 13, 'Operador de Carga y Despacho', '2024-02-12'),
(51, 'EMP051', 'Elena Márquez Ruiz', 7, 13, 'Operadora de Carga y Despacho', '2025-04-28')

ON DUPLICATE KEY UPDATE
    employee_code = VALUES(employee_code),
    full_name = VALUES(full_name),
    department_id = VALUES(department_id),
    work_area_id = VALUES(work_area_id),
    job_title = VALUES(job_title),
    hire_date = VALUES(hire_date);

-- ---------------------------------------------------------------------------
-- 9. Catálogo inicial de competencias (5 por cada área)
-- ---------------------------------------------------------------------------
INSERT INTO competencies
(competency_id, work_area_id, competency_code, competency_name, description, sort_order)
VALUES
(1, 1, 'RH_RECLUTAMIENTO', 'Reclutamiento y selección', 'Publicar vacantes, filtrar candidatos y participar en entrevistas.', 1),
(2, 1, 'RH_EXPEDIENTES', 'Administración de expedientes', 'Integrar, actualizar y resguardar expedientes del personal.', 2),
(3, 1, 'RH_INDUCCION', 'Inducción de personal', 'Coordinar y ejecutar la inducción de nuevos colaboradores.', 3),
(4, 1, 'RH_CAPACITACION', 'Administración de capacitación', 'Detectar necesidades, coordinar cursos y conservar evidencias.', 4),
(5, 1, 'RH_DESEMPENO', 'Evaluación del desempeño', 'Apoyar procesos de evaluación, seguimiento y retroalimentación.', 5),
(6, 2, 'FIN_CXP', 'Cuentas por pagar', 'Validar facturas y programar pagos a proveedores.', 1),
(7, 2, 'FIN_CXC', 'Cuentas por cobrar', 'Registrar y dar seguimiento a saldos y cobranza.', 2),
(8, 2, 'FIN_CONCILIACION', 'Conciliaciones bancarias', 'Comparar movimientos bancarios contra registros contables.', 3),
(9, 2, 'FIN_PRESUPUESTO', 'Control presupuestal', 'Dar seguimiento a presupuestos y variaciones.', 4),
(10, 2, 'FIN_REPORTES', 'Reportes financieros', 'Preparar reportes contables y financieros.', 5),
(11, 3, 'COM_PROSPECCION', 'Prospección de clientes', 'Identificar prospectos y generar oportunidades comerciales.', 1),
(12, 3, 'COM_COTIZACIONES', 'Elaboración de cotizaciones', 'Preparar propuestas comerciales y cotizaciones.', 2),
(13, 3, 'COM_SEGUIMIENTO', 'Seguimiento comercial', 'Dar seguimiento a oportunidades, pedidos y clientes.', 3),
(14, 3, 'COM_CAMPANAS', 'Ejecución de campañas', 'Planear y ejecutar campañas de mercadotecnia.', 4),
(15, 3, 'COM_ANALISIS', 'Análisis de indicadores comerciales', 'Analizar ventas, conversión y resultados de campañas.', 5),
(16, 4, 'LOG_RECEPCION', 'Recepción de materiales', 'Verificar y registrar la recepción de materiales.', 1),
(17, 4, 'LOG_INVENTARIOS', 'Control de inventarios', 'Registrar existencias y realizar conteos.', 2),
(18, 4, 'LOG_ABASTECIMIENTO', 'Abastecimiento', 'Coordinar requerimientos y reposición de materiales.', 3),
(19, 4, 'LOG_ALMACEN', 'Administración de almacenes', 'Organizar ubicaciones, movimientos y resguardo.', 4),
(20, 4, 'LOG_TRANSPORTE', 'Planificación de transporte', 'Programar rutas, unidades y entregas.', 5),
(21, 5, 'DIR_OP_PLANEACION', 'Planeación operativa', 'Definir prioridades y planes de operación.', 1),
(22, 5, 'DIR_OP_RECURSOS', 'Administración de recursos', 'Asignar y optimizar recursos humanos y materiales.', 2),
(23, 5, 'DIR_OP_KPIS', 'Seguimiento de indicadores operativos', 'Revisar resultados y tomar acciones sobre indicadores.', 3),
(24, 5, 'DIR_OP_MEJORA', 'Mejora continua', 'Impulsar proyectos de eficiencia y mejora.', 4),
(25, 5, 'DIR_OP_LIDERAZGO', 'Liderazgo organizacional', 'Alinear equipos y comunicar objetivos estratégicos.', 5),
(26, 6, 'DIR_FIN_PLANEACION', 'Planeación financiera', 'Definir proyecciones y estrategias financieras.', 1),
(27, 6, 'DIR_FIN_PRESUPUESTO', 'Administración presupuestal', 'Autorizar y monitorear presupuestos.', 2),
(28, 6, 'DIR_FIN_COSTOS', 'Análisis de costos', 'Evaluar costos, márgenes y rentabilidad.', 3),
(29, 6, 'DIR_FIN_INVERSIONES', 'Evaluación de inversiones', 'Analizar riesgos y retornos de proyectos.', 4),
(30, 6, 'DIR_FIN_CONTROL', 'Control financiero', 'Supervisar controles, cumplimiento y reportes financieros.', 5),
(31, 7, 'PG_PLAN', 'Planeación de producción', 'Programar capacidad, recursos y prioridades de producción.', 1),
(32, 7, 'PG_KPI', 'Seguimiento de indicadores de producción', 'Analizar productividad, eficiencia, scrap y cumplimiento.', 2),
(33, 7, 'PG_PERSONAL', 'Gestión de personal operativo', 'Coordinar turnos, asignaciones y desarrollo del equipo.', 3),
(34, 7, 'PG_MEJORA', 'Mejora continua de procesos', 'Liderar iniciativas para reducir desperdicios y variación.', 4),
(35, 7, 'PG_SEGURIDAD', 'Seguridad y cumplimiento', 'Asegurar prácticas seguras y cumplimiento de procedimientos.', 5),
(36, 8, 'PC_MATERIALES', 'Identificación de materias primas', 'Identificar materiales y verificar especificaciones.', 1),
(37, 8, 'PC_ORDENES', 'Interpretación de órdenes de producción', 'Leer órdenes, planos e instrucciones de trabajo.', 2),
(38, 8, 'PC_PREPARACION', 'Preparación y ajuste de materiales', 'Preparar materiales y parámetros previos al corte.', 3),
(39, 8, 'PC_CORTE', 'Operación de equipos de corte', 'Operar equipos de corte conforme a instrucciones y seguridad.', 4),
(40, 8, 'PC_INSPECCION', 'Inspección dimensional', 'Verificar dimensiones y condiciones del material cortado.', 5),
(41, 9, 'PM_MAQUINA', 'Preparación y ajuste de maquinaria', 'Preparar máquinas, herramientas y dispositivos.', 1),
(42, 9, 'PM_OPERACION', 'Operación de equipos de maquinado', 'Operar equipos de maquinado y conformado.', 2),
(43, 9, 'PM_PARAMETROS', 'Control de parámetros de operación', 'Configurar y vigilar parámetros del proceso.', 3),
(44, 9, 'PM_CALIDAD', 'Inspección de calidad en proceso', 'Verificar características de calidad durante el proceso.', 4),
(45, 9, 'PM_DEFECTOS', 'Identificación de defectos', 'Detectar, registrar y escalar defectos del proceso.', 5),
(46, 10, 'PE_INSTRUCCIONES', 'Interpretación de instrucciones de ensamble', 'Leer instrucciones, secuencias y especificaciones.', 1),
(47, 10, 'PE_HERRAMIENTAS', 'Uso de herramientas y equipos', 'Utilizar herramientas y equipos de ensamble de forma segura.', 2),
(48, 10, 'PE_ENSAMBLE', 'Ensamble de componentes', 'Ensamblar componentes conforme a estándar.', 3),
(49, 10, 'PE_INSPECCION', 'Inspección de producto terminado', 'Verificar calidad y funcionalidad del producto terminado.', 4),
(50, 10, 'PE_ACABADO', 'Procesos de acabado y limpieza', 'Realizar acabados, limpieza y preparación final.', 5),
(51, 11, 'EG_PLAN', 'Planeación de embarques', 'Programar recursos, prioridades y ventanas de despacho.', 1),
(52, 11, 'EG_KPI', 'Seguimiento de indicadores de embarques', 'Analizar entregas a tiempo, exactitud y productividad.', 2),
(53, 11, 'EG_PERSONAL', 'Gestión de personal de embarques', 'Coordinar turnos, cargas de trabajo y desarrollo del equipo.', 3),
(54, 11, 'EG_MEJORA', 'Mejora continua de embarques', 'Optimizar preparación, carga y despacho.', 4),
(55, 11, 'EG_SEGURIDAD', 'Seguridad en embarques', 'Asegurar prácticas seguras y cumplimiento de procedimientos.', 5),
(56, 12, 'EP_LOCALIZACION', 'Identificación y localización de productos', 'Ubicar productos y validar códigos o referencias.', 1),
(57, 12, 'EP_SURTIDO', 'Surtido de pedidos', 'Recolectar productos conforme a la orden.', 2),
(58, 12, 'EP_VERIFICACION', 'Verificación de cantidades y materiales', 'Confirmar cantidades, modelos y condiciones.', 3),
(59, 12, 'EP_EMPAQUE', 'Empaque y etiquetado', 'Empacar, proteger y etiquetar los pedidos.', 4),
(60, 12, 'EP_REGISTRO', 'Registro de movimientos', 'Registrar surtidos y movimientos en el sistema.', 5),
(61, 13, 'ED_DOCUMENTOS', 'Documentación de embarque', 'Validar documentos, listas y requisitos de envío.', 1),
(62, 13, 'ED_CARGA', 'Organización y distribución de cargas', 'Acomodar cargas considerando secuencia y seguridad.', 2),
(63, 13, 'ED_EQUIPOS', 'Operación de equipos de carga', 'Utilizar equipos de carga conforme a autorización.', 3),
(64, 13, 'ED_INSPECCION', 'Inspección previa al despacho', 'Verificar mercancía, unidad y condiciones de salida.', 4),
(65, 13, 'ED_ENTREGAS', 'Seguimiento de entregas', 'Dar seguimiento al despacho y confirmación de entrega.', 5)

ON DUPLICATE KEY UPDATE
    competency_name = VALUES(competency_name),
    description = VALUES(description),
    sort_order = VALUES(sort_order);

-- ---------------------------------------------------------------------------
-- 10. Evaluación inicial demostrativa: niveles aleatorios I, L, U u O
-- ---------------------------------------------------------------------------
-- Cada colaborador recibe una evaluación para cada competencia de su área.
-- RAND() genera la distribución al primer llenado. INSERT IGNORE conserva los
-- niveles existentes cuando el script se vuelve a ejecutar.
INSERT IGNORE INTO employee_competencies
(employee_id, work_area_id, competency_id, iluo_level, evaluation_date, evaluator_name, observations)
SELECT
    e.employee_id,
    e.work_area_id,
    c.competency_id,
    ELT(1 + FLOOR(RAND() * 4), 'I', 'L', 'U', 'O') AS iluo_level,
    DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 365) DAY) AS evaluation_date,
    'Evaluación inicial de demostración' AS evaluator_name,
    'Nivel ficticio asignado aleatoriamente para probar la matriz; sustituir por evaluación real.' AS observations
FROM employees e
INNER JOIN competencies c ON c.work_area_id = e.work_area_id
WHERE e.employment_status = 'Activo';

-- ---------------------------------------------------------------------------
-- 11. Cursos de ejemplo y relación con competencias
-- ---------------------------------------------------------------------------
INSERT INTO courses
(course_id, course_code, course_name, description, modality, duration_hours)
VALUES
(1, 'CUR-001', 'Seguridad y salud en el trabajo', 'Prácticas seguras, identificación de riesgos y prevención.', 'Presencial', 4.00),
(2, 'CUR-002', 'Fundamentos de 5S y orden en el puesto', 'Organización, limpieza y disciplina en el área de trabajo.', 'Presencial', 3.00),
(3, 'CUR-003', 'Calidad e inspección de procesos', 'Criterios de inspección, registro de defectos y acciones.', 'Hibrida', 5.00),
(4, 'CUR-004', 'Liderazgo para mandos operativos', 'Comunicación, asignación de tareas y seguimiento del equipo.', 'Hibrida', 6.00),
(5, 'CUR-005', 'Excel para análisis de datos', 'Uso de hojas de cálculo para analizar información e indicadores.', 'Virtual', 6.00),
(6, 'CUR-006', 'Gestión de inventarios y almacenes', 'Recepción, conteos, ubicaciones y control de existencias.', 'Presencial', 4.00),
(7, 'CUR-007', 'Servicio y seguimiento a clientes', 'Seguimiento de solicitudes, pedidos y entregas.', 'Virtual', 3.00),
(8, 'CUR-008', 'Inducción a procesos internos', 'Conocimiento de políticas, procesos y canales internos.', 'Virtual', 2.00)
ON DUPLICATE KEY UPDATE
    course_name = VALUES(course_name),
    description = VALUES(description),
    modality = VALUES(modality),
    duration_hours = VALUES(duration_hours);

-- Relacionamos cursos con las competencias a las que pueden contribuir.
INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido después de capacitación.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'PC_CORTE', 'PM_OPERACION', 'PE_HERRAMIENTAS', 'EP_EMPAQUE', 'ED_EQUIPOS', 'PG_SEGURIDAD', 'EG_SEGURIDAD'
)
WHERE cr.course_code = 'CUR-001';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido después de capacitación.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'PC_PREPARACION', 'PM_MAQUINA', 'PE_HERRAMIENTAS', 'EP_EMPAQUE', 'ED_CARGA'
)
WHERE cr.course_code = 'CUR-002';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido después de capacitación.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'PC_INSPECCION', 'PM_CALIDAD', 'PM_DEFECTOS', 'PE_INSPECCION', 'EP_VERIFICACION', 'ED_INSPECCION'
)
WHERE cr.course_code = 'CUR-003';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'O', 'Nivel objetivo sugerido para roles de liderazgo.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'PG_PERSONAL', 'PG_KPI', 'EG_PERSONAL', 'EG_KPI', 'DIR_OP_LIDERAZGO', 'RH_DESEMPENO'
)
WHERE cr.course_code = 'CUR-004';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido para análisis y reportes.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'FIN_REPORTES', 'COM_ANALISIS', 'LOG_INVENTARIOS', 'RH_CAPACITACION', 'PG_KPI', 'EG_KPI'
)
WHERE cr.course_code = 'CUR-005';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido para operación logística.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'LOG_RECEPCION', 'LOG_INVENTARIOS', 'LOG_ALMACEN', 'LOG_ABASTECIMIENTO', 'EP_LOCALIZACION', 'EP_REGISTRO'
)
WHERE cr.course_code = 'CUR-006';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido para atención y seguimiento.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'COM_PROSPECCION', 'COM_SEGUIMIENTO', 'COM_COTIZACIONES', 'LOG_TRANSPORTE', 'ED_ENTREGAS'
)
WHERE cr.course_code = 'CUR-007';

INSERT IGNORE INTO course_competencies (course_id, competency_id, target_iluo_level, notes)
SELECT cr.course_id, cp.competency_id, 'U', 'Nivel objetivo sugerido para integración de personal.'
FROM courses cr
JOIN competencies cp ON cp.competency_code IN (
    'RH_INDUCCION', 'RH_EXPEDIENTES', 'DIR_OP_RECURSOS'
)
WHERE cr.course_code = 'CUR-008';

-- ---------------------------------------------------------------------------
-- 12. Vistas para facilitar consultas del backend y del Dashboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_employee_competency_matrix AS
SELECT
    e.employee_id,
    e.employee_code,
    e.full_name,
    e.job_title,
    e.hire_date,
    d.department_id,
    d.department_name,
    wa.work_area_id,
    wa.area_name,
    c.competency_id,
    c.competency_code,
    c.competency_name,
    ec.assessment_id,
    ec.iluo_level,
    ec.evaluation_date,
    ec.evaluator_name,
    ec.observations
FROM employees e
JOIN departments d ON d.department_id = e.department_id
JOIN work_areas wa ON wa.work_area_id = e.work_area_id
JOIN competencies c ON c.work_area_id = e.work_area_id
LEFT JOIN employee_competencies ec
    ON ec.employee_id = e.employee_id
   AND ec.competency_id = c.competency_id;

CREATE OR REPLACE VIEW vw_area_iluo_summary AS
SELECT
    d.department_id,
    d.department_name,
    wa.work_area_id,
    wa.area_name,
    COUNT(DISTINCT e.employee_id) AS employee_count,
    COUNT(ec.assessment_id) AS total_assessments,
    SUM(CASE WHEN ec.iluo_level = 'I' THEN 1 ELSE 0 END) AS level_i_count,
    SUM(CASE WHEN ec.iluo_level = 'L' THEN 1 ELSE 0 END) AS level_l_count,
    SUM(CASE WHEN ec.iluo_level = 'U' THEN 1 ELSE 0 END) AS level_u_count,
    SUM(CASE WHEN ec.iluo_level = 'O' THEN 1 ELSE 0 END) AS level_o_count,
    ROUND(
        100 * SUM(CASE WHEN ec.iluo_level IN ('U', 'O') THEN 1 ELSE 0 END)
        / NULLIF(COUNT(ec.assessment_id), 0), 1
    ) AS proficiency_percent
FROM departments d
JOIN work_areas wa ON wa.department_id = d.department_id
LEFT JOIN employees e
    ON e.work_area_id = wa.work_area_id
   AND e.employment_status = 'Activo'
LEFT JOIN employee_competencies ec ON ec.employee_id = e.employee_id
GROUP BY d.department_id, d.department_name, wa.work_area_id, wa.area_name;

CREATE OR REPLACE VIEW vw_department_iluo_summary AS
SELECT
    d.department_id,
    d.department_name,
    COUNT(DISTINCT e.employee_id) AS employee_count,
    COUNT(ec.assessment_id) AS total_assessments,
    SUM(CASE WHEN ec.iluo_level = 'I' THEN 1 ELSE 0 END) AS level_i_count,
    SUM(CASE WHEN ec.iluo_level = 'L' THEN 1 ELSE 0 END) AS level_l_count,
    SUM(CASE WHEN ec.iluo_level = 'U' THEN 1 ELSE 0 END) AS level_u_count,
    SUM(CASE WHEN ec.iluo_level = 'O' THEN 1 ELSE 0 END) AS level_o_count,
    ROUND(
        100 * SUM(CASE WHEN ec.iluo_level IN ('U', 'O') THEN 1 ELSE 0 END)
        / NULLIF(COUNT(ec.assessment_id), 0), 1
    ) AS proficiency_percent
FROM departments d
LEFT JOIN employees e
    ON e.department_id = d.department_id
   AND e.employment_status = 'Activo'
LEFT JOIN employee_competencies ec ON ec.employee_id = e.employee_id
GROUP BY d.department_id, d.department_name;

-- ---------------------------------------------------------------------------
-- 13. Consultas de comprobación (se muestran al ejecutar el script)
-- ---------------------------------------------------------------------------
SELECT 'Departamentos' AS dato, COUNT(*) AS total FROM departments
UNION ALL
SELECT 'Áreas de trabajo', COUNT(*) FROM work_areas
UNION ALL
SELECT 'Colaboradores', COUNT(*) FROM employees
UNION ALL
SELECT 'Competencias', COUNT(*) FROM competencies
UNION ALL
SELECT 'Evaluaciones ILUO', COUNT(*) FROM employee_competencies
UNION ALL
SELECT 'Cursos', COUNT(*) FROM courses
UNION ALL
SELECT 'Relaciones curso-competencia', COUNT(*) FROM course_competencies;

SELECT
    d.department_name AS departamento,
    COUNT(e.employee_id) AS colaboradores
FROM departments d
LEFT JOIN employees e ON e.department_id = d.department_id
GROUP BY d.department_id, d.department_name
ORDER BY d.department_id;

SELECT
    wa.area_name AS area,
    COUNT(e.employee_id) AS colaboradores
FROM work_areas wa
LEFT JOIN employees e ON e.work_area_id = wa.work_area_id
GROUP BY wa.work_area_id, wa.area_name
ORDER BY wa.work_area_id;

SELECT * FROM vw_department_iluo_summary ORDER BY department_id;

-- Ejemplo: consultar la matriz de un área (Corte y preparación de materiales).
SELECT employee_code, full_name, competency_name, iluo_level
FROM vw_employee_competency_matrix
WHERE work_area_id = 8
ORDER BY full_name, competency_id;

-- FIN DEL SCRIPT
