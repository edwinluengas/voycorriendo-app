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

export default function useRutaPedido(pedidoId, repartidorPos, activo = true) {
  const [polyline, setPolyline] = useState(null);
  const ultima = useRef({ pos: null, ts: 0 });

  useEffect(() => {
    if (!activo || !pedidoId || !repartidorPos) return;

    const ahora = Date.now();
    const { pos, ts } = ultima.current;
    const yaHayRuta = polyline !== null;
    // La primera vez siempre se pide; después, solo si se movió y pasó tiempo.
    if (yaHayRuta && metros(pos, repartidorPos) < MIN_METROS && ahora - ts < MIN_MS) return;

    let vivo = true;
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
