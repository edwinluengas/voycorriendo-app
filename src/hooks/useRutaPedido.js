/**
 * Ruta por calles del pedido para el mapa en vivo.
 *
 * La calcula el backend (Routes API de Google). Cada llamada a Google se
 * COBRA, así que no se pide en cada latido de GPS (cada 15s serían ~240
 * llamadas por hora y por espectador): solo se recalcula cuando el
 * repartidor se movió de verdad (>150 m) y pasó al menos un minuto desde la
 * última. Un pedido normal termina costando un puñado de llamadas.
 *
 * Devuelve null mientras no haya ruta — el mapa dibuja la línea recta.
 */
import { useEffect, useRef, useState } from 'react';
import { pedidosAPI } from '../api/client';

const MIN_METROS = 150;
const MIN_MS     = 60 * 1000;

// Distancia aproximada en metros entre dos coordenadas (suficiente para
// decidir si vale la pena volver a preguntar).
const metros = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/**
 * ¿Toca recalcular la ruta? Función PURA y exportada a propósito: es la
 * regla que decide si se gasta una llamada facturable a Google, así que
 * tiene que poder probarse sin montar React ni tocar la red.
 *
 * Regla: la primera vez siempre; después solo si se movió al menos
 * MIN_METROS **y** pasó al menos MIN_MS. Las dos condiciones, no una.
 *
 * @param {{pos: {lat,lng}|null, ts: number}} ultimo  último INTENTO hecho
 */
export const debeRecalcular = (ultimo, pos, ahora) => {
  if (!pos) return false;
  // El centinela de "no hay intento previo" es la POSICIÓN, no el ts: un
  // timestamp de 0 es un valor válido y usarlo como falsy hacía que la
  // segunda lectura se tomara otra vez por la primera (y se llamara doble).
  if (!ultimo?.pos) return true;

  const seMovio    = metros(ultimo.pos, pos) >= MIN_METROS;
  const pasoTiempo = ahora - ultimo.ts >= MIN_MS;
  return seMovio && pasoTiempo;
};

export default function useRutaPedido(pedidoId, repartidorPos, activo = true) {
  const [polyline, setPolyline] = useState(null);
  // Guarda el último INTENTO, no la última ruta exitosa. Esa distinción es
  // el bug que tenía antes: el guard exigía `polyline !== null` para
  // aplicar, y como con Google apagado la respuesta es SIEMPRE null, el
  // freno no entraba nunca y se llamaba en cada lectura de GPS (cada 15 s,
  // por cada una de las 3 pantallas que montan el mapa).
  const ultima = useRef({ pos: null, ts: 0 });

  useEffect(() => {
    if (!activo || !pedidoId || !repartidorPos) return;

    const ahora = Date.now();
    if (!debeRecalcular(ultima.current, repartidorPos, ahora)) return;

    let vivo = true;
    // Se marca el intento ANTES de la petición: si se marcara al responder,
    // varias lecturas seguidas dispararían llamadas en paralelo antes de
    // que la primera termine.
    ultima.current = { pos: repartidorPos, ts: ahora };
    pedidosAPI.ruta(pedidoId, repartidorPos.lat, repartidorPos.lng)
      .then(({ data }) => {
        if (vivo) setPolyline(data?.data?.ruta?.polyline || null);
      })
      .catch(() => {});   // sin ruta el mapa sigue funcionando en recta
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, repartidorPos?.lat, repartidorPos?.lng, activo]);

  return polyline;
}
