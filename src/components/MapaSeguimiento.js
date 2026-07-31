/**
 * Mapa de seguimiento en tiempo real — el viaje completo en un solo mapa:
 * dónde va el repartidor, dónde está el restaurante y dónde vive el cliente.
 *
 * Lo usan las tres partes, cada una viendo lo mismo:
 *   - Cliente (SeguimientoScreen)          — sigue su pedido desde la cocina.
 *   - Negocio (PedidoDetalleNegocioScreen) — ve al repartidor llegar y a dónde va después.
 *   - Repartidor (PedidoActivoScreen)      — su recorrido: recoger y entregar.
 *
 * La posición del repartidor llega por props ya resuelta (socket
 * 'ubicacion_repartidor' + fallback a la última conocida en DB).
 *
 * La ruta por calles la calcula el backend (GET /pedidos/:id/ruta, Routes
 * API de Google) y llega en `rutaPolyline` ya codificada. Si no viene —hoy
 * el proyecto de Google no tiene facturación activa, así que la API responde
 * denegado— se dibuja la línea recta como referencia de rumbo y distancia.
 * Sin mapa nadie se queda: se degrada, no se apaga.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { colors, espacio, radio } from '../theme/colors';

const num = (v) => (v === null || v === undefined ? null : parseFloat(v));
const coord = (p) => {
  if (!p) return null;
  const lat = num(p.lat), lng = num(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
};

/**
 * Decodifica el polyline codificado de Google (algoritmo estándar de
 * polilíneas codificadas) a coordenadas dibujables.
 */
const decodificarPolyline = (encoded) => {
  if (typeof encoded !== 'string' || !encoded) return [];
  const puntos = [];
  let indice = 0, lat = 0, lng = 0;

  while (indice < encoded.length) {
    let resultado = 0, turno = 0, byte;
    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << turno;
      turno += 5;
    } while (byte >= 0x20);
    lat += (resultado & 1) ? ~(resultado >> 1) : (resultado >> 1);

    resultado = 0; turno = 0;
    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << turno;
      turno += 5;
    } while (byte >= 0x20);
    lng += (resultado & 1) ? ~(resultado >> 1) : (resultado >> 1);

    puntos.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return puntos;
};

export default function MapaSeguimiento({
  repartidorPos,
  origen,                       // restaurante (opcional)
  destino,                      // dirección del cliente
  rutaPolyline,                 // ruta real por calles (opcional)
  tituloOrigen  = 'Restaurante',
  tituloDestino = 'Destino',
  altura = 220,
}) {
  const mapRef = useRef(null);

  const pRep     = coord(repartidorPos);
  const pOrigen  = coord(origen);
  const pDestino = coord(destino);

  // Un mapa sin ningún punto no tiene nada que enseñar.
  const puntos = [pRep, pOrigen, pDestino].filter(Boolean);
  if (!puntos.length) return null;

  // Encuadre inicial: el centro de todo lo que haya que mostrar.
  const lats = puntos.map((p) => p.latitude);
  const lngs = puntos.map((p) => p.longitude);
  const region = {
    latitude:  (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta:  Math.max((Math.max(...lats) - Math.min(...lats)) * 2.2, 0.01),
    longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 2.2, 0.01),
  };

  // Reencuadra cuando el repartidor se mueve, para que nunca se salga de vista.
  useEffect(() => {
    if (puntos.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(puntos, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pRep?.latitude, pRep?.longitude, pOrigen?.latitude, pDestino?.latitude]);

  // El recorrido: si el backend mandó la ruta por calles se dibuja esa; si
  // no, la línea recta entre los puntos (rumbo y distancia aproximados).
  const porCalles = decodificarPolyline(rutaPolyline);
  const ruta = porCalles.length > 1 ? porCalles : [pRep, pOrigen, pDestino].filter(Boolean);
  const esAproximada = porCalles.length <= 1;

  return (
    <View style={s.contenedor}>
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={[s.mapa, { height: altura }]} initialRegion={region}>
        {ruta.length > 1 && (
          <Polyline
            coordinates={ruta}
            strokeColor={colors.primario}
            strokeWidth={esAproximada ? 3 : 5}
            // Punteada mientras sea línea recta: comunica "aproximado".
            // La ruta real por calles se dibuja sólida.
            lineDashPattern={esAproximada ? [8, 6] : undefined}
          />
        )}

        {pOrigen && (
          <Marker coordinate={pOrigen} title={tituloOrigen} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, s.pinNegocio]}><Text style={s.pinTxt}>🏪</Text></View>
          </Marker>
        )}

        {pDestino && (
          <Marker coordinate={pDestino} title={tituloDestino} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, s.pinDestino]}><Text style={s.pinTxt}>📍</Text></View>
          </Marker>
        )}

        {pRep && (
          <Marker coordinate={pRep} title="Repartidor" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, s.pinMoto]}><Text style={s.pinTxt}>🛵</Text></View>
          </Marker>
        )}
      </MapView>

      {!pRep && (
        <View style={s.aviso}>
          <Text style={s.avisoTxt}>Esperando la ubicación del repartidor…</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: {
    marginHorizontal: espacio.md, marginTop: espacio.md,
    borderRadius: radio.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.borde,
  },
  mapa: { width: '100%' },
  pin: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pinTxt: { fontSize: 18 },
  pinMoto:    { borderColor: colors.primario },
  pinNegocio: { borderColor: colors.secundario },
  pinDestino: { borderColor: '#111827' },
  aviso: {
    position: 'absolute', bottom: espacio.sm, left: espacio.sm, right: espacio.sm,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radio.sm,
    paddingVertical: espacio.xs, paddingHorizontal: espacio.sm, alignItems: 'center',
  },
  avisoTxt: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
