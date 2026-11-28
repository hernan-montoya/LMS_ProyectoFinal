import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, CalendarDays, Check, CheckCircle2, Clock3,
  Download, GraduationCap, Plus, RefreshCw, Search, Users, X,
  Pencil, Power, ClipboardList, Target
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './TrainingManagement.css';

const API_URL = import.meta.env.VITE_API_URL;
const LEVELS = ['I', 'L', 'U', 'O'];
const STATUSES = ['Asignado', 'En progreso', 'Completado', 'Cancelado'];

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const emptyCourse = () => ({
  course_code: '', course_name: '', description: '', modality: 'Presencial',
  duration_hours: '1', competencies: []
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Error HTTP ${response.status}`);
  }
  return result;
}

function formatDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}/${month}/${year}` : raw;
}

export default function TrainingManagement() {
  const [tab, setTab] = useState('Resumen');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [summary, setSummary] = useState({});
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [courseVisibility, setCourseVisibility] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courseModal, setCourseModal] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourse());
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    course_id: '', employee_ids: [], assigned_date: todayISO(), due_date: '', notes: ''
  });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [rowEdits, setRowEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const departmentQuery = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : '';
      const status = statusFilter !== 'Todos' ? `&status=${encodeURIComponent(statusFilter)}` : '';
      const dept = departmentId ? `&department_id=${encodeURIComponent(departmentId)}` : '';
      const [deptResult, employeeResult, courseResult, competencyResult, enrollmentResult, summaryResult, recommendationResult] = await Promise.all([
        apiRequest('/departments'),
        apiRequest('/employees?status=Activo'),
        apiRequest('/training/courses?active=Todos'),
        apiRequest('/training/competencies'),
        apiRequest(`/training/enrollments?${q.slice(1)}${status}${dept}`),
        apiRequest(`/training/summary${departmentQuery}`),
        apiRequest(`/training/recommendations${departmentQuery}`)
      ]);
      setDepartments(deptResult.data || []);
      setEmployees(employeeResult.data || []);
      setCourses(courseResult.data || []);
      setCompetencies(competencyResult.data || []);
      setEnrollments(enrollmentResult.data || []);
      setSummary(summaryResult.data || {});
      setRecommendations(recommendationResult.data || []);
      setRowEdits(Object.fromEntries((enrollmentResult.data || []).map((row) => [row.enrollment_id, {
        enrollment_status: row.enrollment_status,
        due_date: row.due_date ? String(row.due_date).slice(0, 10) : '',
        completion_date: row.completion_date ? String(row.completion_date).slice(0, 10) : '',
        score: row.score ?? ''
      }])));
    } catch (loadError) {
      setError(loadError.message || 'No fue posible cargar la información de capacitación.');
    } finally {
      setLoading(false);
    }
  }, [departmentId, departmentQuery, search, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredEmployeesForAssignment = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesDepartment = !departmentId || String(employee.department_id) === String(departmentId);
      const matchesText = !term || `${employee.employee_code} ${employee.full_name} ${employee.job_title}`.toLowerCase().includes(term);
      return matchesDepartment && matchesText;
    });
  }, [employees, employeeSearch, departmentId]);

  const activeCourses = useMemo(() => courses.filter((course) => Boolean(Number(course.active))), [courses]);
  const visibleCourses = useMemo(() => courses.filter((course) => courseVisibility === 'Todos' || String(Number(course.active)) === courseVisibility), [courses, courseVisibility]);

  const selectedCompetencyIds = useMemo(
    () => new Set(courseForm.competencies.map((item) => Number(item.competency_id))),
    [courseForm.competencies]
  );

  const openNewCourse = () => {
    setEditingCourseId(null);
    setCourseForm(emptyCourse());
    setCourseModal(true);
  };

  const openEditCourse = async (courseId) => {
    setError('');
    try {
      const result = await apiRequest(`/training/courses/${courseId}`);
      const item = result.data;
      setEditingCourseId(courseId);
      setCourseForm({
        course_code: item.course_code,
        course_name: item.course_name,
        description: item.description || '',
        modality: item.modality,
        duration_hours: String(item.duration_hours),
        competencies: (item.competencies || []).map((competency) => ({
          competency_id: competency.competency_id,
          target_iluo_level: competency.target_iluo_level,
          notes: competency.notes || ''
        }))
      });
      setCourseModal(true);
    } catch (loadError) { setError(loadError.message); }
  };

  const toggleCompetency = (competencyId) => {
    setCourseForm((current) => {
      const exists = current.competencies.some((item) => Number(item.competency_id) === Number(competencyId));
      return {
        ...current,
        competencies: exists
          ? current.competencies.filter((item) => Number(item.competency_id) !== Number(competencyId))
          : [...current.competencies, { competency_id: Number(competencyId), target_iluo_level: 'U', notes: '' }]
      };
    });
  };

  const updateCourseCompetency = (competencyId, field, value) => {
    setCourseForm((current) => ({
      ...current,
      competencies: current.competencies.map((item) => Number(item.competency_id) === Number(competencyId)
        ? { ...item, [field]: value } : item)
    }));
  };

  const saveCourse = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest(editingCourseId ? `/training/courses/${editingCourseId}` : '/training/courses', {
        method: editingCourseId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...courseForm, duration_hours: Number(courseForm.duration_hours) })
      });
      setCourseModal(false);
      setNotice(editingCourseId ? 'Curso actualizado correctamente.' : 'Curso registrado correctamente.');
      await loadData();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };

  const toggleCourseActive = async (course) => {
    const nextActive = !Boolean(Number(course.active));
    const confirmed = window.confirm(`${nextActive ? '¿Activar' : '¿Desactivar'} el curso "${course.course_name}"?`);
    if (!confirmed) return;
    try {
      await apiRequest(`/training/courses/${course.course_id}/status`, {
        method: 'PATCH', body: JSON.stringify({ active: nextActive })
      });
      setNotice(nextActive ? 'Curso activado.' : 'Curso desactivado.');
      await loadData();
    } catch (toggleError) { setError(toggleError.message); }
  };

  const openAssignmentModal = (preset = {}) => {
    setAssignmentForm({
      course_id: preset.course_id ? String(preset.course_id) : '',
      employee_ids: preset.employee_id ? [Number(preset.employee_id)] : [],
      assigned_date: todayISO(), due_date: '', notes: ''
    });
    setEmployeeSearch(preset.employee_id ? '' : search);
    setAssignmentModal(true);
  };

  const toggleEmployee = (employeeId) => {
    setAssignmentForm((current) => ({
      ...current,
      employee_ids: current.employee_ids.includes(Number(employeeId))
        ? current.employee_ids.filter((id) => id !== Number(employeeId))
        : [...current.employee_ids, Number(employeeId)]
    }));
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await apiRequest('/training/enrollments', {
        method: 'POST',
        body: JSON.stringify({ ...assignmentForm, course_id: Number(assignmentForm.course_id) })
      });
      setAssignmentModal(false);
      setNotice(result.message || 'Asignación realizada correctamente.');
      setTab('Asignaciones');
      await loadData();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };

  const updateEnrollmentField = (enrollmentId, field, value) => {
    setRowEdits((current) => ({
      ...current,
      [enrollmentId]: { ...current[enrollmentId], [field]: value }
    }));
  };

  const saveEnrollment = async (enrollmentId) => {
    const edit = rowEdits[enrollmentId];
    setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest(`/training/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...edit,
          score: edit.score === '' ? null : Number(edit.score),
          due_date: edit.due_date || null,
          completion_date: edit.completion_date || null
        })
      });
      setNotice('Seguimiento actualizado correctamente.');
      await loadData();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };

  const assignRecommendation = async (recommendation) => {
    const confirmed = window.confirm(`¿Asignar "${recommendation.course_name}" a ${recommendation.full_name}?`);
    if (!confirmed) return;
    try {
      const result = await apiRequest('/training/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          employee_ids: [recommendation.employee_id],
          course_id: recommendation.course_id,
          assigned_date: todayISO(),
          due_date: null,
          notes: `Asignación sugerida por brecha ILUO ${recommendation.competency_code} (${recommendation.current_iluo_level}).`
        })
      });
      setNotice(result.message || 'Curso asignado desde recomendaciones.');
      await loadData();
    } catch (assignError) { setError(assignError.message); }
  };

  const exportEnrollments = () => {
    const rows = enrollments.map((row) => ({
      'Código colaborador': row.employee_code,
      'Colaborador': row.full_name,
      'Departamento': row.department_name,
      'Área': row.area_name,
      'Puesto': row.job_title,
      'Código curso': row.course_code,
      'Curso': row.course_name,
      'Modalidad': row.modality,
      'Duración (horas)': Number(row.duration_hours),
      'Fecha de asignación': formatDate(row.assigned_date),
      'Fecha límite': formatDate(row.due_date),
      'Fecha de conclusión': formatDate(row.completion_date),
      'Estatus': row.enrollment_status,
      'Calificación': row.score ?? '',
      'Vencida': Number(row.is_overdue) ? 'Sí' : 'No',
      'Observaciones': row.notes || ''
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Mensaje: 'No hay asignaciones para exportar con los filtros actuales.' }]);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 30 }, { wch: 25 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
      { wch: 36 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
      { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 42 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asignaciones');
    XLSX.writeFile(workbook, `LMS_Capacitacion_${todayISO()}.xlsx`);
  };

  const kpis = [
    { label: 'Cursos activos', value: summary.active_courses ?? activeCourses.length, icon: BookOpen, tone: 'blue' },
    { label: 'Asignaciones', value: summary.total_enrollments ?? 0, icon: ClipboardList, tone: 'violet' },
    { label: 'En progreso', value: summary.in_progress_count ?? 0, icon: Clock3, tone: 'amber' },
    { label: 'Completadas', value: summary.completed_count ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Vencidas', value: summary.overdue_count ?? 0, icon: AlertCircle, tone: 'red' }
  ];

  return (
    <section className="training-page">
      <div className="training-heading">
        <div>
          <div className="training-eyebrow"><GraduationCap size={16} /> DESARROLLO DEL TALENTO</div>
          <h2>Administración de capacitación</h2>
          <p>Administra el catálogo, asigna cursos y da seguimiento a las brechas de competencias.</p>
        </div>
        <div className="training-heading-actions">
          <button className="training-button secondary" onClick={loadData} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
          <button className="training-button secondary" onClick={exportEnrollments}><Download size={16} /> Exportar Excel</button>
          <button className="training-button primary" onClick={() => openAssignmentModal()}><Plus size={17} /> Asignar curso</button>
        </div>
      </div>

      {error && <div className="training-alert error"><AlertCircle size={17} /> {error}<button onClick={() => setError('')} aria-label="Cerrar"><X size={16} /></button></div>}
      {notice && <div className="training-alert success"><Check size={17} /> {notice}<button onClick={() => setNotice('')} aria-label="Cerrar"><X size={16} /></button></div>}

      <div className="training-filterbar">
        <label><span>Departamento</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Todos los departamentos</option>{departments.map((department) => <option key={department.department_id} value={department.department_id}>{department.department_name}</option>)}</select></label>
        <label className="training-search"><span>Buscar</span><div><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Colaborador, código o curso" /></div></label>
        <label><span>Estatus de asignación</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>

      <div className="training-tabs" role="tablist" aria-label="Secciones de capacitación">
        {['Resumen', 'Cursos', 'Asignaciones', 'Recomendaciones ILUO'].map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}
      </div>

      {loading ? <div className="training-loading"><RefreshCw className="spin" size={20} /> Cargando información de capacitación...</div> : <>
        {tab === 'Resumen' && <>
          <div className="training-kpis">
            {kpis.map((item) => { const Icon = item.icon; return <article className="training-kpi" key={item.label}><span className={`training-kpi-icon ${item.tone}`}><Icon size={19} /></span><div><small>{item.label}</small><strong>{Number(item.value || 0).toLocaleString('es-MX')}</strong></div></article>; })}
          </div>
          <div className="training-overview-grid">
            <article className="training-panel">
              <div className="training-panel-title"><div><h3>Estado de las asignaciones</h3><p>Distribución de los registros de capacitación.</p></div><ClipboardList size={20} /></div>
              <div className="training-status-list">
                {[
                  ['Asignado', summary.assigned_count, 'assigned'],
                  ['En progreso', summary.in_progress_count, 'progress'],
                  ['Completado', summary.completed_count, 'completed'],
                  ['Cancelado', summary.cancelled_count, 'cancelled']
                ].map(([label, value, tone]) => <div className="training-status-row" key={label}><span className={`status-dot ${tone}`} /><span>{label}</span><strong>{Number(value || 0)}</strong></div>)}
              </div>
            </article>
            <article className="training-panel training-quick-panel">
              <div className="training-panel-title"><div><h3>Accesos rápidos</h3><p>Operaciones frecuentes del módulo.</p></div><Target size={20} /></div>
              <button onClick={openNewCourse}><Plus size={17} /> Registrar un nuevo curso</button>
              <button onClick={() => openAssignmentModal()}><Users size={17} /> Asignar capacitación a colaboradores</button>
              <button onClick={() => setTab('Recomendaciones ILUO')}><Target size={17} /> Consultar cursos sugeridos por brechas</button>
            </article>
          </div>
          <article className="training-panel training-recent-panel">
            <div className="training-panel-title"><div><h3>Asignaciones recientes</h3><p>Últimos movimientos registrados.</p></div><button className="training-link-button" onClick={() => setTab('Asignaciones')}>Ver todas</button></div>
            <EnrollmentTable rows={enrollments.slice(0, 6)} rowEdits={rowEdits} updateEnrollmentField={updateEnrollmentField} saveEnrollment={saveEnrollment} saving={saving} compact />
          </article>
        </>}

        {tab === 'Cursos' && <>
          <div className="training-section-bar"><div><h3>Catálogo de cursos</h3><p>{activeCourses.length} cursos activos · {courses.length - activeCourses.length} inactivos.</p></div><div className="training-heading-actions"><select className="training-catalog-filter" value={courseVisibility} onChange={(event) => setCourseVisibility(event.target.value)}><option value="1">Activos</option><option value="0">Inactivos</option><option value="Todos">Todos</option></select><button className="training-button primary" onClick={openNewCourse}><Plus size={17} /> Nuevo curso</button></div></div>
          {visibleCourses.length === 0 ? <EmptyState title="No hay cursos registrados" text="Registra el primer curso para comenzar a asignar capacitación." /> : <div className="training-course-grid">
            {visibleCourses.map((course) => <article className="training-course-card" key={course.course_id}>
              <div className="training-course-card-top"><span className="training-course-icon"><BookOpen size={20} /></span><span className="training-course-code">{course.course_code}</span></div>
              <h3>{course.course_name}</h3>
              <p>{course.description || 'Sin descripción registrada.'}</p>
              <div className="training-course-meta"><span>{course.modality}</span><span>{Number(course.duration_hours)} h</span><span>{Number(course.competency_count || 0)} competencias</span></div>
              {course.competency_names && <div className="training-course-competencies" title={course.competency_names}>{course.competency_names}</div>}
              <div className="training-course-actions"><button onClick={() => openEditCourse(course.course_id)}><Pencil size={15} /> Editar</button><button onClick={() => toggleCourseActive(course)}><Power size={15} /> {Boolean(Number(course.active)) ? 'Desactivar' : 'Activar'}</button><button onClick={() => openAssignmentModal({ course_id: course.course_id })}><Users size={15} /> Asignar</button></div>
            </article>)}
          </div>}
        </>}

        {tab === 'Asignaciones' && <>
          <div className="training-section-bar"><div><h3>Seguimiento de capacitación</h3><p>{enrollments.length} asignaciones según los filtros actuales.</p></div><button className="training-button primary" onClick={() => openAssignmentModal()}><Plus size={17} /> Nueva asignación</button></div>
          <EnrollmentTable rows={enrollments} rowEdits={rowEdits} updateEnrollmentField={updateEnrollmentField} saveEnrollment={saveEnrollment} saving={saving} />
        </>}

        {tab === 'Recomendaciones ILUO' && <>
          <div className="training-section-bar"><div><h3>Cursos relacionados con brechas ILUO</h3><p>Colaboradores activos con nivel I o L en competencias vinculadas a cursos.</p></div><span className="training-recommendation-count">{recommendations.length} recomendaciones</span></div>
          {recommendations.length === 0 ? <EmptyState title="No hay recomendaciones pendientes" text="No se encontraron brechas I/L con cursos vinculados disponibles para los filtros seleccionados." /> : <div className="training-table-wrap"><table className="training-table"><thead><tr><th>Colaborador</th><th>Departamento / área</th><th>Competencia</th><th>Nivel actual</th><th>Curso sugerido</th><th>Objetivo</th><th></th></tr></thead><tbody>{recommendations.map((item, index) => <tr key={`${item.employee_id}-${item.competency_id}-${item.course_id}-${index}`}><td><strong>{item.full_name}</strong><small>{item.employee_code}</small></td><td>{item.department_name}<small>{item.area_name}</small></td><td><strong>{item.competency_name}</strong><small>{item.competency_code}</small></td><td><span className={`iluo-chip level-${item.current_iluo_level}`}>{item.current_iluo_level}</span></td><td><strong>{item.course_name}</strong><small>{item.course_code} · {item.modality}</small></td><td><span className={`iluo-chip level-${item.target_iluo_level}`}>{item.target_iluo_level}</span></td><td><button className="training-small-action" onClick={() => assignRecommendation(item)}><Plus size={15} /> Asignar</button></td></tr>)}</tbody></table></div>}
        </>}
      </>}

      {courseModal && <div className="training-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCourseModal(false); }}><form className="training-modal large" onSubmit={saveCourse}>
        <div className="training-modal-header"><div><h2>{editingCourseId ? 'Editar curso' : 'Registrar curso'}</h2><p>Define la información general y las competencias que desarrolla.</p></div><button type="button" onClick={() => setCourseModal(false)} aria-label="Cerrar"><X size={20} /></button></div>
        <div className="training-form-grid"><label>Código del curso<input required maxLength="20" value={courseForm.course_code} onChange={(event) => setCourseForm({ ...courseForm, course_code: event.target.value })} placeholder="CUR-009" /></label><label>Nombre del curso<input required maxLength="150" value={courseForm.course_name} onChange={(event) => setCourseForm({ ...courseForm, course_name: event.target.value })} /></label><label>Modalidad<select value={courseForm.modality} onChange={(event) => setCourseForm({ ...courseForm, modality: event.target.value })}><option>Presencial</option><option>Virtual</option><option>Hibrida</option></select></label><label>Duración (horas)<input type="number" min="0.01" max="999.99" step="0.01" required value={courseForm.duration_hours} onChange={(event) => setCourseForm({ ...courseForm, duration_hours: event.target.value })} /></label><label className="full">Descripción<textarea rows="2" maxLength="500" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></label></div>
        <div className="training-competency-picker"><div><h3>Competencias relacionadas</h3><p>Selecciona las competencias que el curso busca desarrollar y define el nivel objetivo.</p></div>
          <div className="training-competency-list">{competencies.map((competency) => { const checked = selectedCompetencyIds.has(Number(competency.competency_id)); const selected = courseForm.competencies.find((item) => Number(item.competency_id) === Number(competency.competency_id)); return <div className={`training-competency-option ${checked ? 'selected' : ''}`} key={competency.competency_id}><label><input type="checkbox" checked={checked} onChange={() => toggleCompetency(competency.competency_id)} /><span><strong>{competency.competency_name}</strong><small>{competency.department_name} · {competency.area_name}</small></span></label>{checked && <select aria-label={`Nivel objetivo para ${competency.competency_name}`} value={selected?.target_iluo_level || 'U'} onChange={(event) => updateCourseCompetency(competency.competency_id, 'target_iluo_level', event.target.value)}>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select>}</div>; })}</div>
        </div>
        <div className="training-modal-footer"><button type="button" className="training-button secondary" onClick={() => setCourseModal(false)}>Cancelar</button><button type="submit" className="training-button primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar curso'}</button></div>
      </form></div>}

      {assignmentModal && <div className="training-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignmentModal(false); }}><form className="training-modal" onSubmit={saveAssignment}>
        <div className="training-modal-header"><div><h2>Asignar capacitación</h2><p>Elige el curso y uno o varios colaboradores activos.</p></div><button type="button" onClick={() => setAssignmentModal(false)} aria-label="Cerrar"><X size={20} /></button></div>
        <div className="training-form-grid"><label className="full">Curso<select required value={assignmentForm.course_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, course_id: event.target.value })}><option value="">Selecciona un curso</option>{activeCourses.map((course) => <option key={course.course_id} value={course.course_id}>{course.course_code} · {course.course_name}</option>)}</select></label><label>Fecha de asignación<input type="date" required value={assignmentForm.assigned_date} onChange={(event) => setAssignmentForm({ ...assignmentForm, assigned_date: event.target.value })} /></label><label>Fecha límite<input type="date" min={assignmentForm.assigned_date} value={assignmentForm.due_date} onChange={(event) => setAssignmentForm({ ...assignmentForm, due_date: event.target.value })} /></label><label className="full">Observaciones<textarea rows="2" maxLength="500" value={assignmentForm.notes} onChange={(event) => setAssignmentForm({ ...assignmentForm, notes: event.target.value })} /></label></div>
        <div className="training-employee-picker"><div className="training-picker-heading"><strong>Colaboradores activos</strong><span>{assignmentForm.employee_ids.length} seleccionados</span></div><div className="training-picker-search"><Search size={16} /><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Buscar por nombre, código o puesto" /></div><div className="training-employee-list">{filteredEmployeesForAssignment.map((employee) => <label key={employee.employee_id}><input type="checkbox" checked={assignmentForm.employee_ids.includes(Number(employee.employee_id))} onChange={() => toggleEmployee(employee.employee_id)} /><span><strong>{employee.full_name}</strong><small>{employee.employee_code} · {employee.department_name} · {employee.area_name}</small></span></label>)}</div></div>
        <div className="training-modal-footer"><button type="button" className="training-button secondary" onClick={() => setAssignmentModal(false)}>Cancelar</button><button type="submit" className="training-button primary" disabled={saving || !assignmentForm.employee_ids.length || !assignmentForm.course_id}>{saving ? 'Asignando...' : `Asignar a ${assignmentForm.employee_ids.length || 0}`}</button></div>
      </form></div>}
    </section>
  );
}

function EnrollmentTable({ rows, rowEdits, updateEnrollmentField, saveEnrollment, saving, compact = false }) {
  if (!rows.length) return <EmptyState title="Sin asignaciones" text="Todavía no hay cursos asignados con los filtros actuales." compact={compact} />;
  return <div className="training-table-wrap"><table className="training-table"><thead><tr><th>Colaborador</th><th>Curso</th><th>Asignado</th><th>Fecha límite</th><th>Estatus</th><th>Conclusión</th><th>Calificación</th><th></th></tr></thead><tbody>{rows.map((row) => {
    const edit = rowEdits[row.enrollment_id] || {};
    return <tr key={row.enrollment_id}>
      <td><strong>{row.full_name}</strong><small>{row.employee_code} · {row.department_name}</small></td>
      <td><strong>{row.course_name}</strong><small>{row.course_code} · {row.modality}</small></td>
      <td>{formatDate(row.assigned_date)}</td>
      <td><span className={Number(row.is_overdue) ? 'overdue-text' : ''}>{formatDate(row.due_date)}</span>{Number(row.is_overdue) ? <small className="overdue-label">Vencida</small> : null}</td>
      <td><select className={`training-status-select status-${String(edit.enrollment_status || row.enrollment_status).toLowerCase().replaceAll(' ', '-')}`} value={edit.enrollment_status || row.enrollment_status} onChange={(event) => updateEnrollmentField(row.enrollment_id, 'enrollment_status', event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td>
      <td><input className="training-inline-input date" type="date" value={edit.completion_date || ''} onChange={(event) => updateEnrollmentField(row.enrollment_id, 'completion_date', event.target.value)} /></td>
      <td><input className="training-inline-input score" type="number" min="0" max="100" step="0.01" placeholder="—" value={edit.score ?? ''} onChange={(event) => updateEnrollmentField(row.enrollment_id, 'score', event.target.value)} /></td>
      <td><button className="training-save-row" title="Guardar cambios" onClick={() => saveEnrollment(row.enrollment_id)} disabled={saving}><Check size={16} /></button></td>
    </tr>;
  })}</tbody></table></div>;
}

function EmptyState({ title, text, compact = false }) {
  return <div className={`training-empty ${compact ? 'compact' : ''}`}><BookOpen size={compact ? 24 : 34} /><strong>{title}</strong><p>{text}</p></div>;
}
