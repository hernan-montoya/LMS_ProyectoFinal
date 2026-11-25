import { useCallback, useEffect, useMemo, useState } from 'react';
import EmployeeProfile from './EmployeeProfile';

import {
    Users,
    UserCheck,
    UserX,
    Building2,
    Search,
    Plus,
    Pencil,
    Eye,
    X,
    Save,
    RefreshCw,
    Filter,
    LoaderCircle
} from 'lucide-react';

import './EmployeeManagement.css';

const API_URL = import.meta.env.VITE_API_URL;


// Formato de fechas

const formatDate = (date) => {

    if (!date) return '—';

    return new Date(`${date.substring(0, 10)}T00:00:00`)
        .toLocaleDateString('es-MX');

};


// Formulario inicial

const EMPTY_FORM = {
    employee_id: null,
    employee_code: '',
    full_name: '',
    department_id: '',
    work_area_id: '',
    job_title: '',
    hire_date: '',
    employment_status: 'Activo'
};


function EmployeeManagement() {

    const [employees, setEmployees] = useState([]);

    const [departments, setDepartments] = useState([]);

    const [areas, setAreas] = useState([]);

    const [loading, setLoading] = useState(true);

    const [loadingAreas, setLoadingAreas] = useState(false);

    const [saving, setSaving] = useState(false);

    const [error, setError] = useState('');

    const [search, setSearch] = useState('');

    const [departmentFilter, setDepartmentFilter] = useState('all');

    const [areaFilter, setAreaFilter] = useState('all');

    const [statusFilter, setStatusFilter] = useState('all');

    const [showModal, setShowModal] = useState(false);

    const [form, setForm] = useState(EMPTY_FORM);

    const [formError, setFormError] = useState('');

    const [selectedProfile, setSelectedProfile] = useState(null);


    // 1. CONSULTAR COLABORADORES

    const fetchEmployees = useCallback(async () => {

        try {

            setLoading(true);
            setError('');

            const response = await fetch(`${API_URL}/employees?status=Todos`);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success || !Array.isArray(result.data)) {
                throw new Error('No fue posible consultar los colaboradores.');
            }

            setEmployees(result.data);

        } catch (err) {

            console.error(err);
            setError(err.message);

        } finally {

            setLoading(false);

        }

    }, []);


    // 2. CONSULTAR DEPARTAMENTOS

    useEffect(() => {

        const controller = new AbortController();

        const fetchDepartments = async () => {

            try {

                const response = await fetch(
                    `${API_URL}/departments`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error('Error al consultar departamentos.');
                }

                const result = await response.json();

                setDepartments(result.data || []);

            } catch (err) {

                if (err.name !== 'AbortError') {
                    console.error(err);
                }

            }

        };

        fetchDepartments();

        return () => controller.abort();

    }, []);


    // 3. CARGAR COLABORADORES AL INICIAR

    useEffect(() => {

        fetchEmployees();

    }, [fetchEmployees]);


    // 4. CONSULTAR ÁREAS DEL DEPARTAMENTO SELECCIONADO

    useEffect(() => {

        const controller = new AbortController();

        const fetchAreas = async () => {

            if (!showModal || !form.department_id) {

                setAreas([]);

                return;

            }

            try {

                setLoadingAreas(true);

                const response = await fetch(

                    `${API_URL}/departments/${form.department_id}/areas`,

                    { signal: controller.signal }

                );

                if (!response.ok) {
                    throw new Error('No fue posible consultar las áreas.');
                }

                const result = await response.json();

                setAreas(result.data || []);

            } catch (err) {

                if (err.name !== 'AbortError') {
                    console.error(err);
                    setFormError(err.message);
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoadingAreas(false);
                }

            }

        };

        fetchAreas();

        return () => controller.abort();

    }, [form.department_id, showModal]);


    // 5. INDICADORES

    const activeEmployees = employees.filter(
        employee => employee.employment_status === 'Activo'
    );

    const inactiveEmployees = employees.filter(
        employee => employee.employment_status === 'Inactivo'
    );


    // 6. FILTROS

    const filteredEmployees = useMemo(() => {

        return employees.filter(employee => {

            const text = search.toLowerCase();

            const matchesSearch =

                employee.full_name.toLowerCase().includes(text) ||

                employee.employee_code.toLowerCase().includes(text) ||

                employee.job_title.toLowerCase().includes(text);


            const matchesDepartment =

                departmentFilter === 'all' ||

                String(employee.department_id) === departmentFilter;


            const matchesArea =

                areaFilter === 'all' ||

                String(employee.work_area_id) === areaFilter;


            const matchesStatus =

                statusFilter === 'all' ||

                employee.employment_status === statusFilter;


            return (

                matchesSearch &&

                matchesDepartment &&

                matchesArea &&

                matchesStatus

            );

        });

    }, [
        employees,
        search,
        departmentFilter,
        areaFilter,
        statusFilter
    ]);


    // 7. ÁREAS DISPONIBLES SEGÚN FILTRO

    const availableAreas = useMemo(() => {

        const map = new Map();

        employees.forEach(employee => {

            if (
                departmentFilter === 'all' ||
                String(employee.department_id) === departmentFilter
            ) {

                map.set(employee.work_area_id, employee.area_name);

            }

        });

        return Array.from(map, ([id, name]) => ({ id, name }));

    }, [employees, departmentFilter]);


    // 8. ABRIR FORMULARIO DE NUEVO COLABORADOR

    const openNewEmployee = () => {

        setForm({
            ...EMPTY_FORM,
            employee_code: ''
        });

        setFormError('');

        setShowModal(true);

    };


    // 9. ABRIR FORMULARIO DE EDICIÓN

    const openEditEmployee = (employee) => {

        setForm({

            employee_id: employee.employee_id,

            employee_code: employee.employee_code,

            full_name: employee.full_name,

            department_id: String(employee.department_id),

            work_area_id: String(employee.work_area_id),

            job_title: employee.job_title,

            hire_date: employee.hire_date?.substring(0, 10) || '',

            employment_status: employee.employment_status

        });

        setFormError('');

        setShowModal(true);

    };


    // 10. CONTROLAR FORMULARIO

    const handleChange = (event) => {

        const { name, value } = event.target;

        setForm(previous => ({

            ...previous,

            [name]: value

        }));

    };


    // 11. GUARDAR COLABORADOR

    const saveEmployee = async (event) => {

        event.preventDefault();

        setFormError('');


        if (!form.employee_code.trim()) {

            setFormError('El ID del empleado es obligatorio.');

            return;

        }

        if (!form.full_name.trim()) {

            setFormError('El nombre completo es obligatorio.');

            return;

        }

        if (!form.department_id || !form.work_area_id) {

            setFormError('Selecciona el departamento y el área.');

            return;

        }

        if (!form.job_title.trim()) {

            setFormError('El puesto es obligatorio.');

            return;

        }

        if (!form.hire_date) {

            setFormError('La fecha de ingreso es obligatoria.');

            return;

        }


        const payload = {

            employee_code: form.employee_code.trim(),

            full_name: form.full_name.trim(),

            department_id: Number(form.department_id),

            work_area_id: Number(form.work_area_id),

            job_title: form.job_title.trim(),

            hire_date: form.hire_date,

            employment_status: form.employment_status

        };


        try {

            setSaving(true);

            const isEditing = Boolean(form.employee_id);

            const url = isEditing

                ? `${API_URL}/employees/${form.employee_id}`

                : `${API_URL}/employees`;


            const response = await fetch(url, {

                method: isEditing ? 'PUT' : 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(payload)

            });


            const result = await response.json();

            if (!response.ok || !result.success) {

                throw new Error(
                    result.message || 'No fue posible guardar el colaborador.'
                );

            }


            setShowModal(false);

            await fetchEmployees();

        } catch (err) {

            console.error(err);

            setFormError(err.message);

        } finally {

            setSaving(false);

        }

    };


    // 12. DAR DE BAJA A UN COLABORADOR

    const deactivateEmployee = async (employee) => {

        const confirmation = window.confirm(

            `¿Deseas dar de baja a ${employee.full_name}?\n\n` +

            'El colaborador conservará su historial de competencias.'

        );

        if (!confirmation) return;


        try {

            const response = await fetch(

                `${API_URL}/employees/${employee.employee_id}`,

                { method: 'DELETE' }

            );

            const result = await response.json();

            if (!response.ok || !result.success) {

                throw new Error(
                    result.message || 'No fue posible dar de baja al colaborador.'
                );

            }

            await fetchEmployees();

        } catch (err) {

            alert(err.message);

            console.error(err);

        }

    };


    // 13. LIMPIAR FILTROS

    const resetFilters = () => {

        setSearch('');

        setDepartmentFilter('all');

        setAreaFilter('all');

        setStatusFilter('all');

    };


    // ESTADO DE CARGA

    if (loading) {

        return (

            <div className="employee-state">

                <LoaderCircle size={30} className="employee-spinner" />

                <p>Cargando colaboradores...</p>

            </div>

        );

    }


    // ERROR

    if (error) {

        return (

            <div className="employee-state employee-error">

                <h3>No se pudieron cargar los colaboradores</h3>

                <p>{error}</p>

                <button onClick={fetchEmployees}>
                    Reintentar
                </button>

            </div>

        );

    }


    return (

        <div className="employee-management">


            {/* ENCABEZADO */}

            <div className="employee-heading">

                <div>

                    <span>ADMINISTRACIÓN DEL TALENTO</span>

                    <h2>Directorio de colaboradores</h2>

                    <p>
                        Administra la información de los empleados de la organización.
                    </p>

                </div>


                <button
                    className="new-employee-button"
                    onClick={openNewEmployee}
                >

                    <Plus size={18} />

                    Nuevo colaborador

                </button>

            </div>


            {/* INDICADORES */}

            <section className="employee-kpi-grid">


                <div className="employee-kpi">

                    <div className="employee-kpi-icon purple">
                        <Users size={22} />
                    </div>

                    <span>Total colaboradores</span>

                    <h3>{employees.length}</h3>

                    <small>Plantilla registrada</small>

                </div>


                <div className="employee-kpi">

                    <div className="employee-kpi-icon green">
                        <UserCheck size={22} />
                    </div>

                    <span>Colaboradores activos</span>

                    <h3>{activeEmployees.length}</h3>

                    <small>Personal vigente</small>

                </div>


                <div className="employee-kpi">

                    <div className="employee-kpi-icon orange">
                        <UserX size={22} />
                    </div>

                    <span>Colaboradores inactivos</span>

                    <h3>{inactiveEmployees.length}</h3>

                    <small>Bajas registradas</small>

                </div>


                <div className="employee-kpi">

                    <div className="employee-kpi-icon blue">
                        <Building2 size={22} />
                    </div>

                    <span>Departamentos</span>

                    <h3>{departments.length}</h3>

                    <small>Estructura organizacional</small>

                </div>


            </section>


            {/* FILTROS */}

            <section className="employee-filter-card">


                <div className="employee-filter-heading">

                    <div>
                        <Filter size={18} />

                        <h3>Buscar y filtrar colaboradores</h3>
                    </div>


                    <button onClick={resetFilters}>
                        Limpiar filtros
                    </button>

                </div>


                <div className="employee-filter-grid">


                    <div className="employee-search">

                        <Search size={17} />

                        <input

                            type="text"

                            placeholder="Buscar por nombre, ID o puesto..."

                            value={search}

                            onChange={event => setSearch(event.target.value)}

                        />

                    </div>


                    <select

                        value={departmentFilter}

                        onChange={event => {

                            setDepartmentFilter(event.target.value);

                            setAreaFilter('all');

                        }}

                    >

                        <option value="all">Todos los departamentos</option>

                        {departments.map(department => (

                            <option
                                key={department.department_id}
                                value={department.department_id}
                            >

                                {department.department_name}

                            </option>

                        ))}

                    </select>


                    <select

                        value={areaFilter}

                        onChange={event => setAreaFilter(event.target.value)}

                    >

                        <option value="all">Todas las áreas</option>

                        {availableAreas.map(area => (

                            <option key={area.id} value={area.id}>
                                {area.name}
                            </option>

                        ))}

                    </select>


                    <select

                        value={statusFilter}

                        onChange={event => setStatusFilter(event.target.value)}

                    >

                        <option value="all">Todos los estados</option>

                        <option value="Activo">Activo</option>

                        <option value="Inactivo">Inactivo</option>

                    </select>


                </div>

            </section>


            {/* TABLA */}

            <section className="employee-table-card">


                <div className="employee-table-heading">

                    <div>

                        <h3>Directorio de empleados</h3>

                        <p>
                            {filteredEmployees.length} colaboradores encontrados.
                        </p>

                    </div>


                    <button
                        className="employee-refresh-button"
                        onClick={fetchEmployees}
                        title="Actualizar información"
                    >

                        <RefreshCw size={17} />

                    </button>

                </div>


                <div className="employee-table-wrapper">

                    <table className="employee-table">

                        <thead>

                            <tr>

                                <th>ID EMPLEADO</th>

                                <th>NOMBRE COMPLETO</th>

                                <th>DEPARTAMENTO</th>

                                <th>ÁREA</th>

                                <th>PUESTO</th>

                                <th>INGRESO</th>

                                <th>ESTADO</th>

                                <th>ACCIONES</th>

                            </tr>

                        </thead>


                        <tbody>

                            {filteredEmployees.map(employee => (

                                <tr key={employee.employee_id}>


                                    <td>

                                        <span className="employee-code">
                                            {employee.employee_code}
                                        </span>

                                    </td>


                                    <td>

                                        <strong className="employee-name">
                                            {employee.full_name}
                                        </strong>

                                    </td>


                                    <td>{employee.department_name}</td>


                                    <td>{employee.area_name}</td>


                                    <td>{employee.job_title}</td>


                                    <td>{formatDate(employee.hire_date)}</td>


                                    <td>

                                        <span className={`employment-badge ${employee.employment_status.toLowerCase() === 'activo'
                                            ? 'active'
                                            : 'inactive'
                                            }`}>

                                            {employee.employment_status}

                                        </span>

                                    </td>


                                    <td>

                                        <div className="employee-actions">

                                            <button

                                                className="view-employee-action"

                                                onClick={() => setSelectedProfile(employee)}

                                                title="Consultar perfil individual"

                                            >

                                                <Eye size={16} />

                                            </button>

                                            <button

                                                className="edit-employee-action"

                                                onClick={() => openEditEmployee(employee)}

                                                title="Editar colaborador"

                                            >

                                                <Pencil size={16} />

                                            </button>


                                            {employee.employment_status === 'Activo' && (

                                                <button

                                                    className="deactivate-employee-action"

                                                    onClick={() => deactivateEmployee(employee)}

                                                    title="Dar de baja"

                                                >

                                                    <UserX size={16} />

                                                </button>

                                            )}

                                        </div>

                                    </td>


                                </tr>

                            ))}

                        </tbody>

                    </table>


                    {filteredEmployees.length === 0 && (

                        <div className="employee-no-results">

                            No se encontraron colaboradores con los filtros seleccionados.

                        </div>

                    )}

                </div>

            </section>


            {/* MODAL DE REGISTRO Y EDICIÓN */}

            {showModal && (

                <div className="employee-modal-overlay">


                    <form

                        className="employee-modal"

                        onSubmit={saveEmployee}

                    >


                        <div className="employee-modal-header">

                            <div>

                                <span>GESTIÓN DE PERSONAL</span>

                                <h2>
                                    {form.employee_id
                                        ? 'Editar colaborador'
                                        : 'Nuevo colaborador'}
                                </h2>

                            </div>


                            <button

                                type="button"

                                className="employee-modal-close"

                                onClick={() => setShowModal(false)}

                            >

                                <X size={20} />

                            </button>

                        </div>


                        <div className="employee-form-grid">


                            <div>

                                <label>ID de empleado</label>

                                <input

                                    name="employee_code"

                                    value={form.employee_code}

                                    onChange={handleChange}

                                    placeholder="EMP052"

                                    required

                                />

                            </div>


                            <div>

                                <label>Nombre completo</label>

                                <input

                                    name="full_name"

                                    value={form.full_name}

                                    onChange={handleChange}

                                    placeholder="Nombre y apellidos"

                                    required

                                />

                            </div>


                            <div>

                                <label>Departamento</label>

                                <select

                                    name="department_id"

                                    value={form.department_id}

                                    onChange={(event) => {

                                        setForm(previous => ({

                                            ...previous,

                                            department_id: event.target.value,

                                            work_area_id: ''

                                        }));

                                    }}

                                    required

                                >

                                    <option value="">Seleccionar departamento</option>

                                    {departments.map(department => (

                                        <option

                                            key={department.department_id}

                                            value={department.department_id}

                                        >

                                            {department.department_name}

                                        </option>

                                    ))}

                                </select>

                            </div>


                            <div>

                                <label>Área de trabajo</label>

                                <select

                                    name="work_area_id"

                                    value={form.work_area_id}

                                    onChange={handleChange}

                                    disabled={!form.department_id || loadingAreas}

                                    required

                                >

                                    <option value="">

                                        {loadingAreas
                                            ? 'Cargando áreas...'
                                            : 'Seleccionar área'}

                                    </option>

                                    {areas.map(area => (

                                        <option
                                            key={area.work_area_id}
                                            value={area.work_area_id}
                                        >

                                            {area.area_name}

                                        </option>

                                    ))}

                                </select>

                            </div>


                            <div>

                                <label>Puesto</label>

                                <input

                                    name="job_title"

                                    value={form.job_title}

                                    onChange={handleChange}

                                    placeholder="Puesto del colaborador"

                                    required

                                />

                            </div>


                            <div>

                                <label>Fecha de ingreso</label>

                                <input

                                    type="date"

                                    name="hire_date"

                                    value={form.hire_date}

                                    onChange={handleChange}

                                    required

                                />

                            </div>


                            <div>

                                <label>Estado laboral</label>

                                <select

                                    name="employment_status"

                                    value={form.employment_status}

                                    onChange={handleChange}

                                >

                                    <option value="Activo">Activo</option>

                                    <option value="Inactivo">Inactivo</option>

                                </select>

                            </div>


                        </div>


                        {formError && (

                            <div className="employee-form-error">
                                {formError}
                            </div>

                        )}


                        <div className="employee-modal-actions">


                            <button

                                type="button"

                                className="employee-cancel-button"

                                onClick={() => setShowModal(false)}

                                disabled={saving}

                            >

                                Cancelar

                            </button>


                            <button

                                type="submit"

                                className="employee-save-button"

                                disabled={saving || loadingAreas}

                            >

                                {saving ? (

                                    <LoaderCircle size={17} className="employee-spinner" />

                                ) : (

                                    <Save size={17} />

                                )}

                                {saving ? 'Guardando...' : 'Guardar colaborador'}

                            </button>


                        </div>


                    </form>

                </div>

            )}

            {/* PERFIL INDIVIDUAL */}

            {selectedProfile && (

                <EmployeeProfile

                    employee={selectedProfile}

                    onClose={() => setSelectedProfile(null)}

                />

            )}


        </div>

    );

}

export default EmployeeManagement;