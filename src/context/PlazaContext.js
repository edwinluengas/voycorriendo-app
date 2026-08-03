/**
 * La localidad en la que se está usando la app — SIEMPRE por ubicación real.
 *
 * VoyCorriendo opera en pueblos distintos y separados. Qué negocios y qué
 * repartidores se ven depende de dónde esté físicamente el teléfono, y de
 * nada más: no hay lista de localidades que elegir ni forma de "ponerse" en
 * otro pueblo. Si no se puede saber dónde está, no se muestra catálogo — se
 * dice que no hay cobertura, que es la verdad.
 *
 * Por qué así (decisión del dueño, 2026-08-03): un selector manual invita a
 * mirar el catálogo de un pueblo al que no se puede pedir, y una plaza "por
 * defecto" hace que quien no comparte ubicación vea siempre la misma —que es
 * exactamente el bug que se acaba de corregir.
 *
 * La lista de localidades y el radio vienen del backend
 * (/api/config-publica): abrir una plaza nueva no debe exigir un APK nuevo.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { pedidosAPI } from '../api/client';

// Distancia real en km (haversine). Con grados no se puede: 0.5° son 55 km en
// latitud y bastante menos en longitud, así que un umbral en grados daría un
// área distinta según dónde estés.
const distanciaKm = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (Number(b.latitud) - a.lat) * rad;
  const dLng = (Number(b.longitud) - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(Number(b.latitud) * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// Hasta dónde llega una localidad si el servidor no lo dice. No es la
// cobertura de reparto (6.5 km desde cada negocio) sino el área que
// pertenece al pueblo y sus alrededores.
const RADIO_PLAZA_KM_FALLBACK = 25;

// Estados posibles. `motivo` explica POR QUÉ no hay cobertura, para poder
// ofrecer la acción correcta (dar permiso, encender el GPS, reintentar).
export const PLAZA_ESTADO = {
  BUSCANDO:    'buscando',      // todavía no se sabe
  DENTRO:      'dentro',        // hay localidad y sí hay servicio
  FUERA:       'fuera',         // ubicación conocida, pero lejos de toda plaza
  SIN_PERMISO: 'sin_permiso',   // el usuario no concedió la ubicación
  SIN_GPS:     'sin_gps',       // permiso dado pero no se pudo leer posición
  SIN_RED:     'sin_red',       // no se pudo consultar al servidor
};

const INICIAL = { estado: PLAZA_ESTADO.BUSCANDO, marca: 'VoyCorriendo', slug: null, nombre: null };

const PlazaContext = createContext(null);

/**
 * A qué localidad pertenece un punto. Devuelve `{ plaza, km, dentro }`.
 * Lo usa el onboarding del negocio para decirle al dueño dónde va a quedar
 * ANTES de mandar nada, en vez de que se entere por un error al final.
 */
export const plazaDePunto = (plazas, lat, lng, radioKm = RADIO_PLAZA_KM_FALLBACK) => {
  // OJO: `Number(null)` y `Number('')` son 0, así que isFinite por sí solo
  // daba por buenas unas coordenadas ausentes y las ubicaba en el mar.
  const falta = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v));
  if (!plazas?.length || falta(lat) || falta(lng)) return { plaza: null, km: null, dentro: false };
  const punto = { lat: Number(lat), lng: Number(lng) };
  let mejor = null, menor = Infinity;
  for (const p of plazas) {
    const d = distanciaKm(punto, p);
    if (d < menor) { menor = d; mejor = p; }
  }
  return { plaza: mejor, km: menor, dentro: menor <= radioKm };
};

export function PlazaProvider({ children }) {
  const [valor, setValor]   = useState(INICIAL);
  const [plazas, setPlazas] = useState([]);
  const [radioKm, setRadio] = useState(RADIO_PLAZA_KM_FALLBACK);

  const detectar = useCallback(async () => {
    setValor((v) => (v.estado === PLAZA_ESTADO.DENTRO ? v : { ...INICIAL }));

    // 1. Las localidades donde operamos hoy.
    let lista = [], radio = RADIO_PLAZA_KM_FALLBACK;
    try {
      const { data } = await pedidosAPI.configPublica();
      lista = data?.data?.ciudades || [];
      radio = Number(data?.data?.radio_plaza_km) || RADIO_PLAZA_KM_FALLBACK;
    } catch {
      return setValor({ ...INICIAL, estado: PLAZA_ESTADO.SIN_RED });
    }
    if (!lista.length) return setValor({ ...INICIAL, estado: PLAZA_ESTADO.SIN_RED });
    setPlazas(lista);
    setRadio(radio);

    // 2. Dónde está el teléfono. Sin esto no hay catálogo: es la única
    //    fuente de verdad de qué localidad ve el usuario.
    let permiso;
    try {
      permiso = await Location.getForegroundPermissionsAsync();
      if (!permiso.granted && permiso.canAskAgain) {
        permiso = await Location.requestForegroundPermissionsAsync();
      }
    } catch {
      return setValor({ ...INICIAL, estado: PLAZA_ESTADO.SIN_GPS });
    }
    if (!permiso?.granted) return setValor({ ...INICIAL, estado: PLAZA_ESTADO.SIN_PERMISO });

    let pos = null;
    try {
      // La última conocida es instantánea; si no hay (teléfono recién
      // encendido), se pide una lectura real.
      pos = await Location.getLastKnownPositionAsync()
         || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch { pos = null; }
    if (!pos) return setValor({ ...INICIAL, estado: PLAZA_ESTADO.SIN_GPS });

    // 3. La localidad que le corresponde a ese punto.
    const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    let cercana = null, km = Infinity;
    for (const p of lista) {
      const d = distanciaKm(punto, p);
      if (d < km) { km = d; cercana = p; }
    }
    if (!cercana || km > radio) {
      return setValor({ ...INICIAL, estado: PLAZA_ESTADO.FUERA, kmALaMasCercana: Math.round(km) });
    }
    setValor({ ...cercana, estado: PLAZA_ESTADO.DENTRO });
  }, []);

  useEffect(() => { detectar(); }, [detectar]);

  // Si el usuario sale a Ajustes a conceder el permiso o a encender el GPS,
  // al volver a la app se reintenta solo — sin esto tendría que cerrarla y
  // volverla a abrir para que sirviera.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') return;
      setValor((v) => {
        if (v.estado !== PLAZA_ESTADO.DENTRO) detectar();
        return v;
      });
    });
    return () => sub.remove();
  }, [detectar]);

  const contexto = useMemo(
    () => ({
      ...valor,
      plazas, radioKm,
      // Estado resumido para las pantallas: `lista` = ya se sabe algo;
      // `hayCobertura` = se puede mostrar catálogo y dejar pedir.
      lista: valor.estado !== PLAZA_ESTADO.BUSCANDO,
      hayCobertura: valor.estado === PLAZA_ESTADO.DENTRO,
      reintentar: detectar,
    }),
    [valor, plazas, radioKm, detectar],
  );

  return <PlazaContext.Provider value={contexto}>{children}</PlazaContext.Provider>;
}

export function usePlaza() {
  const ctx = useContext(PlazaContext);
  // Sin provider se devuelve el estado inicial en vez de reventar: una
  // pantalla suelta (deep link, preview) debe seguir dibujándose.
  return ctx || {
    ...INICIAL, plazas: [], radioKm: RADIO_PLAZA_KM_FALLBACK,
    lista: false, hayCobertura: false, reintentar: () => {},
  };
}

export default PlazaContext;
