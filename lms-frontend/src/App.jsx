import { useState, useEffect } from 'react';
import CompetencyMatrix from './components/CompetencyMatrix';
import GlobalDashboard from './components/GlobalDashboard';
import GapAnalysis from './components/GapAnalysis';
import EmployeeManagement from './components/EmployeeManagement';
import MatrixExplorer from './components/MatrixExplorer';
import WeatherWidget from './components/WeatherWidget';

import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  Users,
} from 'lucide-react';

import './App.css';

// Dirección de nuestra API REST
const API_URL = import.meta.env.VITE_API_URL;

// Iconos correspondientes a cada departamento
const departmentIcons = {
  RH: Users,
  FIN: FileBarChart,
  COM: Activity,
  LOG: Building2,
  DIR: Layers3,
  PROD: Building2,
  EMB: ClipboardCheck,
};

// Colores de cada departamento
const departmentColors = {
  RH: 'purple',
  FIN: 'blue',
  COM: 'orange',
  LOG: 'green',
  DIR: 'red',
  PROD: 'cyan',
  EMB: 'pink',
};

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Departamentos', icon: Building2 },
  { name: 'Matriz ILUO', icon: Layers3 },
  { name: 'Brechas de capacitación', icon: AlertTriangle },
  { name: 'Colaboradores', icon: Users },
  { name: 'Capacitación', icon: GraduationCap },
  { name: 'Reportes', icon: FileBarChart },
];

function App() {
  const [activeSection, setActiveSection] = useState('Dashboard');

  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const [selectedWorkArea, setSelectedWorkArea] = useState(null);

  // Departamentos provenientes de MySQL
  const [departments, setDepartments] = useState([]);

  // Estados de conexión
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departmentError, setDepartmentError] = useState('');

  // Áreas de trabajo provenientes de MySQL
  const [workAreas, setWorkAreas] = useState([]);

  // Estados de carga y errores
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areaError, setAreaError] = useState('');

  // Consultar departamentos al iniciar la aplicación

  useEffect(() => {

    const controller = new AbortController();

    const fetchDepartments = async () => {

      try {

        setLoadingDepartments(true);
        setDepartmentError('');

        const response = await fetch(
          `${API_URL}/departments`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('No se pudieron obtener los departamentos.');
        }

        // Adaptar los datos de MySQL al formato de nuestros componentes

        const formattedDepartments = result.data.map((department) => ({

          id: department.department_id,

          code: department.department_code,

          name: department.department_name,

          employees: department.employee_count,

          description: department.description,

          icon: departmentIcons[department.department_code] || Building2,

          color: departmentColors[department.department_code] || 'blue'

        }));

        setDepartments(formattedDepartments);

        console.log('Departamentos recibidos desde MySQL:', formattedDepartments);

      } catch (error) {

        if (error.name !== 'AbortError') {

          console.error('Error al consultar departamentos:', error);

          setDepartmentError(error.message);

        }

      } finally {

        if (!controller.signal.aborted) {
          setLoadingDepartments(false);
        }

      }

    };

    fetchDepartments();

    return () => controller.abort();

  }, []);

  // Consultar las áreas del departamento seleccionado

  useEffect(() => {

    if (!selectedDepartment) {
      setWorkAreas([]);
      setAreaError('');
      return;
    }

    const controller = new AbortController();

    const fetchWorkAreas = async () => {

      try {

        setLoadingAreas(true);
        setAreaError('');
        setWorkAreas([]);

        const response = await fetch(
          `${API_URL}/departments/${selectedDepartment.id}/areas`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('No fue posible obtener las áreas de trabajo.');
        }

        setWorkAreas(result.data);

        console.log(
          `Áreas de ${selectedDepartment.name}:`,
          result.data
        );

      } catch (error) {

        if (error.name !== 'AbortError') {

          console.error('Error al consultar áreas:', error);

          setAreaError(error.message);

        }

      } finally {

        if (!controller.signal.aborted) {
          setLoadingAreas(false);
        }

      }

    };

    fetchWorkAreas();

    return () => controller.abort();

  }, [selectedDepartment]);

  const today = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const selectDepartment = (department) => {

    setSelectedDepartment(department);

    setSelectedWorkArea(null);

    setActiveSection('Departamentos');

  };

  return (
    <div className="app-container">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={27} />
          </div>

          <div>
            <h2>LMS</h2>
            <span>COMPETENCIAS</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">MENÚ PRINCIPAL</span>

          <nav className="navigation">

            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  className={
                    activeSection === item.name
                      ? 'nav-item active'
                      : 'nav-item'
                  }
                  onClick={() => {
                    setActiveSection(item.name);
                    setSelectedDepartment(null);
                  }}
                >
                  <Icon size={19} />
                  <span>{item.name}</span>
                </button>
              );
            })}

          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">
            <Activity size={19} />
          </div>

          <div>
            <strong>Learning & Development</strong>
            <span>Gestión de talento</span>
          </div>
        </div>

      </aside>


      {/* CONTENIDO PRINCIPAL */}

      <main className="main-content">

        {/* HEADER */}

        <header className="topbar">

          <div>
            <span className="breadcrumb">
              LMS / {activeSection}
            </span>

            <h1>{activeSection}</h1>
            <p>Gestión de competencias y desarrollo del talento</p>
          </div>

          <div className="header-right">

            <WeatherWidget />

            <div className="date-widget">
              <CalendarDays size={19} />

              <span>{today}</span>
            </div>

          </div>

        </header>

        {loadingDepartments && (
          <div className="api-status">
            Cargando departamentos desde MySQL...
          </div>
        )}

        {departmentError && (
          <div className="api-error">
            No fue posible conectar con el backend: {departmentError}
          </div>
        )}

        {/* DASHBOARD EJECUTIVO DINÁMICO */}

        {activeSection === 'Dashboard' && (

          <GlobalDashboard
            onSelectDepartment={selectDepartment}
          />

        )}

        {/* EXPLORADOR DE MATRICES ILUO */}

        {activeSection === 'Matriz ILUO' && (

          <MatrixExplorer />

        )}

        {/* ANÁLISIS DE BRECHAS */}

        {activeSection === 'Brechas de capacitación' && (

          <GapAnalysis />

        )}


        {/* VISTA DE DEPARTAMENTOS */}

        {activeSection === 'Departamentos' && (

          <section className="departments-section">

            {selectedDepartment ? (

              <>

                <button
                  className="back-button"
                  onClick={() => {

                    if (selectedWorkArea) {

                      setSelectedWorkArea(null);

                    } else {

                      setSelectedDepartment(null);

                    }

                  }}
                >
                  ← {selectedWorkArea
                    ? 'Volver a áreas'
                    : 'Volver a departamentos'}
                </button>

                {selectedWorkArea ? (

                  <CompetencyMatrix
                    workArea={selectedWorkArea}
                  />

                ) : (

                  <div className="section-heading">
                    <div>
                      <h2>{selectedDepartment.name}</h2>

                      <p>
                        {selectedDepartment.employees} colaboradores
                        registrados.
                      </p>
                    </div>
                  </div>

                )}

                {/* ÁREAS DE TRABAJO */}

                {loadingAreas && (

                  <div className="api-status">
                    Cargando áreas de {selectedDepartment.name}...
                  </div>

                )}

                {areaError && (

                  <div className="api-error">
                    Error al consultar las áreas: {areaError}
                  </div>

                )}

                {!loadingAreas && !areaError && workAreas.length > 0 && (

                  <div className="department-grid">

                    {workAreas.map((area) => (

                      <button
                        type="button"
                        key={area.work_area_id}
                        className="area-card"
                        onClick={() => setSelectedWorkArea(area)}
                      >

                        <div className="department-icon blue">
                          <Layers3 size={22} />
                        </div>

                        <div className="area-card-content">

                          <div className="area-card-title">

                            <h3>{area.area_name}</h3>

                            {Boolean(Number(area.is_management_area)) && (

                              <span className="management-badge">
                                Gestión
                              </span>

                            )}

                          </div>

                          <p className="area-description">
                            {area.description}
                          </p>

                          <span className="area-meta">
                            {area.employee_count} colaboradores
                          </span>

                        </div>

                      </button>

                    ))}

                  </div>

                )}

                {!loadingAreas && !areaError && workAreas.length === 0 && (

                  <div className="empty-state">

                    <Layers3 size={35} />

                    <h3>Sin áreas registradas</h3>

                    <p>
                      Este departamento todavía no tiene áreas de trabajo registradas.
                    </p>

                  </div>

                )}

              </>

            ) : (

              <>

                <div className="section-heading">
                  <div>
                    <h2>Selecciona un departamento</h2>

                    <p>
                      Explora la estructura organizacional.
                    </p>
                  </div>
                </div>

                <div className="department-grid">

                  {departments.map((department) => {

                    const Icon = department.icon;

                    return (

                      <button
                        key={department.id}
                        className="department-card"
                        onClick={() => setSelectedDepartment(department)}
                      >

                        <div className={`department-icon ${department.color}`}>
                          <Icon size={23} />
                        </div>

                        <div className="department-info">

                          <h3>{department.name}</h3>

                          <span>
                            {department.employees} colaboradores
                          </span>

                        </div>

                        <ChevronRight size={20} />

                      </button>

                    );

                  })}

                </div>

              </>

            )}

          </section>

        )}

        {/* ADMINISTRACIÓN DE COLABORADORES */}

        {activeSection === 'Colaboradores' && (

          <EmployeeManagement />

        )}


        {/* RESTO DE LOS MÓDULOS */}

        {![
          'Dashboard',
          'Departamentos',
          'Matriz ILUO',
          'Brechas de capacitación',
          'Colaboradores'
        ].includes(activeSection) && (

            <div className="empty-state">

              <GraduationCap size={42} />

              <h2>{activeSection}</h2>

              <p>
                Este módulo se encuentra en construcción.
                Próximamente estará conectado con nuestra API.
              </p>

            </div>

          )}


        {/* FOOTER */}

        <footer className="footer">

          LMS - Sistema de Gestión de Competencias y Capacitación

          <span>Versión 1.0</span>

        </footer>

      </main>

    </div>
  );
}

export default App;