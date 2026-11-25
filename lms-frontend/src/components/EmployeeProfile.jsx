import { useEffect, useMemo, useState } from 'react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

import {
  X,
  UserRound,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  LoaderCircle
} from 'lucide-react';

import './EmployeeProfile.css';

const API_URL = import.meta.env.VITE_API_URL;


// Configuración de niveles ILUO

const LEVELS = {
  I: {
    name: 'Inicial',
    color: '#df923e',
    className: 'profile-i'
  },

  L: {
    name: 'Limitado',
    color: '#c29a26',
    className: 'profile-l'
  },

  U: {
    name: 'Autónomo',
    color: '#32a36d',
    className: 'profile-u'
  },

  O: {
    name: 'Orientador',
    color: '#6958cb',
    className: 'profile-o'
  }
};


const formatDate = (date) => {

  if (!date) return '—';

  return new Date(`${date.substring(0, 10)}T00:00:00`)
    .toLocaleDateString('es-MX');

};


function EmployeeProfile({ employee, onClose }) {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');


  // CONSULTAR EVALUACIONES DEL COLABORADOR

  useEffect(() => {

    const controller = new AbortController();

    const fetchProfile = async () => {

      try {

        setLoading(true);
        setError('');

        const response = await fetch(

          `${API_URL}/areas/${employee.work_area_id}/competencies`,

          { signal: controller.signal }

        );

        if (!response.ok) {

          throw new Error(
            `Error HTTP: ${response.status}`
          );

        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {

          throw new Error(
            'No fue posible consultar las competencias.'
          );

        }


        // Filtrar únicamente las evaluaciones de este colaborador

        const employeeRecords = result.data.filter(

          record =>

            Number(record.employee_id) ===
            Number(employee.employee_id)

        );


        setRecords(employeeRecords);

        console.log(
          `Perfil de ${employee.full_name}:`,
          employeeRecords
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


    fetchProfile();

    return () => controller.abort();

  }, [employee.employee_id, employee.work_area_id]);


  // CALCULAR INDICADORES INDIVIDUALES

  const analytics = useMemo(() => {

    const counts = {
      I: 0,
      L: 0,
      U: 0,
      O: 0
    };


    records.forEach(record => {

      const level = String(
        record.iluo_level || ''
      ).toUpperCase();

      if (Object.hasOwn(counts, level)) {

        counts[level]++;

      }

    });


    const total =
      counts.I + counts.L + counts.U + counts.O;

    const domain =
      counts.U + counts.O;

    const gaps =
      counts.I + counts.L;


    const domainPercentage = total

      ? (domain / total) * 100

      : 0;


    const gapPercentage = total

      ? (gaps / total) * 100

      : 0;


    const chartData = Object.entries(LEVELS)

      .map(([level, config]) => ({

        name: `${level} - ${config.name}`,

        value: counts[level],

        color: config.color

      }))

      .filter(item => item.value > 0);


    return {

      counts,

      total,

      domain,

      gaps,

      domainPercentage,

      gapPercentage,

      chartData

    };

  }, [records]);


  return (

    <div
      className="profile-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >

      <div className="employee-profile-modal">


        {/* ENCABEZADO */}

        <div className="profile-header">

          <div className="profile-header-info">

            <div className="profile-avatar">

              <UserRound size={29} />

            </div>

            <div>

              <span>EXPEDIENTE DEL COLABORADOR</span>

              <h2>{employee.full_name}</h2>

              <p>
                {employee.employee_code} · {employee.job_title}
              </p>

            </div>

          </div>


          <button
            className="profile-close"
            onClick={onClose}
          >

            <X size={21} />

          </button>

        </div>


        {/* INFORMACIÓN GENERAL */}

        <section className="profile-info-section">

          <div className="profile-section-title">

            <h3>Información general</h3>

            <span className={`profile-status ${
              employee.employment_status === 'Activo'
                ? 'status-active'
                : 'status-inactive'
            }`}>

              {employee.employment_status}

            </span>

          </div>


          <div className="profile-info-grid">


            <div className="profile-info-item">

              <Building2 size={18} />

              <div>

                <span>Departamento</span>

                <strong>{employee.department_name}</strong>

              </div>

            </div>


            <div className="profile-info-item">

              <BriefcaseBusiness size={18} />

              <div>

                <span>Área de trabajo</span>

                <strong>{employee.area_name}</strong>

              </div>

            </div>


            <div className="profile-info-item">

              <UserRound size={18} />

              <div>

                <span>Puesto</span>

                <strong>{employee.job_title}</strong>

              </div>

            </div>


            <div className="profile-info-item">

              <CalendarDays size={18} />

              <div>

                <span>Fecha de ingreso</span>

                <strong>{formatDate(employee.hire_date)}</strong>

              </div>

            </div>


          </div>

        </section>


        {/* CONTENIDO DE COMPETENCIAS */}

        {loading ? (

          <div className="profile-loading">

            <LoaderCircle size={28} className="profile-spinner" />

            <p>Consultando competencias del colaborador...</p>

          </div>

        ) : error ? (

          <div className="profile-error">

            {error}

          </div>

        ) : (

          <>

            {/* INDICADORES */}

            <section className="profile-kpi-grid">


              <div className="profile-kpi">

                <div className="profile-kpi-icon purple">

                  <ClipboardList size={20} />

                </div>

                <span>Competencias evaluadas</span>

                <strong>{analytics.total}</strong>

              </div>


              <div className="profile-kpi">

                <div className="profile-kpi-icon green">

                  <TrendingUp size={20} />

                </div>

                <span>Dominio U + O</span>

                <strong>
                  {analytics.domainPercentage.toFixed(1)}%
                </strong>

              </div>


              <div className="profile-kpi">

                <div className="profile-kpi-icon orange">

                  <AlertTriangle size={20} />

                </div>

                <span>Brechas I + L</span>

                <strong>
                  {analytics.gapPercentage.toFixed(1)}%
                </strong>

              </div>

            </section>


            {/* GRÁFICA ILUO */}

            <section className="profile-analysis-section">


              <div className="profile-section-title">

                <h3>Distribución de competencias ILUO</h3>

              </div>


              <div className="profile-chart-layout">


                <div className="profile-chart-container">

                  {analytics.total > 0 ? (

                    <>

                      <ResponsiveContainer width="100%" height="100%">

                        <PieChart>

                          <Pie

                            data={analytics.chartData}

                            dataKey="value"

                            nameKey="name"

                            cx="50%"

                            cy="50%"

                            innerRadius={52}

                            outerRadius={79}

                            paddingAngle={3}

                          >

                            {analytics.chartData.map((entry, index) => (

                              <Cell

                                key={`profile-${index}`}

                                fill={entry.color}

                              />

                            ))}

                          </Pie>

                          <Tooltip />

                        </PieChart>

                      </ResponsiveContainer>


                      <div className="profile-chart-center">

                        <strong>{analytics.total}</strong>

                        <span>Evaluaciones</span>

                      </div>

                    </>

                  ) : (

                    <div className="profile-empty-chart">

                      Sin evaluaciones

                    </div>

                  )}

                </div>


                <div className="profile-level-legend">

                  {Object.entries(LEVELS).map(([level, config]) => (

                    <div key={level}>

                      <span
                        className={`profile-level-dot ${config.className}`}
                      >

                        {level}

                      </span>

                      <span>{config.name}</span>

                      <strong>
                        {analytics.counts[level]}
                      </strong>

                    </div>

                  ))}

                </div>


              </div>

            </section>


            {/* DETALLE DE COMPETENCIAS */}

            <section className="profile-competencies-section">


              <div className="profile-section-title">

                <h3>Detalle de competencias</h3>

                <span>
                  {records.length} registros
                </span>

              </div>


              <div className="profile-table-wrapper">

                <table className="profile-table">

                  <thead>

                    <tr>

                      <th>COMPETENCIA</th>

                      <th>NIVEL ILUO</th>

                      <th>EVALUACIÓN</th>

                      <th>EVALUADOR</th>

                    </tr>

                  </thead>


                  <tbody>

                    {records.map(record => {

                      const level =
                        String(record.iluo_level || '').toUpperCase();

                      const config = LEVELS[level];


                      return (

                        <tr key={record.assessment_id}>

                          <td>

                            <strong>
                              {record.competency_name}
                            </strong>

                          </td>


                          <td>

                            {config ? (

                              <span className={`profile-level-badge ${config.className}`}>

                                {level} · {config.name}

                              </span>

                            ) : (

                              <span>Sin evaluar</span>

                            )}

                          </td>


                          <td>
                            {formatDate(record.evaluation_date)}
                          </td>


                          <td>

                            <span className="profile-evaluator">

                              {record.evaluator_name || 'Sin registrar'}

                            </span>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>


                {records.length === 0 && (

                  <div className="profile-no-records">

                    Este colaborador todavía no tiene evaluaciones registradas.

                  </div>

                )}

              </div>

            </section>

          </>

        )}


        <div className="profile-footer">

          LMS · Expediente individual de competencias

        </div>


      </div>

    </div>

  );

}

export default EmployeeProfile;