import { useEffect, useMemo, useState } from 'react';
import CompetencyAnalytics from './CompetencyAnalytics';

import {
    Search,
    Users,
    Layers3,
    CalendarDays,
    X,
    Save,
    LoaderCircle,
    Filter,
    RotateCcw
} from 'lucide-react';

import './CompetencyMatrix.css';

const API_URL = import.meta.env.VITE_API_URL;

const ILUO_LEVELS = [
    { value: 'I', label: 'Inicial' },
    { value: 'L', label: 'Limitado' },
    { value: 'U', label: 'Autónomo' },
    { value: 'O', label: 'Orientador' }
];

function CompetencyMatrix({ workArea }) {

    const [records, setRecords] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');

    // Filtros avanzados de la matriz

    const [selectedCompetency, setSelectedCompetency] = useState('all');

    const [levelFilter, setLevelFilter] = useState('all');

    const [selectedEvaluation, setSelectedEvaluation] = useState(null);

    const [newLevel, setNewLevel] = useState('');
    const [evaluatorName, setEvaluatorName] = useState('');
    const [observations, setObservations] = useState('');

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // 1. Consultar las evaluaciones desde MySQL

    useEffect(() => {

        const controller = new AbortController();

        const fetchMatrix = async () => {

            try {

                setLoading(true);
                setError('');

                const response = await fetch(
                    `${API_URL}/areas/${workArea.work_area_id}/competencies`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success || !Array.isArray(result.data)) {
                    throw new Error('No se pudo obtener la matriz de competencias.');
                }

                setRecords(result.data);

                console.log(
                    'Matriz ILUO recibida desde MySQL:',
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

        if (workArea?.work_area_id) {
            fetchMatrix();
        }

        return () => controller.abort();

    }, [workArea.work_area_id]);


    // 2. Organizar los registros en una matriz

    const { employees, competencies } = useMemo(() => {

        const employeeMap = new Map();
        const competencyMap = new Map();

        records.forEach((record) => {

            // Registrar competencias únicas

            if (!competencyMap.has(record.competency_id)) {

                competencyMap.set(record.competency_id, {
                    competency_id: record.competency_id,
                    competency_code: record.competency_code,
                    competency_name: record.competency_name
                });

            }

            // Registrar colaboradores únicos

            if (!employeeMap.has(record.employee_id)) {

                employeeMap.set(record.employee_id, {
                    employee_id: record.employee_id,
                    employee_code: record.employee_code,
                    full_name: record.full_name,
                    job_title: record.job_title,
                    evaluations: {}
                });

            }

            // Asociar cada evaluación con su competencia

            const employee = employeeMap.get(record.employee_id);

            employee.evaluations[record.competency_id] = record;

        });

        const competencyList = Array.from(competencyMap.values());


        // Calcular dominio individual de cada colaborador

        const employeeList = Array.from(employeeMap.values()).map(employee => {

            const evaluatedRecords = Object.values(employee.evaluations)

                .filter(evaluation =>

                    ['I', 'L', 'U', 'O'].includes(

                        String(evaluation?.iluo_level || '').toUpperCase()

                    )

                );


            const masteredCompetencies = evaluatedRecords.filter(evaluation => {

                const level = String(
                    evaluation.iluo_level
                ).toUpperCase();

                return level === 'U' || level === 'O';

            }).length;


            const proficiencyPercent = evaluatedRecords.length

                ? Math.round(
                    (masteredCompetencies / evaluatedRecords.length) * 100
                )

                : 0;


            return {

                ...employee,

                evaluatedCompetencies: evaluatedRecords.length,

                masteredCompetencies,

                proficiencyPercent

            };

        });


        return {

            employees: employeeList,

            competencies: competencyList

        };

    }, [records]);


    // 3. Filtrar colaboradores

    const filteredEmployees = useMemo(() => {

        return employees.filter(employee => {

            const text = search.toLowerCase();


            // Buscar por nombre, ID o puesto

            const matchesSearch =

                employee.full_name.toLowerCase().includes(text) ||

                employee.employee_code.toLowerCase().includes(text) ||

                employee.job_title.toLowerCase().includes(text);


            // Determinar qué competencias revisar

            const evaluationsToCheck = selectedCompetency === 'all'

                ? competencies.map(competency =>

                    employee.evaluations[competency.competency_id]

                )

                : [

                    employee.evaluations[Number(selectedCompetency)]

                ];


            // Filtrar según nivel ILUO

            let matchesLevel = true;


            if (levelFilter === 'SIN_EVALUAR') {

                matchesLevel = evaluationsToCheck.some(evaluation =>

                    !evaluation ||

                    !['I', 'L', 'U', 'O'].includes(

                        String(evaluation.iluo_level || '').toUpperCase()

                    )

                );

            } else if (levelFilter !== 'all') {

                matchesLevel = evaluationsToCheck.some(evaluation =>

                    String(evaluation?.iluo_level || '').toUpperCase() === levelFilter

                );

            }


            return matchesSearch && matchesLevel;

        });

    }, [

        employees,

        competencies,

        search,

        selectedCompetency,

        levelFilter

    ]);


    // 4. Abrir ventana de edición

    const openEvaluation = (evaluation, employee) => {

        if (!evaluation) return;

        setSelectedEvaluation({
            ...evaluation,
            employee_name: employee.full_name,
            competency_name: evaluation.competency_name
        });

        setNewLevel(evaluation.iluo_level || '');

        setEvaluatorName(evaluation.evaluator_name || '');

        setObservations(evaluation.observations || '');

        setSaveError('');

    };


    // 5. Actualizar evaluación en MySQL

    const saveEvaluation = async (event) => {

        event.preventDefault();

        if (!ILUO_LEVELS.some(level => level.value === newLevel)) {
            setSaveError('Selecciona un nivel ILUO válido.');
            return;
        }

        if (!evaluatorName.trim()) {
            setSaveError('Debes indicar el nombre del evaluador.');
            return;
        }

        try {

            setSaving(true);
            setSaveError('');

            const response = await fetch(
                `${API_URL}/assessments/${selectedEvaluation.assessment_id}`,
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        iluo_level: newLevel,
                        evaluator_name: evaluatorName.trim(),
                        observations: observations.trim()
                    })

                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || 'No fue posible actualizar la evaluación.'
                );
            }

            // Actualizar la matriz sin volver a cargar toda la página

            setRecords((previousRecords) =>

                previousRecords.map((record) =>

                    record.assessment_id === selectedEvaluation.assessment_id

                        ? {
                            ...record,
                            iluo_level: newLevel,
                            evaluator_name: evaluatorName.trim(),
                            observations: observations.trim(),
                            evaluation_date:
                                result.data?.evaluation_date ?? record.evaluation_date
                        }

                        : record

                )

            );

            setSelectedEvaluation(null);

        } catch (err) {

            console.error(err);
            setSaveError(err.message);

        } finally {

            setSaving(false);

        }

    };


    // 6. Estados de carga y errores

    if (loading) {

        return (

            <div className="matrix-message">

                <LoaderCircle className="loading-icon" size={28} />

                <p>Construyendo matriz de competencias...</p>

            </div>

        );

    }

    if (error) {

        return (

            <div className="matrix-error">
                Error al cargar la matriz: {error}
            </div>

        );

    }


    return (

        <div className="matrix-container">

            {/* ENCABEZADO */}

            <div className="matrix-header">

                <div>

                    <span className="matrix-label">
                        MATRIZ DE COMPETENCIAS
                    </span>

                    <h2>{workArea.area_name}</h2>

                    <p>
                        Evaluación de competencias mediante metodología ILUO.
                    </p>

                </div>

                <div className="matrix-statistics">

                    <div>
                        <Users size={20} />
                        <strong>{employees.length}</strong>
                        <span>Colaboradores</span>
                    </div>

                    <div>
                        <Layers3 size={20} />
                        <strong>{competencies.length}</strong>
                        <span>Competencias</span>
                    </div>

                </div>

            </div>

            {/* ANÁLISIS DE COMPETENCIAS */}

            <CompetencyAnalytics records={records} />


            {/* BUSCADOR */}

            {/* FILTROS AVANZADOS */}

            <div className="matrix-toolbar matrix-toolbar-advanced">


                <div className="matrix-filter-grid">


                    {/* BUSCADOR */}

                    <div className="matrix-filter-search">

                        <label>Buscar colaborador</label>

                        <div className="matrix-search">

                            <Search size={17} />

                            <input

                                type="text"

                                placeholder="Nombre, ID o puesto..."

                                value={search}

                                onChange={event => setSearch(event.target.value)}

                            />

                        </div>

                    </div>


                    {/* FILTRO DE COMPETENCIA */}

                    <div className="matrix-filter-control">

                        <label>Competencia</label>

                        <select

                            value={selectedCompetency}

                            onChange={event => setSelectedCompetency(event.target.value)}

                        >

                            <option value="all">
                                Todas las competencias
                            </option>

                            {competencies.map(competency => (

                                <option

                                    key={competency.competency_id}

                                    value={competency.competency_id}

                                >

                                    {competency.competency_name}

                                </option>

                            ))}

                        </select>

                    </div>


                    {/* FILTRO ILUO */}

                    <div className="matrix-filter-control">

                        <label>Nivel ILUO</label>

                        <select

                            value={levelFilter}

                            onChange={event => setLevelFilter(event.target.value)}

                        >

                            <option value="all">Todos los niveles</option>

                            <option value="I">I - Inicial</option>

                            <option value="L">L - Limitado</option>

                            <option value="U">U - Autónomo</option>

                            <option value="O">O - Orientador</option>

                            <option value="SIN_EVALUAR">Sin evaluar</option>

                        </select>

                    </div>


                    {/* LIMPIAR FILTROS */}

                    <button

                        className="matrix-reset-button"

                        onClick={() => {

                            setSearch('');

                            setSelectedCompetency('all');

                            setLevelFilter('all');

                        }}

                    >

                        <RotateCcw size={16} />

                        Limpiar filtros

                    </button>


                </div>


                <div className="matrix-filter-results">

                    <Filter size={14} />

                    {filteredEmployees.length} colaboradores encontrados

                </div>


            </div>


            {/* LEYENDA ILUO */}

            <div className="matrix-legend">

                <span>NIVELES ILUO:</span>

                {ILUO_LEVELS.map((level) => (

                    <div key={level.value} className="legend-item">

                        <span className={`level-dot level-${level.value.toLowerCase()}`}>
                            {level.value}
                        </span>

                        <span>{level.label}</span>

                    </div>

                ))}

                <div className="legend-item">

                    <span className="level-dot level-empty">—</span>

                    <span>Sin evaluar</span>

                </div>

            </div>


            {/* TABLA DE COMPETENCIAS */}

            <div className="matrix-table-wrapper">

                <table className="competency-table">

                    <thead>

                        <tr>

                            <th className="employee-column">
                                COLABORADOR
                            </th>

                            <th className="mastery-column">
                                DOMINIO U + O
                            </th>

                            {competencies.map((competency) => (

                                <th key={competency.competency_id}>

                                    <div className="competency-heading">

                                        {competency.competency_name}

                                    </div>

                                </th>

                            ))}

                        </tr>

                    </thead>


                    <tbody>

                        {filteredEmployees.map((employee) => (

                            <tr key={employee.employee_id}>

                                <td className="employee-cell">

                                    <strong>{employee.full_name}</strong>

                                    <span>{employee.employee_code}</span>

                                    <small>{employee.job_title}</small>

                                </td>

                                <td className="mastery-cell">

                                    <div className="mastery-value">

                                        {employee.masteredCompetencies}/
                                        {employee.evaluatedCompetencies}

                                    </div>


                                    <div className="mastery-track">

                                        <div

                                            className="mastery-fill"

                                            style={{
                                                width: `${employee.proficiencyPercent}%`
                                            }}

                                        />

                                    </div>


                                    <small>{employee.proficiencyPercent}% de dominio</small>

                                </td>


                                {competencies.map((competency) => {

                                    const evaluation =
                                        employee.evaluations[competency.competency_id];

                                    const level = evaluation?.iluo_level;

                                    return (

                                        <td key={competency.competency_id}>

                                            <button

                                                type="button"

                                                disabled={!evaluation}

                                                className={`level-button ${level
                                                    ? `level-${level.toLowerCase()}`
                                                    : 'level-empty'
                                                    }`}

                                                onClick={() =>
                                                    openEvaluation(evaluation, employee)
                                                }

                                                title={
                                                    evaluation
                                                        ? 'Modificar evaluación'
                                                        : 'Sin evaluación registrada'
                                                }

                                            >

                                                {level || '—'}

                                            </button>

                                        </td>

                                    );

                                })}

                            </tr>

                        ))}

                    </tbody>

                </table>

                {filteredEmployees.length === 0 && (

                    <div className="matrix-empty">
                        No se encontraron colaboradores.
                    </div>

                )}

            </div>


            {/* VENTANA DE EDICIÓN */}

            {selectedEvaluation && (

                <div className="modal-overlay">

                    <form
                        className="evaluation-modal"
                        onSubmit={saveEvaluation}
                    >

                        <div className="modal-header">

                            <div>

                                <span>ACTUALIZAR EVALUACIÓN</span>

                                <h2>Competencia ILUO</h2>

                            </div>

                            <button

                                type="button"

                                className="modal-close"

                                onClick={() => setSelectedEvaluation(null)}

                            >

                                <X size={20} />

                            </button>

                        </div>


                        <div className="modal-information">

                            <strong>{selectedEvaluation.employee_name}</strong>

                            <p>{selectedEvaluation.competency_name}</p>

                            <small>
                                ID de evaluación: {selectedEvaluation.assessment_id}
                            </small>

                        </div>


                        <label className="form-label">
                            Seleccionar nuevo nivel
                        </label>


                        <div className="level-selector">

                            {ILUO_LEVELS.map((level) => (

                                <button

                                    key={level.value}

                                    type="button"

                                    className={`level-option level-${level.value.toLowerCase()} ${newLevel === level.value ? 'selected' : ''
                                        }`}

                                    onClick={() => setNewLevel(level.value)}

                                >

                                    <strong>{level.value}</strong>

                                    <span>{level.label}</span>

                                </button>

                            ))}

                        </div>


                        <label className="form-label">
                            Evaluador
                        </label>

                        <input

                            className="modal-input"

                            type="text"

                            value={evaluatorName}

                            onChange={(event) =>
                                setEvaluatorName(event.target.value)
                            }

                            placeholder="Nombre del evaluador"

                        />


                        <label className="form-label">
                            Observaciones
                        </label>

                        <textarea

                            className="modal-textarea"

                            value={observations}

                            onChange={(event) =>
                                setObservations(event.target.value)
                            }

                            placeholder="Describe los resultados de la evaluación..."

                        />


                        {saveError && (

                            <div className="save-error">
                                {saveError}
                            </div>

                        )}


                        <div className="modal-actions">

                            <button

                                type="button"

                                className="cancel-button"

                                onClick={() => setSelectedEvaluation(null)}

                                disabled={saving}

                            >

                                Cancelar

                            </button>


                            <button

                                type="submit"

                                className="save-button"

                                disabled={saving}

                            >

                                {saving ? (

                                    <LoaderCircle size={17} className="loading-icon" />

                                ) : (

                                    <Save size={17} />

                                )}

                                {saving ? 'Guardando...' : 'Guardar evaluación'}

                            </button>

                        </div>

                    </form>

                </div>

            )}

            <div className="matrix-polyvalence-note">

                <strong>Indicador de polivalencia:</strong>

                Se consideran competencias dominadas aquellas evaluadas
                en niveles U (Autónomo) y O (Orientador).
                El porcentaje se calcula sobre las competencias
                evaluadas del área de trabajo seleccionada.

            </div>

        </div>

    );

}

export default CompetencyMatrix;