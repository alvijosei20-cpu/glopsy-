import { useEffect, useState } from 'react';
import api from '../services/api';

const STORAGE_CITY = 'location_city';
const STORAGE_DATA = 'location_data';

export const DEFAULT_CITY = 'Bogotá D.C.';
export const CITY_EVENT = 'glopsy:city-change';

export const getStoredCity = () => {
  try {
    const raw = localStorage.getItem(STORAGE_DATA) || sessionStorage.getItem(STORAGE_DATA) || '{}';
    const data = JSON.parse(raw);
    if (data && data.city) return data.city;
  } catch {}
  return (
    localStorage.getItem(STORAGE_CITY) ||
    sessionStorage.getItem(STORAGE_CITY) ||
    DEFAULT_CITY
  );
};

export const saveCity = ({ city, departamento = '', source = 'manual' }) => {
  const clean = String(city || '').trim();
  if (!clean) return;
  const data = { city: clean, departamento: String(departamento || ''), source, ts: Date.now() };
  try {
    localStorage.setItem(STORAGE_DATA, JSON.stringify(data));
    localStorage.setItem(STORAGE_CITY, clean);
    sessionStorage.setItem(STORAGE_DATA, JSON.stringify(data));
    sessionStorage.setItem(STORAGE_CITY, clean);
  } catch {}
  window.dispatchEvent(new CustomEvent(CITY_EVENT, { detail: data }));
};

// Hook que re-renderiza cuando cambia la ciudad (storage u otro componente).
export function useUserCity() {
  const [city, setCity] = useState(getStoredCity);
  useEffect(() => {
    const sync = () => setCity(getStoredCity());
    window.addEventListener('storage', sync);
    window.addEventListener(CITY_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CITY_EVENT, sync);
    };
  }, []);
  return city;
}

// Geolocalización: DEBE llamarse dentro de un gesto del usuario (requisito iOS/Safari).
export const requestGeolocation = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const err = new Error('Geolocalización no soportada en este navegador.');
      err.code = 'unsupported';
      return reject(err);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  });

export const reverseCity = async (lat, lon) => {
  const { data } = await api.get('/geo/reverse', { params: { lat, lon } });
  return data?.ok ? data.ubicacion || null : null;
};

// Ciudades con cobertura de envío (según centros de distribución activos).
let supportedPromise = null;
export const getSupportedCities = () => {
  if (!supportedPromise) {
    supportedPromise = api
      .get('/geo/fullments')
      .then(({ data }) => {
        const map = new Map();
        for (const r of data?.fullments || []) {
          if (r.ciudad_id && r.ciudad_nombre) map.set(String(r.ciudad_id), r);
        }
        return [...map.values()];
      })
      .catch(() => []);
  }
  return supportedPromise;
};
