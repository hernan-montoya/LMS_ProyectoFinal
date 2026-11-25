import { useCallback, useEffect, useState } from 'react';

import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  RefreshCw,
  MapPin
} from 'lucide-react';

import './WeatherWidget.css';


// DESCRIPCIONES DE CONDICIONES METEOROLÓGICAS

const getWeatherDescription = (code) => {

  const descriptions = {

    0: 'Despejado',
    1: 'Principalmente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',

    45: 'Niebla',
    48: 'Niebla con escarcha',

    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna intensa',

    56: 'Llovizna helada ligera',
    57: 'Llovizna helada intensa',

    61: 'Lluvia ligera',
    63: 'Lluvia moderada',
    65: 'Lluvia intensa',

    66: 'Lluvia helada ligera',
    67: 'Lluvia helada intensa',

    71: 'Nevada ligera',
    73: 'Nevada moderada',
    75: 'Nevada intensa',

    77: 'Granizo fino',

    80: 'Chubascos ligeros',
    81: 'Chubascos moderados',
    82: 'Chubascos intensos',

    85: 'Nevada ligera',
    86: 'Nevada intensa',

    95: 'Tormenta eléctrica',
    96: 'Tormenta con granizo',
    99: 'Tormenta intensa con granizo'

  };

  return descriptions[code] || 'Condiciones variables';

};


// ICONO SEGÚN CONDICIÓN

const getWeatherIcon = (code, isDay) => {

  if (code === 0) {
    return isDay ? Sun : Moon;
  }

  if (code === 1 || code === 2) {
    return isDay ? CloudSun : CloudMoon;
  }

  if (code === 3) {
    return Cloud;
  }

  if (code === 45 || code === 48) {
    return CloudFog;
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return CloudDrizzle;
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return CloudRain;
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return CloudSnow;
  }

  if ([95, 96, 99].includes(code)) {
    return CloudLightning;
  }

  return CloudSun;

};


function WeatherWidget() {

  const [weather, setWeather] = useState(null);

  const [locationName, setLocationName] = useState('');

  const [status, setStatus] = useState('loading');

  const [error, setError] = useState('');


  // CONSULTAR CLIMA CON COORDENADAS

  const fetchWeather = useCallback(async (
    latitude,
    longitude,
    location
  ) => {

    try {

      setStatus('loading');
      setError('');

      const params = new URLSearchParams({

        latitude: latitude.toString(),

        longitude: longitude.toString(),

        current: [
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'is_day',
          'precipitation',
          'weather_code',
          'wind_speed_10m'
        ].join(','),

        temperature_unit: 'celsius',

        wind_speed_unit: 'kmh',

        timezone: 'auto'

      });


      const response = await fetch(

        `https://api.open-meteo.com/v1/forecast?${params}`

      );


      if (!response.ok) {

        throw new Error('No fue posible obtener los datos meteorológicos.');

      }


      const result = await response.json();


      if (!result.current) {

        throw new Error('La API no devolvió condiciones actuales.');

      }


      setWeather(result.current);

      setLocationName(location);

      setStatus('success');


    } catch (err) {

      console.error('Error meteorológico:', err);

      setError(err.message);

      setStatus('error');

    }

  }, []);


  // OBTENER UBICACIÓN DEL NAVEGADOR

  const requestWeather = useCallback(() => {

    if (!navigator.geolocation) {

      setStatus('error');

      setError('Tu navegador no permite consultar la ubicación.');

      return;

    }


    setStatus('loading');

    setError('');


    navigator.geolocation.getCurrentPosition(

      (position) => {

        const { latitude, longitude } = position.coords;

        fetchWeather(
          latitude,
          longitude,
          'Ubicación actual'
        );

      },


      (geoError) => {

        setStatus('error');


        if (geoError.code === 1) {

          setError('Permite el acceso a tu ubicación.');

        } else if (geoError.code === 2) {

          setError('No se pudo determinar tu ubicación.');

        } else {

          setError('Tiempo de espera agotado.');

        }

      },


      {

        enableHighAccuracy: false,

        timeout: 10000,

        maximumAge: 900000

      }

    );

  }, [fetchWeather]);


  // CONSULTAR AL INICIAR

  useEffect(() => {

    requestWeather();

  }, [requestWeather]);


  // ICONO DINÁMICO

  const WeatherIcon = weather

    ? getWeatherIcon(
        weather.weather_code,
        weather.is_day === 1
      )

    : CloudSun;


  return (

    <div className="weather-widget">


      <div className="weather-main-icon">

        <WeatherIcon size={25} />

      </div>


      <div className="weather-information">


        {status === 'loading' && (

          <>

            <strong>Clima</strong>

            <span>Consultando condiciones...</span>

          </>

        )}


        {status === 'success' && weather && (

          <>

            <strong>

              {Math.round(weather.temperature_2m)}°C

              <span className="weather-separator"> · </span>

              {getWeatherDescription(weather.weather_code)}

            </strong>


            <span>

              <MapPin size={11} />

              {locationName}

              {' · '}

              Sensación {Math.round(weather.apparent_temperature)}°C

            </span>

          </>

        )}


        {status === 'error' && (

          <>

            <strong>Clima no disponible</strong>

            <span>{error}</span>

          </>

        )}


        {status === 'success' && (

          <a

            className="weather-attribution"

            href="https://open-meteo.com/"

            target="_blank"

            rel="noreferrer"

          >

            Datos: Open-Meteo

          </a>

        )}


      </div>


      <button

        className="weather-refresh"

        onClick={requestWeather}

        disabled={status === 'loading'}

        title="Actualizar clima"

        aria-label="Actualizar clima"

      >

        <RefreshCw
          size={15}
          className={status === 'loading' ? 'weather-spinning' : ''}
        />

      </button>


    </div>

  );

}

export default WeatherWidget;