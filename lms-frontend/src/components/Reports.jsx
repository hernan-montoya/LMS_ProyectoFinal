import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  Target,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './Reports.css';

const API_URL = import.meta.env.VITE_API_URL;

const ILUO_COLORS = {
  I: '#d98b42',
  L: '#c3a13c',
  U: '#38a477',
  O: '#7564c7',
};

const formatPercent = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : '—';
};

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`El servidor devolvió una respuesta no válida (${response.status}).`);
  }

  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || `Error HTTP ${response.status} al consultar ${url}.`);
  }

  return result;
}

function Reports() {
  const [reportData, setReportData] = useState({
    employees: [],
    departments: [],
    summary: null,
    gaps: [],
  });
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadReports = useCallback(async ({ signal, isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [employeeResult, departmentResult, summaryResult, gapResult] = await Promise.all([
        fetchJson(`${API_URL}/employees?status=Todos`, signal),
        fetchJson(`${API_URL}/departments`, signal),
        fetchJson(`${API_URL}/dashboard/summary`, signal),
        fetchJson(`${API_URL}/dashboard/gaps`, signal),
      ]);

      if (!Array.isArray(employeeResult.data) || !Array.isArray(departmentResult.data)) {
        throw new Error('La API devolvió un formato inesperado para colaboradores o departamentos.');
      }
      if (!summaryResult.data || !Array.isArray(summaryResult.data.departments) || !Array.isArray(gapResult.data)) {
        throw new Error('La API devolvió un formato inesperado para los indicadores o las brechas.');
      }

      setReportData({
        employees: employeeResult.data,
        departments: departmentResult.data,
        summary: summaryResult.data,
        gaps: gapResult.data,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al cargar reportes:', err);
        setError(err.message || 'No fue posible cargar los reportes.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReports({ signal: controller.signal });
    return () => controller.abort();
  }, [loadReports]);

  const selectedDepartmentId = selectedDepartment === 'all' ? null : Number(selectedDepartment);

  const filteredGaps = useMemo(() => {
    const rows = selectedDepartmentId
      ? reportData.gaps.filter((row) => Number(row.department_id) === selectedDepartmentId)
      : reportData.gaps;
    return [...rows].sort((a, b) => asNumber(b.gap_percentage) - asNumber(a.gap_percentage));
  }, [reportData.gaps, selectedDepartmentId]);

  const departmentSummary = useMemo(() => {
    if (!reportData.summary) return null;
    if (!selectedDepartmentId) return null;
    return reportData.summary.departments.find(
      (department) => Number(department.department_id) === selectedDepartmentId,
    ) || null;
  }, [reportData.summary, selectedDepartmentId]);

  const globalSummary = reportData.summary?.global || {};
  const activeEmployees = reportData.employees.filter((employee) => employee.employment_status === 'Activo');
  const inactiveEmployees = reportData.employees.filter((employee) => employee.employment_status === 'Inactivo');

  const selectedEmployees = selectedDepartmentId
    ? reportData.employees.filter((employee) => Number(employee.department_id) === selectedDepartmentId)
    : reportData.employees;
  const selectedActive = selectedEmployees.filter((employee) => employee.employment_status === 'Activo').length;
  const selectedInactive = selectedEmployees.filter((employee) => employee.employment_status === 'Inactivo').length;

  const iluCounts = departmentSummary || globalSummary;
  const iluChartData = [
    { name: 'Inicial (I)', value: asNumber(iluCounts.level_i_count), code: 'I' },
    { name: 'Limitado (L)', value: asNumber(iluCounts.level_l_count), code: 'L' },
    { name: 'Autónomo (U)', value: asNumber(iluCounts.level_u_count), code: 'U' },
    { name: 'Orientador (O)', value: asNumber(iluCounts.level_o_count), code: 'O' },
  ].filter((item) => item.value > 0);

  const departmentChartData = reportData.summary?.departments
    ?.map((department) => ({
      name: department.department_name,
      proficiency: asNumber(department.proficiency_percent),
    }))
    .filter((department) => !selectedDepartmentId || department.name === departmentSummary?.department_name) || [];

  const topGaps = filteredGaps.slice(0, 10).map((row) => ({
    ...row,
    chartLabel: row.competency_name.length > 27
      ? `${row.competency_name.slice(0, 24)}…`
      : row.competency_name,
    gap_percentage: asNumber(row.gap_percentage),
  }));

  const averageGap = filteredGaps.length
    ? filteredGaps.reduce((sum, row) => sum + asNumber(row.gap_percentage), 0) / filteredGaps.length
    : 0;
  const competenciesWithGap = filteredGaps.filter((row) => asNumber(row.gap_count) > 0).length;
  const proficiency = departmentSummary
    ? departmentSummary.proficiency_percent
    : globalSummary.proficiency_percent;
  const assessmentCount = departmentSummary
    ? departmentSummary.total_assessments
    : globalSummary.total_assessments;

  const exportToExcel = () => {
    const departmentLabel = departmentSummary?.department_name || 'Toda la organización';
    const exportedAt = new Date();
    const dateStamp = [
      exportedAt.getFullYear(),
      String(exportedAt.getMonth() + 1).padStart(2, '0'),
      String(exportedAt.getDate()).padStart(2, '0'),
    ].join('-');

    const summaryRows = [
      { Indicador: 'Alcance', Valor: departmentLabel },
      { Indicador: 'Colaboradores registrados', Valor: selectedEmployees.length },
      { Indicador: 'Colaboradores activos', Valor: selectedActive },
      { Indicador: 'Colaboradores inactivos', Valor: selectedInactive },
      { Indicador: 'Dominio ILUO (U + O)', Valor: `${formatPercent(proficiency)}` },
      { Indicador: 'Evaluaciones consideradas', Valor: asNumber(assessmentCount) },
      { Indicador: 'Competencias analizadas', Valor: filteredGaps.length },
      { Indicador: 'Competencias con brecha', Valor: competenciesWithGap },
      { Indicador: 'Promedio simple de brecha', Valor: formatPercent(averageGap) },
      { Indicador: 'Fecha de exportación', Valor: exportedAt.toLocaleString('es-MX') },
    ];

    const iluRows = [
      { Nivel: 'Inicial (I)', Código: 'I', Evaluaciones: asNumber(iluCounts.level_i_count) },
      { Nivel: 'Limitado (L)', Código: 'L', Evaluaciones: asNumber(iluCounts.level_l_count) },
      { Nivel: 'Autónomo (U)', Código: 'U', Evaluaciones: asNumber(iluCounts.level_u_count) },
      { Nivel: 'Orientador (O)', Código: 'O', Evaluaciones: asNumber(iluCounts.level_o_count) },
    ].map((row) => ({
      ...row,
      Porcentaje: assessmentCount ? `${((row.Evaluaciones / asNumber(assessmentCount)) * 100).toFixed(1)}%` : '0.0%',
    }));

    const gapRows = filteredGaps.map((row) => ({
      Departamento: row.department_name,
      Área: row.area_name,
      Código: row.competency_code,
      Competencia: row.competency_name,
      'Evaluaciones (n)': asNumber(row.total_assessments),
      'Nivel I': asNumber(row.level_i_count),
      'Nivel L': asNumber(row.level_l_count),
      'Nivel U': asNumber(row.level_u_count),
      'Nivel O': asNumber(row.level_o_count),
      'Colaboradores con brecha (I + L)': asNumber(row.gap_count),
      'Brecha I + L (%)': asNumber(row.gap_percentage),
    }));

    const departmentRows = (reportData.summary?.departments || [])
      .filter((row) => !selectedDepartmentId || Number(row.department_id) === selectedDepartmentId)
      .map((row) => ({
        Departamento: row.department_name,
        Evaluaciones: asNumber(row.total_assessments),
        'Nivel I': asNumber(row.level_i_count),
        'Nivel L': asNumber(row.level_l_count),
        'Nivel U': asNumber(row.level_u_count),
        'Nivel O': asNumber(row.level_o_count),
        'Dominio U + O (%)': asNumber(row.proficiency_percent),
      }));

    const employeeRows = selectedEmployees.map((employee) => ({
      'Código': employee.employee_code,
      'Nombre completo': employee.full_name,
      'Departamento': employee.department_name || '',
      'Área': employee.area_name || employee.work_area_name || '',
      'Puesto': employee.job_title,
      'Fecha de ingreso': employee.hire_date,
      'Estatus': employee.employment_status,
    }));

    const workbook = XLSX.utils.book_new();
    const addSheet = (name, rows, widths) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = widths.map((wch) => ({ wch }));
      if (rows.length > 0) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    };

    addSheet('Resumen', summaryRows, [34, 34]);
    addSheet('Distribución ILUO', iluRows, [24, 12, 18, 16]);
    addSheet('Dominio por departamento', departmentRows, [30, 16, 12, 12, 12, 12, 22]);
    addSheet('Brechas', gapRows, [26, 34, 20, 38, 18, 12, 12, 12, 12, 28, 18]);
    addSheet('Colaboradores', employeeRows, [16, 32, 28, 34, 30, 18, 16]);

    workbook.Props = {
      Title: 'Reportes ejecutivos LMS',
      Subject: `Indicadores de competencias - ${departmentLabel}`,
      Author: 'LMS - Sistema de Gestión de Competencias y Capacitación',
      CreatedDate: exportedAt,
    };

    XLSX.writeFile(workbook, `LMS_Reporte_${dateStamp}.xlsx`);
  };

  if (loading) {
    return <div className="reports-state">Preparando reportes desde la API…</div>;
  }

  if (error && !reportData.summary) {
    return (
      <div className="reports-state reports-error">
        <h3>No se pudieron cargar los reportes</h3>
        <p>{error}</p>
        <button type="button" onClick={() => loadReports()}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <section className="reports-page">
      <div className="reports-heading">
        <div>
          <span className="reports-eyebrow">ANÁLISIS Y SEGUIMIENTO</span>
          <h2>Reportes ejecutivos</h2>
          <p>Consulta la composición de la plantilla, los resultados ILUO y las principales brechas de competencia.</p>
        </div>
        <div className="reports-heading-actions">
          <button
            type="button"
            className="reports-export"
            onClick={exportToExcel}
            disabled={!reportData.summary || refreshing}
            title="Descargar un libro de Excel con los datos del filtro actual"
          >
            <Download size={16} /> Exportar a Excel
          </button>
          <button
            type="button"
            className="reports-refresh"
            onClick={() => loadReports({ isRefresh: true })}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'reports-spin' : ''} />
            {refreshing ? 'Actualizando…' : 'Actualizar datos'}
          </button>
        </div>
      </div>

      {error && <div className="reports-inline-error">No se pudieron actualizar todos los datos: {error}</div>}

      <div className="reports-toolbar">
        <div className="reports-filter-label"><Filter size={17} /><span>Filtrar reporte por departamento</span></div>
        <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
          <option value="all">Toda la organización</option>
          {reportData.departments.map((department) => (
            <option key={department.department_id} value={department.department_id}>
              {department.department_name}
            </option>
          ))}
        </select>
      </div>

      <div className="reports-kpi-grid">
        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-purple"><Users size={20} /></div>
          <span>Colaboradores registrados</span>
          <strong>{selectedEmployees.length}</strong>
          <small>{selectedDepartmentId ? 'Activos e inactivos del departamento' : 'Plantilla completa'}</small>
        </article>
        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-green"><UserCheck size={20} /></div>
          <span>Colaboradores activos</span>
          <strong>{selectedDepartmentId ? selectedActive : activeEmployees.length}</strong>
          <small>Personal vigente</small>
        </article>
        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-orange"><UserX size={20} /></div>
          <span>Colaboradores inactivos</span>
          <strong>{selectedDepartmentId ? selectedInactive : inactiveEmployees.length}</strong>
          <small>Registros conservados</small>
        </article>
        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-blue"><Target size={20} /></div>
          <span>Dominio U + O</span>
          <strong>{formatPercent(proficiency)}</strong>
          <small>{asNumber(assessmentCount)} evaluaciones consideradas</small>
        </article>
      </div>

      <div className="reports-chart-grid">
        <article className="reports-panel">
          <div className="reports-panel-heading">
            <div><Activity size={18} /><h3>Distribución de niveles ILUO</h3></div>
            <span>{selectedDepartmentId ? departmentSummary?.department_name : 'Toda la organización'}</span>
          </div>
          {iluChartData.length ? (
            <div className="reports-pie-layout">
              <div className="reports-chart reports-pie-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={iluChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                      {iluChartData.map((entry) => <Cell key={entry.code} fill={ILUO_COLORS[entry.code]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="reports-legend">
                {iluChartData.map((entry) => (
                  <div key={entry.code}>
                    <span className="reports-legend-dot" style={{ background: ILUO_COLORS[entry.code] }} />
                    <span>{entry.name}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="reports-empty">No hay evaluaciones disponibles para este filtro.</div>}
        </article>

        <article className="reports-panel">
          <div className="reports-panel-heading">
            <div><BarChart3 size={18} /><h3>Dominio por departamento</h3></div>
            <span>Porcentaje U + O</span>
          </div>
          {departmentChartData.length ? (
            <div className="reports-chart reports-bar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 12, right: 12, left: 0, bottom: 42 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} height={58} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Dominio U + O']} />
                  <Bar dataKey="proficiency" name="Dominio U + O" fill="#6375c8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="reports-empty">No hay datos departamentales disponibles.</div>}
        </article>
      </div>

      <article className="reports-panel reports-gaps-panel">
        <div className="reports-panel-heading">
          <div><AlertTriangle size={18} /><h3>Competencias con mayores brechas</h3></div>
          <span>Brecha = niveles I + L</span>
        </div>
        <div className="reports-gap-summary">
          <div><strong>{filteredGaps.length}</strong><span>Competencias analizadas</span></div>
          <div><strong>{competenciesWithGap}</strong><span>Con brecha registrada</span></div>
          <div><strong>{formatPercent(averageGap)}</strong><span>Promedio simple de brecha</span></div>
        </div>
        {topGaps.length ? (
          <div className="reports-chart reports-gap-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topGaps} layout="vertical" margin={{ top: 4, right: 25, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="chartLabel" width={190} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)}% · n=${item.payload.total_assessments}`, 'Brecha I + L']} />
                <Bar dataKey="gap_percentage" name="Brecha I + L" fill="#d58a51" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="reports-empty">No hay competencias con datos para el filtro seleccionado.</div>}
      </article>

      <article className="reports-panel reports-table-panel">
        <div className="reports-panel-heading">
          <div><Filter size={18} /><h3>Detalle de brechas por competencia</h3></div>
          <span>{filteredGaps.length} registros</span>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Área</th>
                <th>Competencia</th>
                <th>Evaluaciones (n)</th>
                <th>Brecha I + L</th>
              </tr>
            </thead>
            <tbody>
              {filteredGaps.map((row) => (
                <tr key={`${row.competency_id}-${row.work_area_id}`}>
                  <td>{row.department_name}</td>
                  <td>{row.area_name}</td>
                  <td><strong>{row.competency_name}</strong></td>
                  <td>{row.total_assessments}</td>
                  <td><span className="reports-gap-badge">{formatPercent(row.gap_percentage)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredGaps.length && <div className="reports-empty">No hay registros para mostrar.</div>}
        </div>
      </article>

      <div className="reports-method-note">
        <strong>Nota metodológica:</strong> para este reporte, las brechas se calculan con los niveles I + L y el dominio con U + O. Cada porcentaje de brecha debe interpretarse junto con su tamaño de muestra (n). El promedio mostrado es una media simple de los porcentajes por competencia, no un porcentaje global ponderado.
      </div>
    </section>
  );
}

export default Reports;
