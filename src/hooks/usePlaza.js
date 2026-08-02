/**
 * La plaza (localidad) en la que se está usando la app.
 *
 * VoyCorriendo opera en pueblos distintos y separados —Puerto Escondido,
 * Putla, Zacatepec— y quien vive en Putla no quiere pedirle a una app "de
 * Puerto Escondido". Es el mismo servicio, pero el nombre local es lo que lo
 * hace propio, así que la marca se arma con la plaza: "VoyCorriendo Putla".
 *
 * La lista viene del backend (/api/config-publica), no escrita a mano: abrir
 * una plaza nueva no debe exigir un APK nuevo.
 */
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { pedidosAPI } from '../api/client';

const CLAVE_GUARDADA = 'plaza_elegida';

// Distancia aproximada, solo para ordenar cuál queda más cerca.
const cerca = (a, b) => Math.hypot(a.lat - Number(b.latitud), a.lng - Number(b.longitud));

// Mientras responde el servidor se usa la marca a secas: es preferible a
// mostrar el nombre de una localidad que quizá no es la del usuario.
const MARCA_NEUTRA = { marca: 'VoyCorriendo', nombre: null, estado: 'Oaxaca' };

export default function usePlaza(ciudadUsuario) {
  const [plaza, setPlaza] = useState(MARCA_NEUTRA);
  const [plazas, setPlazas] = useState([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      let lista = [];
      let porDefecto = null;
      try {
        const { data } = await pedidosAPI.configPublica();
        lista = data?.data?.ciudades || [];
        porDefecto = data?.data?.ciudad_default;
      } catch { return; }
      if (!vivo || !lista.length) return;
      setPlazas(lista);

      // 1. Lo que el usuario eligió a mano gana siempre: si viajó o la
      //    detección se equivocó, no queremos volver a moverlo cada vez.
      const guardada = await SecureStore.getItemAsync(CLAVE_GUARDADA).catch(() => null);
      const manual = guardada && lista.find((c) => c.slug === guardada);
      if (manual) { if (vivo) setPlaza(manual); return; }

      // 2. La plaza de su cuenta, si la tiene.
      const suya = lista.find((c) => c.slug === ciudadUsuario);
      if (suya) { if (vivo) setPlaza(suya); return; }

      // 3. La más cercana por GPS. Es lo que evita que alguien de Putla
      //    abra la app y vea restaurantes de Puerto Escondido.
      try {
        const permiso = await Location.getForegroundPermissionsAsync();
        if (permiso.granted) {
          const pos = await Location.getLastKnownPositionAsync()
            || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          if (pos && vivo) {
            const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const cercana = [...lista].sort((a, b) => cerca(punto, a) - cerca(punto, b))[0];
            if (cercana) { setPlaza(cercana); return; }
          }
        }
      } catch { /* sin GPS se cae al default */ }

      // 4. Último recurso: la plaza por defecto del backend.
      if (vivo) setPlaza(lista.find((c) => c.slug === porDefecto) || lista[0]);
    })();
    return () => { vivo = false; };
  }, [ciudadUsuario]);

  // Cambio manual: se recuerda para las próximas aperturas.
  const cambiarPlaza = useCallback(async (slug) => {
    const nueva = plazas.find((c) => c.slug === slug);
    if (!nueva) return;
    setPlaza(nueva);
    SecureStore.setItemAsync(CLAVE_GUARDADA, slug).catch(() => {});
  }, [plazas]);

  return { ...plaza, plazas, cambiarPlaza };
}
