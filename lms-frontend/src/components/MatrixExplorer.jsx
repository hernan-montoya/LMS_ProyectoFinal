import { useEffect, useState } from 'react';

import {
  Building2,
  Layers3,
  Users,
  ChevronRight,
  ArrowLeft,
  LoaderCircle,
  AlertTriangle
} from 'lucide-react';

import CompetencyMatrix from './CompetencyMatrix';

import './MatrixExplorer.css';

const API_URL = import.meta.env.VITE_API_URL;


// COLORES E ICONOS DE DEPARTAMENTOS

const DEPARTMENT_STYLES = {
  RH: 'purple',
  FIN: 'blue',
  COM: 'orange',
  LOG: 'green',
  DIR: 'red',
  PROD: 'cyan',
  EMB: 'pink'
};


function MatrixExplorer() {

  const [departments, setDepartments] = useState([]);

  const [areas, setAreas] = useState([]);

  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const [selectedArea, setSelectedArea] = useState(null);

  const [loadingDepartments, setLoadingDepartments] = useState(true);

  const [loadingAreas, setLoadingAreas] = useState(false);

  const [error, setError] = useState('');


  // 1. CONSULTAR DEPARTAMENTOS

  useEffect(() => {

    const controller = new AbortController();

    const fetchDepartments = async () => {

      try {

        setLoadingDepartments(true);
        setError('');

        const response = await fetch(
          `${API_URL}/departments`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('No fue posible consultar los departamentos.');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error('Respuesta incorrecta del servidor.');
        }

        setDepartments(result.data);

      } catch (err) {

        if (err.name !== 'AbortError') {
          setError(err.message);
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


  // 2. CONSULTAR ÁREAS DEL DEPARTAMENTO

  useEffect(() => {

    if (!selectedDepartment) {
      setAreas([]);
      return;
    }

    const controller = new AbortController();

    const fetchAreas = async () => {

      try {

        setLoadingAreas(true);
        setError('');

        const response = await fetch(

          `${API_URL}/departments/${selectedDepartment.department_id}/areas`,

          { signal: controller.signal }

        );

        if (!response.ok) {
          throw new Error('No fue posible consultar las áreas.');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error('Error al obtener las áreas.');
        }

        setAreas(result.data);

      } catch (err) {

        if (err.name !== 'AbortError') {
          setError(err.message);
        }

      } finally {

        if (!controller.signal.aborted) {
          setLoadingAreas(false);
        }

      }

    };

    fetchAreas();

    return () => controller.abort();

  }, [selectedDepartment]);


  // 3. SELECCIONAR DEPARTAMENTO

  const openDepartment = (department) => {

    setSelectedDepartment(department);

    setSelectedArea(null);

  };


  // 4. REGRESAR

  const goBack = () => {

    if (selectedArea) {

      setSelectedArea(null);

    } else {

      setSelectedDepartment(null);

    }

    setError('');

  };


  // ESTADO DE CARGA

  if (loadingDepartments) {

    return (

      <div className="matrix-explorer-state">

        <LoaderCircle size={30} />

        <p>Cargando departamentos...</p>

      </div>

    );

  }


  // ERROR GENERAL

  if (error && !selectedDepartment) {

    return (

      <div className="matrix-explorer-state explorer-error">

        <AlertTriangle size={30} />

        <p>{error}</p>

      </div>

    );

  }


  return (

    <div className="matrix-explorer">


      {/* ENCABEZADO */}

      <div className="explorer-heading">

        <div>

          <span>MATRIZ DE COMPETENCIAS</span>

          <h2>Gestión de matrices ILUO</h2>

          <p>
            Consulta, analiza y administra el dominio de competencias
            de los colaboradores.
          </p>

        </div>

      </div>


      {/* VISTA 1: DEPARTAMENTOS */}

      {!selectedDepartment && (

        <>

          <div className="explorer-section-heading">

            <div>

              <h3>Selecciona un departamento</h3>

              <p>
                Selecciona el departamento cuya matriz deseas consultar.
              </p>

            </div>

            <span>{departments.length} departamentos</span>

          </div>


          <div className="explorer-department-grid">

            {departments.map(department => (

              <button

                key={department.department_id}

                className="explorer-department-card"

                onClick={() => openDepartment(department)}

              >

                <div className={`explorer-department-icon ${
                  DEPARTMENT_STYLES[department.department_code] || 'blue'
                }`}>

                  <Building2 size={23} />

                </div>


                <div>

                  <h3>{department.department_name}</h3>

                  <span>
                    {department.employee_count} colaboradores
                  </span>

                </div>


                <ChevronRight size={20} />

              </button>

            ))}

          </div>

        </>

      )}


      {/* VISTA 2: ÁREAS */}

      {selectedDepartment && !selectedArea && (

        <>

          <button
            className="explorer-back-button"
            onClick={goBack}
          >

            <ArrowLeft size={16} />

            Volver a departamentos

          </button>


          <div className="explorer-section-heading">

            <div>

              <h3>{selectedDepartment.department_name}</h3>

              <p>
                Selecciona el área de trabajo que deseas evaluar.
              </p>

            </div>

            <span>
              {selectedDepartment.employee_count} colaboradores
            </span>

          </div>


          {loadingAreas ? (

            <div className="matrix-explorer-state">

              <LoaderCircle size={28} />

              <p>Consultando áreas de trabajo...</p>

            </div>

          ) : error ? (

            <div className="explorer-error">
              {error}
            </div>

          ) : areas.length > 0 ? (

            <div className="explorer-area-grid">

              {areas.map(area => (

                <button

                  key={area.work_area_id}

                  className="explorer-area-card"

                  onClick={() => setSelectedArea(area)}

                >

                  <div className="explorer-area-icon">

                    <Layers3 size={22} />

                  </div>


                  <div className="explorer-area-info">

                    <div className="explorer-area-title">

                      <h3>{area.area_name}</h3>

                      {Boolean(Number(area.is_management_area)) && (

                        <span>Gestión</span>

                      )}

                    </div>

                    <p>{area.description}</p>

                    <small>
                      {area.employee_count} colaboradores
                    </small>

                  </div>


                  <ChevronRight size={20} />

                </button>

              ))}

            </div>

          ) : (

            <div className="explorer-empty">

              Este departamento todavía no tiene áreas registradas.

            </div>

          )}

        </>

      )}


      {/* VISTA 3: MATRIZ ILUO */}

      {selectedDepartment && selectedArea && (

        <>

          <button
            className="explorer-back-button"
            onClick={goBack}
          >

            <ArrowLeft size={16} />

            Volver a áreas

          </button>


          {error && (

            <div className="explorer-error">
              {error}
            </div>

          )}


          <div className="explorer-breadcrumb">

            {selectedDepartment.department_name}

            <ChevronRight size={14} />

            {selectedArea.area_name}

          </div>


          <CompetencyMatrix
            key={selectedArea.work_area_id}
            workArea={selectedArea}
          />

        </>

      )}


    </div>

  );

}

export default MatrixExplorer;