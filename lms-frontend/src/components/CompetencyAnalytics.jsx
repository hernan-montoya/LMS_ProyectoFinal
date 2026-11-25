import { useMemo } from 'react';

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

import {
  ClipboardList,
  Users,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

import './CompetencyAnalytics.css';


// Configuración de niveles ILUO

const LEVEL_CONFIG = {
  I: {
    name: 'Inicial',
    color: '#df923e'
  },

  L: {
    name: 'Limitado',
    color: '#c29a26'
  },

  U: {
    name: 'Autónomo',
    color: '#32a36d'
  },

  O: {
    name: 'Orientador',
    color: '#6958cb'
  }
};


// Tooltip personalizado para brechas

function GapTooltip({ active, payload }) {

  if (!active || !payload || !payload.length) {
    return null;
  }

  const item = payload[0].payload;

  return (

    <div className="analytics-tooltip">

      <strong>{item.competencyName}</strong>

      <p>
        {item.gapCount} de {item.evaluatedCount} evaluaciones
        en niveles I y L.
      </p>

      <span>
        Brecha: {item.gapPercentage}%
      </span>

    </div>

  );

}


function CompetencyAnalytics({ records = [] }) {


  // CALCULAR INDICADORES Y ESTADÍSTICAS

  const analytics = useMemo(() => {

    const counts = {
      I: 0,
      L: 0,
      U: 0,
      O: 0
    };

    const employeeIds = new Set();

    const competencyMap = new Map();

    let unrated = 0;


    records.forEach((record) => {

      const level = String(record.iluo_level || '').toUpperCase();

      if (record.employee_id != null) {
        employeeIds.add(record.employee_id);
      }

      // Contabilizar niveles ILUO

      if (Object.hasOwn(counts, level)) {

        counts[level]++;

      } else {

        unrated++;

      }


      // Crear registro de cada competencia

      if (!competencyMap.has(record.competency_id)) {

        competencyMap.set(record.competency_id, {

          competency_id: record.competency_id,

          competencyName: record.competency_name,

          totalRecords: 0,

          evaluatedCount: 0,

          gapCount: 0

        });

      }


      const competency = competencyMap.get(record.competency_id);

      competency.totalRecords++;


      if (Object.hasOwn(counts, level)) {
        competency.evaluatedCount++;
      }


      if (level === 'I' || level === 'L') {
        competency.gapCount++;
      }

    });


    const totalEvaluations =
      counts.I + counts.L + counts.U + counts.O;

    const domainCount =
      counts.U + counts.O;

    const gapCount =
      counts.I + counts.L;


    const domainPercentage = totalEvaluations

      ? Math.round((domainCount / totalEvaluations) * 100)

      : 0;


    const gapPercentage = totalEvaluations

      ? Math.round((gapCount / totalEvaluations) * 100)

      : 0;


    // Datos para gráfica de dona

    const pieData = [

      ...Object.entries(LEVEL_CONFIG).map(([level, config]) => ({

        name: `${level} - ${config.name}`,

        value: counts[level],

        color: config.color

      })),

      {
        name: 'Sin evaluar',
        value: unrated,
        color: '#aeb7c5'
      }

    ].filter(item => item.value > 0);


    // Datos para gráfica de brechas

    const gapData = Array.from(competencyMap.values())

      .map((competency) => ({

        ...competency,

        gapPercentage: competency.evaluatedCount

          ? Math.round(
              (competency.gapCount / competency.evaluatedCount) * 100
            )

          : 0

      }))

      .sort((a, b) => b.gapPercentage - a.gapPercentage);


    return {

      counts,

      totalEvaluations,

      employees: employeeIds.size,

      domainCount,

      gapCount,

      domainPercentage,

      gapPercentage,

      unrated,

      pieData,

      gapData

    };

  }, [records]);


  if (!records.length) {

    return (

      <div className="analytics-empty">

        No hay evaluaciones disponibles para generar estadísticas.

      </div>

    );

  }


  return (

    <section className="competency-analytics">


      {/* ENCABEZADO */}

      <div className="analytics-heading">

        <div>

          <span>ANÁLISIS DE COMPETENCIAS</span>

          <h2>Indicadores de dominio y desarrollo</h2>

          <p>
            Resultados calculados a partir de las evaluaciones ILUO
            registradas en esta área.
          </p>

        </div>

      </div>


      {/* TARJETAS DE INDICADORES */}

      <div className="analytics-kpi-grid">


        <div className="analytics-kpi">

          <div className="analytics-kpi-icon icon-purple">
            <ClipboardList size={22} />
          </div>

          <div>

            <span>Evaluaciones</span>

            <h3>{analytics.totalEvaluations}</h3>

            <small>Registros evaluados</small>

          </div>

        </div>


        <div className="analytics-kpi">

          <div className="analytics-kpi-icon icon-blue">
            <Users size={22} />
          </div>

          <div>

            <span>Colaboradores</span>

            <h3>{analytics.employees}</h3>

            <small>Personas evaluadas</small>

          </div>

        </div>


        <div className="analytics-kpi">

          <div className="analytics-kpi-icon icon-green">
            <TrendingUp size={22} />
          </div>

          <div>

            <span>Dominio U + O</span>

            <h3>{analytics.domainPercentage}%</h3>

            <small>
              {analytics.domainCount} evaluaciones
            </small>

          </div>

        </div>


        <div className="analytics-kpi">

          <div className="analytics-kpi-icon icon-orange">
            <AlertTriangle size={22} />
          </div>

          <div>

            <span>Brechas I + L</span>

            <h3>{analytics.gapPercentage}%</h3>

            <small>
              {analytics.gapCount} evaluaciones
            </small>

          </div>

        </div>


      </div>


      {/* GRÁFICAS */}

      <div className="analytics-charts-grid">


        {/* GRÁFICA DE DISTRIBUCIÓN ILUO */}

        <div className="analytics-chart-card">

          <div className="analytics-card-heading">

            <h3>Distribución ILUO</h3>

            <span>Por nivel de dominio</span>

          </div>


          <div className="donut-chart-container">

            <ResponsiveContainer width="100%" height="100%">

              <PieChart>

                <Pie

                  data={analytics.pieData}

                  dataKey="value"

                  nameKey="name"

                  cx="50%"

                  cy="50%"

                  innerRadius={63}

                  outerRadius={92}

                  paddingAngle={3}

                >

                  {analytics.pieData.map((entry, index) => (

                    <Cell

                      key={`cell-${index}`}

                      fill={entry.color}

                    />

                  ))}

                </Pie>

                <Tooltip />

              </PieChart>

            </ResponsiveContainer>

            <div className="donut-center">

              <strong>{analytics.totalEvaluations}</strong>

              <span>Evaluaciones</span>

            </div>

          </div>


          <div className="analytics-legend">

            {analytics.pieData.map((item) => (

              <div key={item.name}>

                <span
                  className="legend-color"
                  style={{ background: item.color }}
                />

                <span>{item.name}</span>

                <strong>{item.value}</strong>

              </div>

            ))}

          </div>

        </div>


        {/* GRÁFICA DE BRECHAS */}

        <div className="analytics-chart-card">

          <div className="analytics-card-heading">

            <h3>Brechas por competencia</h3>

            <span>Porcentaje en niveles I + L</span>

          </div>


          <div className="gap-chart-container">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart

                data={analytics.gapData}

                layout="vertical"

                margin={{
                  top: 5,
                  right: 20,
                  left: 5,
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

                  tickFormatter={(value) => `${value}%`}

                  tick={{ fontSize: 10, fill: '#929aaa' }}

                />

                <YAxis

                  type="category"

                  dataKey="competencyName"

                  width={155}

                  tickFormatter={(value) =>
                    value.length > 25
                      ? `${value.substring(0, 22)}...`
                      : value
                  }

                  tick={{ fontSize: 10, fill: '#66738a' }}

                />

                <Tooltip content={<GapTooltip />} />


                <Bar

                  dataKey="gapPercentage"

                  name="Brecha"

                  fill="#df923e"

                  radius={[0, 6, 6, 0]}

                  barSize={22}

                />

              </BarChart>

            </ResponsiveContainer>

          </div>


          <div className="chart-footer">

            Las competencias con mayor porcentaje en I y L
            representan las principales oportunidades de desarrollo.

          </div>

        </div>


      </div>


      {/* NOTA METODOLÓGICA */}

      <div className="analytics-note">

        <strong>Interpretación:</strong>

        <span>
          Para este análisis, los niveles I y L se consideran
          brechas de desarrollo, mientras que U y O representan
          dominio autónomo o capacidad de orientación.
        </span>

      </div>


    </section>

  );

}

export default CompetencyAnalytics;