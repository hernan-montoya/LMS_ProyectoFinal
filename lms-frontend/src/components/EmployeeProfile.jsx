import { useEffect, useMemo, useState } from 'react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
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
  LoaderCircle,
  History,
  TrendingDown
} from 'lucide-react';

import './EmployeeProfile.css';
import './EmployeeProfileHistory.css';

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

  return new Date(`${String(date).substring(0, 10)}T00:00:00`)
    .toLocaleDateString('es-MX');

};

const formatDateTime = (date) => {

  if (!date) return 'Fecha no disponible';

  const normalizedDate = String(date).replace(' ', 'T');
  const parsedDate = new Date(normalizedDate);

  if (Number.isNaN(parsedDate.getTime())) return String(date);

  return parsedDate.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

};

const ILUO_VALUES = {
  I: 1,
  L: 2,
  U: 3,
  O: 4
};


function EmployeeProfile({ employee, onClose }) {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  // Historial de modificaciones por evaluación
  const [historyByAssessment, setHistoryByAssessment] = useState({});
  const [selectedHistoryAssessmentId, setSelectedHistoryAssessmentId] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');


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

        // Seleccionar inicialmente la primera competencia con evaluación
        const assessments = employeeRecords.filter(record => record.assessment_id);
        setSelectedHistoryAssessmentId(
          assessments.length ? String(assessments[0].assessment_id) : ''
        );

        // Consultar el historial de cada evaluación sin bloquear el perfil
        setHistoryByAssessment({});
        setHistoryError('');

        if (assessments.length > 0) {
          setLoadingHistory(true);

          const historyResults = await Promise.allSettled(
            assessments.map(async (record) => {
              const historyResponse = await fetch(
                `${API_URL}/assessments/${record.assessment_id}/history`,
                { signal: controller.signal }
              );

              if (!historyResponse.ok) {
                throw new Error(`Error HTTP ${historyResponse.status}`);
              }

              const historyResult = await historyResponse.json();

              if (!historyResult.success || !Array.isArray(historyResult.data)) {
                throw new Error('Respuesta de historial no válida.');
              }

              return {
                assessmentId: String(record.assessment_id),
                assessment: historyResult.assessment,
                data: historyResult.data
              };
            })
          );

          if (!controller.signal.aborted) {
            const historyMap = {};
            let failedRequests = 0;

            historyResults.forEach((result) => {
              if (result.status === 'fulfilled') {
                historyMap[result.value.assessmentId] = result.value;
              } else {
                failedRequests++;
                console.error('Error al consultar historial ILUO:', result.reason);
              }
            });

            setHistoryByAssessment(historyMap);

            if (failedRequests > 0) {
              setHistoryError(
                `No fue posible consultar el historial de ${failedRequests} competencia(s).`
              );
            }

            setLoadingHistory(false);
          }
        } else {
          setLoadingHistory(false);
        }

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
          setLoadingHistory(false);
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

  const selectedHistory = historyByAssessment[selectedHistoryAssessmentId];
  const selectedHistoryEvents = selectedHistory?.data || [];
  const selectedCurrentRecord = records.find(
    record => String(record.assessment_id) === selectedHistoryAssessmentId
  );

  // Preparar la secuencia de niveles para la gráfica.
  // La fecha del nivel previo al primer cambio no se conoce, por eso se etiqueta como Inicio.
  const historyChartData = useMemo(() => {
    if (selectedHistoryEvents.length === 0) return [];

    const firstEvent = selectedHistoryEvents[0];
    const initialLevel = String(firstEvent.previous_iluo_level || '').toUpperCase();

    const points = [];

    if (ILUO_VALUES[initialLevel]) {
      points.push({
        step: 'Inicio',
        level: initialLevel,
        levelValue: ILUO_VALUES[initialLevel],
        dateLabel: 'Nivel previo al primer cambio (fecha no registrada)',
        evaluator: firstEvent.previous_evaluator_name || 'Sin registrar',
        observations: firstEvent.previous_observations || 'Sin observaciones'
      });
    }

    selectedHistoryEvents.forEach((event, index) => {
      const level = String(event.new_iluo_level || '').toUpperCase();

      if (ILUO_VALUES[level]) {
        points.push({
          step: `Cambio ${index + 1}`,
          level,
          levelValue: ILUO_VALUES[level],
          dateLabel: formatDateTime(event.changed_at),
          evaluator: event.new_evaluator_name || 'Sin registrar',
          observations: event.new_observations || 'Sin observaciones'
        });
      }
    });

    return points;
  }, [selectedHistoryEvents]);


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


        {/* HISTORIAL Y EVOLUCIÓN DE COMPETENCIAS */}
        {!loading && !error && (
          <section className="profile-history-section">
            <div className="profile-section-title profile-history-heading">
              <div className="profile-history-title">
                <History size={19} />
                <h3>Historial y evolución de competencias</h3>
              </div>
              <span>{selectedHistoryEvents.length} cambios registrados</span>
            </div>

            <p className="profile-history-description">
              Consulta los cambios de nivel ILUO, evaluadores y observaciones de cada competencia.
            </p>

            <div className="profile-history-selector">
              <label htmlFor="profile-history-competency">Competencia</label>
              <select
                id="profile-history-competency"
                value={selectedHistoryAssessmentId}
                onChange={(event) => setSelectedHistoryAssessmentId(event.target.value)}
                disabled={records.filter(record => record.assessment_id).length === 0}
              >
                {records.filter(record => record.assessment_id).length === 0 ? (
                  <option value="">Sin evaluaciones disponibles</option>
                ) : (
                  records
                    .filter(record => record.assessment_id)
                    .map(record => (
                      <option
                        key={record.assessment_id}
                        value={String(record.assessment_id)}
                      >
                        {record.competency_name}
                      </option>
                    ))
                )}
              </select>
            </div>

            {loadingHistory ? (
              <div className="profile-history-state">
                <LoaderCircle size={22} className="profile-spinner" />
                <span>Consultando historial de evaluaciones...</span>
              </div>
            ) : (
              <>
                {historyError && (
                  <div className="profile-history-error">{historyError}</div>
                )}

                {selectedCurrentRecord && (
                  <div className="profile-current-level">
                    <span>Nivel vigente</span>
                    {LEVELS[String(selectedCurrentRecord.iluo_level || '').toUpperCase()] ? (
                      <strong className={`profile-level-badge ${LEVELS[String(selectedCurrentRecord.iluo_level).toUpperCase()].className}`}>
                        {String(selectedCurrentRecord.iluo_level).toUpperCase()} · {LEVELS[String(selectedCurrentRecord.iluo_level).toUpperCase()].name}
                      </strong>
                    ) : (
                      <strong>Sin evaluar</strong>
                    )}
                    <small>Última evaluación: {formatDate(selectedCurrentRecord.evaluation_date)}</small>
                  </div>
                )}

                {selectedHistoryEvents.length === 0 ? (
                  <div className="profile-history-empty">
                    <TrendingDown size={24} />
                    <strong>Esta competencia todavía no tiene cambios históricos.</strong>
                    <span>Las modificaciones que se realicen a partir de ahora aparecerán en esta sección.</span>
                  </div>
                ) : (
                  <>
                    <div className="profile-history-chart">
                      <div className="profile-history-chart-heading">
                        <h4>Evolución del nivel ILUO</h4>
                        <span>I = 1 · L = 2 · U = 3 · O = 4</span>
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={historyChartData} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="step" />
                          <YAxis
                            domain={[1, 4]}
                            ticks={[1, 2, 3, 4]}
                            tickFormatter={(value) => ({ 1: 'I', 2: 'L', 3: 'U', 4: 'O' }[value] || value)}
                            width={34}
                          />
                          <Tooltip
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel || ''}
                            formatter={(value, _name, item) => [
                              `${item.payload.level} · ${LEVELS[item.payload.level]?.name || ''}`,
                              'Nivel ILUO'
                            ]}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="levelValue"
                            name="Nivel ILUO"
                            stroke="#6958cb"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#6958cb' }}
                            activeDot={{ r: 7 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="profile-history-table-wrapper">
                      <h4>Detalle de modificaciones</h4>
                      <table className="profile-history-table">
                        <thead>
                          <tr>
                            <th>FECHA</th>
                            <th>CAMBIO ILUO</th>
                            <th>EVALUADOR</th>
                            <th>OBSERVACIONES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistoryEvents.map((event) => {
                            const previousLevel = String(event.previous_iluo_level || '').toUpperCase();
                            const newLevelValue = String(event.new_iluo_level || '').toUpperCase();
                            const previousConfig = LEVELS[previousLevel];
                            const newConfig = LEVELS[newLevelValue];

                            return (
                              <tr key={event.history_id}>
                                <td>{formatDateTime(event.changed_at)}</td>
                                <td>
                                  <span className={`profile-level-badge ${previousConfig?.className || ''}`}>
                                    {previousLevel}
                                  </span>
                                  <span className="profile-history-arrow"> → </span>
                                  <span className={`profile-level-badge ${newConfig?.className || ''}`}>
                                    {newLevelValue}
                                  </span>
                                </td>
                                <td>{event.new_evaluator_name || 'Sin registrar'}</td>
                                <td>{event.new_observations || 'Sin observaciones'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="profile-history-note">
              El historial registra modificaciones realizadas desde la incorporación de esta funcionalidad. No reconstruye evaluaciones anteriores que no hayan sido almacenadas históricamente.
            </div>
          </section>
        )}

        <div className="profile-footer">

          LMS · Expediente individual de competencias

        </div>


      </div>

    </div>

  );

}

export default EmployeeProfile;