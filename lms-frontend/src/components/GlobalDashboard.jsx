import { useEffect, useState } from 'react';

import {
  Users,
  Building2,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Activity,
  FileBarChart,
  Truck,
  Layers3,
  PackageCheck,
  Factory,
  Wallet,
  RefreshCw
} from 'lucide-react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis
} from 'recharts';

import './GlobalDashboard.css';


const API_URL = import.meta.env.VITE_API_URL;


// Configuración de departamentos

const DEPARTMENT_META = {
  1: { icon: Users, color: 'purple' },
  2: { icon: Wallet, color: 'blue' },
  3: { icon: Activity, color: 'orange' },
  4: { icon: Truck, color: 'green' },
  5: { icon: Layers3, color: 'red' },
  6: { icon: Factory, color: 'cyan' },
  7: { icon: PackageCheck, color: 'pink' }
};


// Colores ILUO

const ILUO_COLORS = {
  I: '#df923e',
  L: '#c29a26',
  U: '#32a36d',
  O: '#6958cb'
};


function GlobalDashboard({ onSelectDepartment }) {

  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);


  // CONSULTAR DASHBOARD DESDE MYSQL

  useEffect(() => {

    const controller = new AbortController();

    const fetchDashboard = async () => {

      try {

        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/dashboard/summary`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data?.global) {
          throw new Error('No se pudo obtener el resumen general.');
        }

        setDashboard(result.data);

        console.log(
          'Dashboard ejecutivo recibido desde MySQL:',
          result.data
        );

      } catch (err) {

        if (err.name !== 'AbortError') {

          console.error(err);
          setError(err.message);

        }

      } finally {

        if (!controller.signal.aborted) {
          setLoading(false);
        }

      }

    };

    fetchDashboard();

    return () => controller.abort();

  }, [refreshKey]);


  // ESTADOS DE CARGA

  if (loading) {

    return (

      <div className="global-loading">

        <RefreshCw size={28} className="global-spinner" />

        <p>Generando indicadores organizacionales...</p>

      </div>

    );

  }


  if (error) {

    return (

      <div className="global-error">

        <AlertTriangle size={35} />

        <h3>No fue posible cargar el Dashboard</h3>

        <p>{error}</p>

        <button onClick={() => setRefreshKey(v => v + 1)}>
          <RefreshCw size={16} />
          Reintentar
        </button>

      </div>

    );

  }


  const global = dashboard.global;

  const departments = dashboard.departments || [];

  const totalGaps =
    global.level_i_count + global.level_l_count;

  const totalDomain =
    global.level_u_count + global.level_o_count;

  const gapPercentage = global.total_assessments

    ? (totalGaps / global.total_assessments) * 100

    : 0;


  // DATOS PARA GRÁFICA ILUO

  const iluoData = [

    {
      name: 'I - Inicial',
      value: global.level_i_count,
      color: ILUO_COLORS.I
    },

    {
      name: 'L - Limitado',
      value: global.level_l_count,
      color: ILUO_COLORS.L
    },

    {
      name: 'U - Autónomo',
      value: global.level_u_count,
      color: ILUO_COLORS.U
    },

    {
      name: 'O - Orientador',
      value: global.level_o_count,
      color: ILUO_COLORS.O
    }

  ].filter(item => item.value > 0);


  return (

    <div className="global-dashboard">


      {/* BIENVENIDA */}

      <section className="global-welcome">

        <div>

          <span className="global-welcome-tag">
            <Activity size={14} />
            INTELIGENCIA ORGANIZACIONAL
          </span>

          <h2>Desarrollo del talento y competencias</h2>

          <p>
            Monitorea el dominio de competencias, identifica brechas
            y descubre oportunidades de desarrollo en toda la organización.
          </p>

        </div>

        <div className="global-welcome-icon">
          <TrendingUp size={70} />
        </div>

      </section>


      {/* INDICADORES PRINCIPALES */}

      <section className="global-kpi-grid">


        <div className="global-kpi-card">

          <div className="global-kpi-icon purple">
            <Users size={22} />
          </div>

          <span>Colaboradores</span>

          <h3>
            {global.total_employees.toLocaleString('es-MX')}
          </h3>

          <small>Plantilla organizacional</small>

        </div>


        <div className="global-kpi-card">

          <div className="global-kpi-icon blue">
            <Building2 size={22} />
          </div>

          <span>Departamentos</span>

          <h3>{departments.length}</h3>

          <small>Estructura organizacional</small>

        </div>


        <div className="global-kpi-card">

          <div className="global-kpi-icon orange">
            <ClipboardList size={22} />
          </div>

          <span>Evaluaciones</span>

          <h3>
            {global.total_assessments.toLocaleString('es-MX')}
          </h3>

          <small>Evaluaciones registradas</small>

        </div>


        <div className="global-kpi-card">

          <div className="global-kpi-icon green">
            <TrendingUp size={22} />
          </div>

          <span>Dominio U + O</span>

          <h3>{Number(global.proficiency_percent).toFixed(1)}%</h3>

          <small>
            {totalDomain} evaluaciones
          </small>

        </div>


        <div className="global-kpi-card">

          <div className="global-kpi-icon orange-warning">
            <AlertTriangle size={22} />
          </div>

          <span>Brechas I + L</span>

          <h3>{gapPercentage.toFixed(1)}%</h3>

          <small>
            {totalGaps} evaluaciones
          </small>

        </div>


      </section>


      {/* GRÁFICAS GLOBALES */}

      <section className="global-charts-grid">


        {/* DISTRIBUCIÓN ILUO */}

        <div className="global-chart-card">

          <div className="global-chart-heading">

            <h3>Distribución global ILUO</h3>

            <span>Estado de las competencias organizacionales</span>

          </div>


          <div className="global-donut-container">

            <ResponsiveContainer width="100%" height="100%">

              <PieChart>

                <Pie

                  data={iluoData}

                  dataKey="value"

                  nameKey="name"

                  cx="50%"

                  cy="50%"

                  innerRadius={65}

                  outerRadius={100}

                  paddingAngle={3}

                >

                  {iluoData.map((entry, index) => (

                    <Cell
                      key={`iluo-${index}`}
                      fill={entry.color}
                    />

                  ))}

                </Pie>

                <Tooltip />

              </PieChart>

            </ResponsiveContainer>


            <div className="global-donut-center">

              <strong>{global.total_assessments}</strong>

              <span>Evaluaciones</span>

            </div>

          </div>


          <div className="global-iluo-legend">

            {iluoData.map(item => (

              <div key={item.name}>

                <span
                  className="global-legend-dot"
                  style={{ background: item.color }}
                />

                <span>{item.name}</span>

                <strong>{item.value}</strong>

              </div>

            ))}

          </div>

        </div>


        {/* COMPARATIVO DEPARTAMENTAL */}

        <div className="global-chart-card">

          <div className="global-chart-heading">

            <h3>Dominio por departamento</h3>

            <span>Porcentaje de evaluaciones en niveles U + O</span>

          </div>


          <div className="global-bar-container">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart

                data={departments}

                layout="vertical"

                margin={{
                  top: 5,
                  right: 25,
                  left: 10,
                  bottom: 5
                }}

              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis

                  type="number"

                  domain={[0, 100]}

                  tickFormatter={value => `${value}%`}

                  tick={{ fontSize: 10, fill: '#929aaa' }}

                />

                <YAxis

                  type="category"

                  dataKey="department_name"

                  width={145}

                  tick={{ fontSize: 10, fill: '#66738a' }}

                  interval={0}

                />

                <Tooltip

                  formatter={value => [
                    `${Number(value).toFixed(1)}%`,
                    'Dominio'
                  ]}

                />


                <Bar

                  dataKey="proficiency_percent"

                  fill="#6958cb"

                  radius={[0, 6, 6, 0]}

                  barSize={22}

                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


      </section>


      {/* DEPARTAMENTOS INTERACTIVOS */}

      <section className="global-departments-section">


        <div className="global-section-heading">

          <div>

            <h2>Desempeño por departamento</h2>

            <p>
              Selecciona un departamento para explorar sus áreas y matrices ILUO.
            </p>

          </div>

          <span>{departments.length} departamentos</span>

        </div>


        <div className="global-department-grid">

          {departments.map(department => {

            const meta = DEPARTMENT_META[department.department_id] || {
              icon: Building2,
              color: 'blue'
            };

            const Icon = meta.icon;

            const proficiency =
              Number(department.proficiency_percent) || 0;

            const gaps = 100 - proficiency;


            return (

              <button

                key={department.department_id}

                className="global-department-card"

                onClick={() => onSelectDepartment({

                  id: department.department_id,

                  name: department.department_name,

                  employees: department.employee_count

                })}

              >

                <div className="global-department-top">

                  <div className={`global-department-icon ${meta.color}`}>

                    <Icon size={22} />

                  </div>

                  <div>

                    <h3>{department.department_name}</h3>

                    <span>
                      {department.employee_count} colaboradores
                    </span>

                  </div>

                </div>


                <div className="global-department-progress">

                  <div className="progress-label">

                    <span>Dominio</span>

                    <strong>{proficiency.toFixed(1)}%</strong>

                  </div>

                  <div className="progress-track">

                    <div
                      className="progress-fill"
                      style={{ width: `${proficiency}%` }}
                    />

                  </div>

                </div>


                <div className="global-department-bottom">

                  <span>
                    {department.total_assessments} evaluaciones
                  </span>

                  <span className="department-gap">
                    {gaps.toFixed(1)}% brechas
                  </span>

                </div>

              </button>

            );

          })}

        </div>

      </section>


      {/* NOTA METODOLÓGICA */}

      <div className="global-dashboard-note">

        <strong>Interpretación:</strong>

        <span>
          Se considera dominio a los niveles U y O. Los niveles I y L
          representan oportunidades de desarrollo y capacitación.
          Los porcentajes se calculan sobre las evaluaciones registradas.
        </span>

      </div>


    </div>

  );

}

export default GlobalDashboard;