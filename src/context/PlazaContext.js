/**
 * La plaza (localidad) en la que se está usando la app.
 *
 * VoyCorriendo opera en pueblos distintos y separados —Puerto Escondido,
 * Putla, Zacatepec, Pinotepa— y quien vive en Putla no quiere pedirle a una
 * app "de Puerto Escondido". Es el mismo servicio, pero el nombre local es lo
 * que lo hace propio, así que la marca se arma con la plaza.
 *
 * Vive en un CONTEXTO, no en un hook suelto, por dos razones:
 *   1. Cada pantalla que llamaba al hook abría su propia detección (API + GPS)
 *      y tenía su propio estado, así que cambiar de plaza en una no se veía en
 *      las demás — el catálogo seguía siendo el de antes.
 *   2. La detección cuesta un permiso de ubicación y una llamada al servidor:
 *      hacerla una vez y compartirla es lo correcto.
 *
 * La lista viene del backend (/api/config-publica), no escrita a mano: abrir
 * una plaza nueva no debe exigir un APK nuevo.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { pedidosAPI } from '../api/client';

const CLAVE_GUARDADA = 'plaza_elegida';

// Distancia real en km (haversine). Se usa para dos cosas: ordenar cuál plaza
// queda más cerca y —sobre todo— decidir si el usuario está DENTRO de alguna.
// Con grados no se puede: 0.5° son 55 km en latitud y menos en longitud, así
// que un umbral en grados daría un área distinta según dónde estés.
const distanciaKm = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (Number(b.latitud) - a.lat) * rad;
  const dLng = (Number(b.longitud) - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(Number(b.latitud) * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// Hasta dónde llega una plaza si el servidor no lo dice (APK viejo contra
// backend nuevo, o respuesta incompleta). No es la cobertura de reparto
// (6.5 km desde cada negocio) sino el área que pertenece al pueblo.
const RADIO_PLAZA_KM_FALLBACK = 25;

// Mientras responde el servidor se usa la marca a secas: es preferible a
// mostrar el nombre de una localidad que quizá no es la del usuario.
const MARCA_NEUTRA = { slug: null, marca: 'VoyCorriendo', nombre: null, estado: 'Oaxaca' };

/**
 * A qué plaza pertenece un punto, con la lista que hoy da el servidor.
 * Devuelve `{ plaza, km, dentro }`. Lo usan los onboardings para decirle al
 * dueño del negocio en qué plaza va a quedar ANTES de mandar nada, en vez de
 * que se entere por un error del servidor al final del wizard.
 */
export const plazaDePunto = (plazas, lat, lng, radioKm = RADIO_PLAZA_KM_FALLBACK) => {
  // OJO: `Number(null)` y `Number('')` son 0, así que isFinite por sí solo
  // daba por buenas unas coordenadas ausentes y las ubicaba en el mar.
  const falta = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v));
  if (!plazas?.length || falta(lat) || falta(lng)) {
    return { plaza: null, km: null, dentro: false };
  }
  const punto = { lat: Number(lat), lng: Number(lng) };
  let mejor = null, menor = Infinity;
  for (const p of plazas) {
    const d = distanciaKm(punto, p);
    if (d < menor) { menor = d; mejor = p; }
  }
  return { plaza: mejor, km: menor, dentro: menor <= radioKm };
};

const PlazaContext = createContext(null);

export function PlazaProvider({ children }) {
  const [plaza, setPlaza]       = useState(MARCA_NEUTRA);
  const [plazas, setPlazas]     = useState([]);
  // `false` hasta que se sabe cuál es la plaza. El catálogo NO debe pedirse
  // antes: sin slug el servidor devuelve el de la plaza por defecto, que es
  // justo el bug que hacía ver restaurantes de Puerto Escondido en Zacatepec.
  const [lista, setLista]       = useState(false);
  // Radio de plaza que dice el servidor. Los onboardings lo usan para avisar
  // antes de tiempo si un negocio queda fuera de toda plaza.
  const [radioKm, setRadioKm]   = useState(RADIO_PLAZA_KM_FALLBACK);

  const detectar = useCallback(async () => {
    let listaPlazas = [];
    let porDefecto = null;
    let radioKm = RADIO_PLAZA_KM_FALLBACK;
    try {
      const { data } = await pedidosAPI.configPublica();
      listaPlazas = data?.data?.ciudades || [];
      porDefecto  = data?.data?.ciudad_default;
      radioKm     = Number(data?.data?.radio_plaza_km) || RADIO_PLAZA_KM_FALLBACK;
      setRadioKm(radioKm);
    } catch {
      // Sin servidor no se inventa una plaza: se deja en marca neutra y se
      // reintenta al volver a abrir. `lista` sigue en false, así que el
      // catálogo no se pide con la plaza equivocada.
      return;
    }
    if (!listaPlazas.length) return;
    setPlazas(listaPlazas);

    const fijar = (p) => { setPlaza(p); setLista(true); };

    // 1. Lo que el usuario eligió a mano gana siempre: si viajó o la detección
    //    se equivocó, no queremos volver a moverlo cada vez que abre la app.
    const guardada = await SecureStore.getItemAsync(CLAVE_GUARDADA).catch(() => null);
    const manual = guardada && listaPlazas.find((c) => c.slug === guardada);
    if (manual) return fijar(manual);

    // 2. La más cercana por GPS. Es lo que evita que alguien de Putla abra la
    //    app y vea restaurantes de Puerto Escondido.
    try {
      let permiso = await Location.getForegroundPermissionsAsync();
      // Si nunca se preguntó, se pregunta AQUÍ. Antes solo se consultaba el
      // permiso ya concedido: como el permiso se pedía hasta el checkout,
      // en la primera sesión la detección nunca corría y todo el mundo caía
      // en la plaza por defecto.
      if (!permiso.granted && permiso.canAskAgain) {
        permiso = await Location.requestForegroundPermissionsAsync();
      }
      if (permiso.granted) {
        const pos = await Location.getLastKnownPositionAsync()
          || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        if (pos) {
          const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const ordenadas = [...listaPlazas].sort((a, b) => distanciaKm(punto, a) - distanciaKm(punto, b));
          const cercana = ordenadas[0];
          const km = cercana ? distanciaKm(punto, cercana) : Infinity;

          // FUERA DE COBERTURA. Antes se asignaba la plaza más cercana sin
          // importar la distancia: alguien en Ciudad de México veía los
          // restaurantes de Putla, a 500 km, y podía intentar pedir. Ahora se
          // dice que no hay servicio, que es la verdad —pero se deja cambiar
          // de plaza a mano por si anda de viaje y quiere pedir en su pueblo.
          if (km > radioKm) {
            return fijar({
              ...MARCA_NEUTRA,
              fueraDeCobertura: true,
              kmALaMasCercana: Math.round(km),
              masCercana: cercana,
            });
          }
          if (cercana) return fijar(cercana);
        }
      }
    } catch { /* sin GPS se cae al default */ }

    // 3. Último recurso: la plaza por defecto del backend.
    fijar(listaPlazas.find((c) => c.slug === porDefecto) || listaPlazas[0]);
  }, []);

  useEffect(() => { detectar(); }, [detectar]);

  // Cambio manual: se recuerda para las próximas aperturas. Es la salida
  // cuando el GPS no está disponible o el usuario quiere ver otra plaza.
  const cambiarPlaza = useCallback(async (slug) => {
    const nueva = plazas.find((c) => c.slug === slug);
    if (!nueva) return;
    setPlaza(nueva);
    setLista(true);
    SecureStore.setItemAsync(CLAVE_GUARDADA, slug).catch(() => {});
  }, [plazas]);

  // Volver a la detección automática (borra la elección guardada).
  const detectarDeNuevo = useCallback(async () => {
    await SecureStore.deleteItemAsync(CLAVE_GUARDADA).catch(() => {});
    setLista(false);
    detectar();
  }, [detectar]);

  const valor = useMemo(
    () => ({ ...plaza, plazas, lista, radioKm, cambiarPlaza, detectarDeNuevo }),
    [plaza, plazas, lista, radioKm, cambiarPlaza, detectarDeNuevo],
  );

  return <PlazaContext.Provider value={valor}>{children}</PlazaContext.Provider>;
}

export function usePlaza() {
  const ctx = useContext(PlazaContext);
  // Sin provider se devuelve la marca neutra en vez de reventar: una pantalla
  // suelta (deep link, preview) debe seguir dibujándose.
  return ctx || {
    ...MARCA_NEUTRA, plazas: [], lista: false, radioKm: RADIO_PLAZA_KM_FALLBACK,
    cambiarPlaza: () => {}, detectarDeNuevo: () => {},
  };
}

export default PlazaContext;
