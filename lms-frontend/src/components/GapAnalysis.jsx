import { useEffect, useMemo, useState } from 'react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

import {
  AlertTriangle,
  ClipboardList,
  Target,
  TrendingDown,
  Filter,
  RefreshCw,
  Search,
  RotateCcw
} from 'lucide-react';

import './GapAnalysis.css';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';


// Clasificación de prioridades

const getPriority = (percentage) => {

  if (percentage >= 60) return 'Alta';

  if (percentage >= 30) return 'Media';

  return 'Baja';

};


// Tooltip personalizado

function GapTooltip({ active, payload }) {

  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (

    <div className="gap-tooltip">

      <strong>{item.competency_name}</strong>

      <p>{item.department_name}</p>

      <span>{item.area_name}</span>

      <div className="gap-tooltip-value">

        Brecha: {Number(item.gap_percentage).toFixed(1)}%

      </div>

      <small>
        {item.gap_count} de {item.total_assessments} evaluaciones en I + L
      </small>

    </div>

  );

}


function GapAnalysis() {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [areaFilter, setAreaFilter] = useState('all');

  const [competencyFilter, setCompetencyFilter] = useState('all');

  const [search, setSearch] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);


  // 1. Consultar información desde el backend

  useEffect(() => {

    const controller = new AbortController();

    const fetchGaps = async () => {

      try {

        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/dashboard/gaps`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('No se pudo obtener el análisis de brechas.');
        }

        setRecords(result.data);

        console.log(
          'Análisis de brechas recibido desde MySQL:',
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

    fetchGaps();

    return () => controller.abort();

  }, [refreshKey]);


  // 2. Catálogo de departamentos

  const departments = useMemo(() => {

    const map = new Map();

    records.forEach(record => {

      map.set(
        record.department_id,
        record.department_name
      );

    });

    return Array.from(map, ([id, name]) => ({ id, name }));

  }, [records]);


  // 3. Filtrar por departamento

  const departmentRecords = useMemo(() => {

    return records.filter(record =>

      departmentFilter === 'all' ||

      String(record.department_id) === departmentFilter

    );

  }, [records, departmentFilter]);


  // 4. Catálogo de áreas dependiente del departamento

  const areas = useMemo(() => {

    const map = new Map();

    departmentRecords.forEach(record => {

      map.set(
        record.work_area_id,
        record.area_name
      );

    });

    return Array.from(map, ([id, name]) => ({ id, name }));

  }, [departmentRecords]);


  // 5. Filtrar por área

  const areaRecords = useMemo(() => {

    return departmentRecords.filter(record =>

      areaFilter === 'all' ||

      String(record.work_area_id) === areaFilter

    );

  }, [departmentRecords, areaFilter]);


  // 6. Catálogo de competencias

  const competencies = useMemo(() => {

    const map = new Map();

    areaRecords.forEach(record => {

      map.set(
        record.competency_id,
        record.competency_name
      );

    });

    return Array.from(map, ([id, name]) => ({ id, name }));

  }, [areaRecords]);


  // 7. Filtrado final y buscador

  const filteredRecords = useMemo(() => {

    return areaRecords.filter(record => {

      const matchesCompetency =

        competencyFilter === 'all' ||

        String(record.competency_id) === competencyFilter;


      const text = search.toLowerCase();

      const matchesSearch =

        record.competency_name.toLowerCase().includes(text) ||

        record.department_name.toLowerCase().includes(text) ||

        record.area_name.toLowerCase().includes(text);


      return matchesCompetency && matchesSearch;

    });

  }, [
    areaRecords,
    competencyFilter,
    search
  ]);


  // 8. Calcular indicadores

  const analytics = useMemo(() => {

    const totalCompetencies = filteredRecords.length;

    const totalEvaluations = filteredRecords.reduce(
      (sum, record) => sum + Number(record.total_assessments || 0),
      0
    );

    const gapCount = filteredRecords.reduce(
      (sum, record) => sum + Number(record.gap_count || 0),
      0
    );

    const weightedGap = totalEvaluations

      ? (gapCount / totalEvaluations) * 100

      : 0;


    const highPriority = filteredRecords.filter(
      record => Number(record.gap_percentage) >= 60
    ).length;


    const mediumPriority = filteredRecords.filter(
      record =>
        Number(record.gap_percentage) >= 30 &&
        Number(record.gap_percentage) < 60
    ).length;


    const lowPriority = filteredRecords.filter(
      record => Number(record.gap_percentage) < 30
    ).length;


    return {

      totalCompetencies,

      totalEvaluations,

      gapCount,

      weightedGap,

      highPriority,

      mediumPriority,

      lowPriority

    };

  }, [filteredRecords]);


  // 9. Ranking de competencias

  const ranking = useMemo(() => {

    return [...filteredRecords]

      .sort((a, b) =>

        Number(b.gap_percentage) - Number(a.gap_percentage) ||

        Number(b.gap_count) - Number(a.gap_count) ||

        Number(b.total_assessments) - Number(a.total_assessments)

      )

      .slice(0, 10);

  }, [filteredRecords]);


  // 10. Reiniciar filtros

  const resetFilters = () => {

    setDepartmentFilter('all');

    setAreaFilter('all');

    setCompetencyFilter('all');

    setSearch('');

  };


  // 11. Estados de carga

  if (loading) {

    return (

      <div className="gap-state">

        <RefreshCw className="gap-spinner" size={30} />

        <p>Analizando brechas organizacionales...</p>

      </div>

    );

  }


  if (error) {

    return (

      <div className="gap-state gap-error">

        <AlertTriangle size={35} />

        <h3>No se pudo cargar el análisis</h3>

        <p>{error}</p>

        <button onClick={() => setRefreshKey(v => v + 1)}>
          Reintentar
        </button>

      </div>

    );

  }


  return (

    <div className="gap-analysis">


      {/* ENCABEZADO */}

      <section className="gap-welcome">

        <div>

          <span>
            <Target size={14} />
            INTELIGENCIA DE CAPACITACIÓN
          </span>

          <h2>Análisis de brechas de competencias</h2>

          <p>
            Identifica las competencias que requieren desarrollo
            y establece prioridades de capacitación.
          </p>

        </div>

        <AlertTriangle size={60} />

      </section>


      {/* INDICADORES */}

      <section className="gap-kpi-grid">


        <div className="gap-kpi-card">

          <div className="gap-kpi-icon purple">
            <Target size={22} />
          </div>

          <span>Competencias analizadas</span>

          <h3>{analytics.totalCompetencies}</h3>

          <small>Competencias filtradas</small>

        </div>


        <div className="gap-kpi-card">

          <div className="gap-kpi-icon blue">
            <ClipboardList size={22} />
          </div>

          <span>Evaluaciones</span>

          <h3>{analytics.totalEvaluations}</h3>

          <small>Registros considerados</small>

        </div>


        <div className="gap-kpi-card">

          <div className="gap-kpi-icon orange">
            <AlertTriangle size={22} />
          </div>

          <span>Evaluaciones I + L</span>

          <h3>{analytics.gapCount}</h3>

          <small>Oportunidades de desarrollo</small>

        </div>


        <div className="gap-kpi-card">

          <div className="gap-kpi-icon red">
            <TrendingDown size={22} />
          </div>

          <span>Brecha ponderada</span>

          <h3>{analytics.weightedGap.toFixed(1)}%</h3>

          <small>Sobre las evaluaciones consideradas</small>

        </div>


      </section>


      {/* FILTROS */}

      <section className="gap-filter-card">

        <div className="gap-filter-heading">

          <div>
            <Filter size={18} />

            <h3>Filtros de análisis</h3>
          </div>

          <button onClick={resetFilters}>
            <RotateCcw size={15} />
            Limpiar filtros
          </button>

        </div>


        <div className="gap-filter-grid">


          <div>

            <label>Departamento</label>

            <select

              value={departmentFilter}

              onChange={event => {

                setDepartmentFilter(event.target.value);

                setAreaFilter('all');

                setCompetencyFilter('all');

              }}

            >

              <option value="all">Todos los departamentos</option>

              {departments.map(department => (

                <option key={department.id} value={department.id}>
                  {department.name}
                </option>

              ))}

            </select>

          </div>


          <div>

            <label>Área de trabajo</label>

            <select

              value={areaFilter}

              onChange={event => {

                setAreaFilter(event.target.value);

                setCompetencyFilter('all');

              }}

            >

              <option value="all">Todas las áreas</option>

              {areas.map(area => (

                <option key={area.id} value={area.id}>
                  {area.name}
                </option>

              ))}

            </select>

          </div>


          <div>

            <label>Competencia</label>

            <select

              value={competencyFilter}

              onChange={event =>
                setCompetencyFilter(event.target.value)
              }

            >

              <option value="all">Todas las competencias</option>

              {competencies.map(competency => (

                <option key={competency.id} value={competency.id}>
                  {competency.name}
                </option>

              ))}

            </select>

          </div>


          <div>

            <label>Buscar</label>

            <div className="gap-search">

              <Search size={17} />

              <input

                type="text"

                placeholder="Buscar competencia..."

                value={search}

                onChange={event => setSearch(event.target.value)}

              />

            </div>

          </div>


        </div>

      </section>


      {/* RESUMEN DE PRIORIDADES */}

      <section className="gap-priority-summary">

        <div className="gap-section-heading">

          <div>
            <h3>Clasificación de prioridades</h3>

            <p>
              Distribución de competencias según sus brechas.
            </p>
          </div>

        </div>


        <div className="priority-grid">


          <div className="priority-item priority-high">

            <span>ALTA</span>

            <strong>{analytics.highPriority}</strong>

            <small>60% o más de brecha</small>

          </div>


          <div className="priority-item priority-medium">

            <span>MEDIA</span>

            <strong>{analytics.mediumPriority}</strong>

            <small>30% a 59.9% de brecha</small>

          </div>


          <div className="priority-item priority-low">

            <span>BAJA</span>

            <strong>{analytics.lowPriority}</strong>

            <small>Menos de 30% de brecha</small>

          </div>


        </div>

      </section>


      {/* RANKING */}

      <section className="gap-chart-card">

        <div className="gap-section-heading">

          <div>

            <h3>Top 10: competencias con mayores brechas</h3>

            <p>
              Ranking ordenado por porcentaje de evaluaciones en I + L.
            </p>

          </div>

        </div>


        {ranking.length > 0 ? (

          <div className="gap-ranking-chart">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart

                data={ranking}

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

                  dataKey="competency_name"

                  width={190}

                  interval={0}

                  tickFormatter={value =>

                    value.length > 29
                      ? `${value.substring(0, 26)}...`
                      : value

                  }

                  tick={{ fontSize: 10, fill: '#66738a' }}

                />


                <Tooltip content={<GapTooltip />} />


                <Bar

                  dataKey="gap_percentage"

                  fill="#df923e"

                  radius={[0, 6, 6, 0]}

                  barSize={23}

                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <div className="gap-no-results">
            No hay competencias que coincidan con los filtros.
          </div>

        )}

      </section>


      {/* TABLA DE RESULTADOS */}

      <section className="gap-table-section">


        <div className="gap-section-heading">

          <div>

            <h3>Detalle de competencias</h3>

            <p>
              Distribución de evaluaciones por competencia y prioridad.
            </p>

          </div>

          <span>
            {filteredRecords.length} registros
          </span>

        </div>


        <div className="gap-table-wrapper">

          <table className="gap-table">

            <thead>

              <tr>

                <th>Departamento</th>

                <th>Área</th>

                <th>Competencia</th>

                <th>Muestra</th>

                <th>I</th>

                <th>L</th>

                <th>U</th>

                <th>O</th>

                <th>Brecha</th>

                <th>Prioridad</th>

              </tr>

            </thead>


            <tbody>

              {filteredRecords.map(record => {

                const gap = Number(record.gap_percentage);

                const priority = getPriority(gap);

                return (

                  <tr key={`${record.work_area_id}-${record.competency_id}`}>

                    <td>{record.department_name}</td>

                    <td>{record.area_name}</td>

                    <td className="gap-competency-name">
                      {record.competency_name}
                    </td>

                    <td>
                      n = {record.total_assessments}
                    </td>

                    <td>{record.level_i_count}</td>

                    <td>{record.level_l_count}</td>

                    <td>{record.level_u_count}</td>

                    <td>{record.level_o_count}</td>

                    <td>

                      <strong className="gap-percentage">
                        {gap.toFixed(1)}%
                      </strong>

                    </td>

                    <td>

                      <span className={`priority-badge ${priority.toLowerCase()}`}>
                        {priority}
                      </span>

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>


          {filteredRecords.length === 0 && (

            <div className="gap-no-results">
              No se encontraron registros.
            </div>

          )}

        </div>

      </section>


      {/* NOTA METODOLÓGICA */}

      <div className="gap-methodology-note">

        <strong>Consideración metodológica:</strong>

        Los porcentajes representan la proporción de evaluaciones
        en niveles I y L respecto al total de evaluaciones de cada
        competencia. Es importante considerar el tamaño de muestra
        antes de establecer prioridades de capacitación.

      </div>


    </div>

  );

}

export default GapAnalysis;