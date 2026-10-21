/**
 * La localidad en la que se está usando la app — SIEMPRE por ubicación real.
 *
 * VoyCorriendo opera en pueblos distintos y separados. Qué negocios y qué
 * repartidores se ven depende de dónde esté físicamente el teléfono, y de
 * nada más: no hay lista de localidades que elegir ni forma de "ponerse" en
 * otro pueblo. Si no se puede saber dónde está, no se muestra catálogo.
 *
 * Por qué así (decisión del dueño, 2026-08-03): un selector manual invita a
 * mirar el catálogo de un pueblo al que no se puede pedir, y una localidad
 * "por defecto" hace que quien no comparte ubicación vea siempre la misma.
 *
 * OJO — la detección corre UNA a la vez (`corriendoRef`). Pedir el permiso
 * manda la app a segundo plano mientras se ve el diálogo del sistema, y al
 * volver el listener de AppState disparaba una segunda detección encima de
 * la primera: Android rechaza una petición de permiso con otra en curso, el
 * error caía en el catch y la app decía "sin cobertura" en un pueblo donde
 * SÍ hay servicio, justo después de que el usuario aceptara el permiso.
 *
 * La lista de localidades y el radio vienen del backend
 * (/api/config-publica): abrir una plaza nueva no debe exigir un APK nuevo.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { pedidosAPI } from '../api/client';
import { useAuth } from './AuthContext';

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

// Una lectura de GPS no puede dejar la app colgada para siempre: bajo techo
// o con mala señal, `getCurrentPositionAsync` puede no volver nunca.
const TIMEOUT_GPS_MS = 12000;

export const PLAZA_ESTADO = {
  BUSCANDO:          'buscando',            // todavía no se sabe
  DENTRO:            'dentro',              // hay localidad y sí hay servicio
  FUERA:             'fuera',               // ubicación conocida, lejos de toda plaza
  SIN_PERMISO:       'sin_permiso',         // se puede volver a preguntar
  PERMISO_BLOQUEADO: 'permiso_bloqueado',   // "no volver a preguntar" → Ajustes
  UBICACION_APAGADA: 'ubicacion_apagada',   // servicios de ubicación del sistema apagados
  SIN_GPS:           'sin_gps',             // permiso dado pero no se pudo leer posición
  SIN_RED:           'sin_red',             // no se pudo consultar al servidor
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

/** Abre los ajustes de la app para que el usuario conceda el permiso a mano. */
export const abrirAjustes = () => {
  Linking.openSettings().catch(() => {});
};

export function PlazaProvider({ children }) {
  const [valor, setValor]   = useState(INICIAL);
  const [plazas, setPlazas] = useState([]);
  const [radioKm, setRadio] = useState(RADIO_PLAZA_KM_FALLBACK);
  // Serializa las detecciones: ver la nota de arriba sobre la carrera con el
  // diálogo de permiso.
  const corriendoRef = useRef(false);
  // La localidad anclada del usuario en sesión, en una ref para que
  // `detectar` (que se crea una sola vez) siempre lea el valor vigente.
  const { usuario } = useAuth();
  const ciudadFijaRef = useRef(null);
  ciudadFijaRef.current = usuario?.ciudad_fija || null;

  /**
   * @param {boolean} pedirPermiso  Si es `true` se dispara el diálogo del
   *   sistema. Por defecto NO: la app solo consulta el permiso que ya haya.
   *
   * Es deliberado. El diálogo de Android solo se puede mostrar una vez con
   * provecho —si el usuario dice que no, la segunda vez ya trae "no volver a
   * preguntar" y a la tercera no aparece— así que gastarlo al arrancar, sin
   * contexto y sobre la pantalla de bienvenida, es la peor forma de pedirlo.
   * Primero se le explica para qué sirve (pantalla propia en el inicio del
   * cliente) y solo cuando él toca el botón se llama a `solicitarPermiso`.
   * Es lo que hacen Uber y Rappi, y por eso casi nadie les dice que no.
   */
  const detectar = useCallback(async (pedirPermiso = false) => {
    if (corriendoRef.current) return;
    corriendoRef.current = true;
    const fijar = (v) => { setValor(v); };
    try {
      setValor((v) => (v.estado === PLAZA_ESTADO.DENTRO ? v : { ...INICIAL }));

      // 1. Las localidades donde operamos hoy.
      let lista = [], radio = RADIO_PLAZA_KM_FALLBACK;
      try {
        const { data } = await pedidosAPI.configPublica();
        lista = data?.data?.ciudades || [];
        radio = Number(data?.data?.radio_plaza_km) || RADIO_PLAZA_KM_FALLBACK;
      } catch {
        return fijar({ ...INICIAL, estado: PLAZA_ESTADO.SIN_RED });
      }
      if (!lista.length) return fijar({ ...INICIAL, estado: PLAZA_ESTADO.SIN_RED });
      setPlazas(lista);
      setRadio(radio);

      // Cuenta con localidad ANCLADA: se salta el GPS por completo. Solo la
      // tiene la cuenta que se le entrega a la tienda de aplicaciones para
      // revisar la app — un revisor no está en Oaxaca y, con la detección
      // normal, vería "sin cobertura" y concluiría que la app no funciona.
      // Para cualquier usuario real este campo viene nulo y no pasa nada.
      const anclada = ciudadFijaRef.current
        && lista.find((c) => c.slug === ciudadFijaRef.current);
      if (anclada) return fijar({ ...anclada, estado: PLAZA_ESTADO.DENTRO, anclada: true });

      // 2. Permiso de ubicación. El diálogo del sistema SOLO se dispara si
      //    quien llamó lo pidió (`solicitarPermiso`, tras la pantalla que le
      //    explica al usuario para qué es).
      let permiso;
      try {
        permiso = await Location.getForegroundPermissionsAsync();
        if (!permiso.granted && pedirPermiso && permiso.canAskAgain) {
          permiso = await Location.requestForegroundPermissionsAsync();
        }
      } catch {
        // Un fallo AQUÍ ya no se confunde con "no hay GPS": se trata como
        // permiso pendiente y el usuario puede reintentar.
        return fijar({ ...INICIAL, estado: PLAZA_ESTADO.SIN_PERMISO });
      }
      if (!permiso?.granted) {
        // Si Android ya no deja volver a preguntar, el botón de reintentar no
        // sirve de nada: hay que mandarlo a Ajustes. Sin esta distinción el
        // usuario quedaba encerrado tocando un botón que no hacía nada.
        return fijar({
          ...INICIAL,
          estado: permiso?.canAskAgain === false ? PLAZA_ESTADO.PERMISO_BLOQUEADO : PLAZA_ESTADO.SIN_PERMISO,
        });
      }

      // 3. ¿La ubicación del sistema está encendida? Con el permiso dado pero
      //    el GPS apagado, la lectura falla y antes se leía como "no hay
      //    cobertura aquí", que es una respuesta falsa y desconcertante.
      try {
        const encendida = await Location.hasServicesEnabledAsync();
        if (!encendida) return fijar({ ...INICIAL, estado: PLAZA_ESTADO.UBICACION_APAGADA });
      } catch { /* si no se puede saber, se intenta leer igual */ }

      // 4. La posición. Tres intentos de menos a más costoso, todos con
      //    tiempo límite para no dejar la app colgada bajo techo.
      const conLimite = (p) => Promise.race([
        p,
        new Promise((res) => setTimeout(() => res(null), TIMEOUT_GPS_MS)),
      ]);
      let pos = null;
      for (const intento of [
        () => Location.getLastKnownPositionAsync(),
        () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      ]) {
        try { pos = await conLimite(intento()); } catch { pos = null; }
        if (pos?.coords) break;
      }
      if (!pos?.coords) return fijar({ ...INICIAL, estado: PLAZA_ESTADO.SIN_GPS });

      // 5. La localidad que le corresponde a ese punto.
      const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let cercana = null, km = Infinity;
      for (const p of lista) {
        const d = distanciaKm(punto, p);
        if (d < km) { km = d; cercana = p; }
      }
      if (!cercana || km > radio) {
        return fijar({
          ...INICIAL,
          estado: PLAZA_ESTADO.FUERA,
          kmALaMasCercana: Math.round(km),
          masCercana: cercana?.nombre || null,
          // Se guardan las coordenadas leídas para poder mostrarlas: si
          // alguien reporta "no hay cobertura" estando dentro del pueblo, es
          // la única forma de saber qué leyó el teléfono en realidad.
          coords: { lat: Number(punto.lat.toFixed(5)), lng: Number(punto.lng.toFixed(5)) },
        });
      }
      fijar({ ...cercana, estado: PLAZA_ESTADO.DENTRO });
    } finally {
      corriendoRef.current = false;
    }
  }, []);

  // Al arrancar solo se MIRA el permiso: si ya está concedido, todo es
  // automático y el usuario no ve nada. Si no, se queda en SIN_PERMISO y la
  // pantalla del inicio le explica por qué conviene darlo.
  useEffect(() => { detectar(false); }, [detectar]);

  // La sesión se abre DESPUÉS de la primera detección, así que la localidad
  // anclada aparece más tarde: hay que volver a decidir cuando llega (y
  // cuando se va, al cerrar sesión).
  useEffect(() => { detectar(false); }, [usuario?.ciudad_fija, detectar]);

  // Si el usuario sale a Ajustes a conceder el permiso o a encender la
  // ubicación, al volver se reintenta solo — sin esto tendría que cerrar la
  // app y volverla a abrir. El guard de `corriendoRef` evita que este
  // reintento se monte encima de una detección en curso.
  const estadoRef = useRef(valor.estado);
  estadoRef.current = valor.estado;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // Sin pedir permiso: al volver de Ajustes basta con volver a mirar
      // qué permiso hay ahora. Lanzar el diálogo aquí sería pedirlo por la
      // espalda, que es justo lo que esta pantalla previa evita.
      if (s === 'active' && estadoRef.current !== PLAZA_ESTADO.DENTRO) detectar(false);
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
      // `reintentar` NO abre el diálogo del sistema (solo revisa de nuevo);
      // `solicitarPermiso` sí — es el que cuelga del botón de la pantalla
      // que le explica al usuario para qué queremos su ubicación.
      reintentar: () => detectar(false),
      solicitarPermiso: () => detectar(true),
      abrirAjustes,
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
    lista: false, hayCobertura: false,
    reintentar: () => {}, solicitarPermiso: () => {}, abrirAjustes,
  };
}

export default PlazaContext;
