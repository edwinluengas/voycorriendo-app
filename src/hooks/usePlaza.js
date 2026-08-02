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
import { useState, useEffect } from 'react';
import { pedidosAPI } from '../api/client';

// Mientras responde el servidor se usa la marca a secas: es preferible a
// mostrar el nombre de una localidad que quizá no es la del usuario.
const MARCA_NEUTRA = { marca: 'VoyCorriendo', nombre: null, estado: 'Oaxaca' };

export default function usePlaza(ciudadUsuario) {
  const [plaza, setPlaza] = useState(MARCA_NEUTRA);

  useEffect(() => {
    let vivo = true;
    pedidosAPI.configPublica()
      .then(({ data }) => {
        const d = data?.data;
        const lista = d?.ciudades || [];
        if (!vivo || !lista.length) return;
        // La del usuario si la tiene; si no, la plaza por defecto del backend.
        const elegida = lista.find((c) => c.slug === ciudadUsuario)
          || lista.find((c) => c.slug === d?.ciudad_default)
          || lista[0];
        setPlaza(elegida);
      })
      .catch(() => {});   // sin red se queda con la marca neutra
    return () => { vivo = false; };
  }, [ciudadUsuario]);

  return plaza;
}
