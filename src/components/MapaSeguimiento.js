/**
 * Mapa de seguimiento en tiempo real — reusado por SeguimientoScreen
 * (cliente, viendo al repartidor llegar a su dirección) y
 * PedidoDetalleNegocioScreen (negocio, viendo al repartidor llegar a
 * recoger). La posición del repartidor llega por props ya resuelta
 * (socket 'ubicacion_repartidor' + fallback a la última conocida en DB) —
 * este componente solo dibuja.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { colors, espacio, radio } from '../theme/colors';

export default function MapaSeguimiento({ repartidorPos, destino, tituloDestino = 'Destino' }) {
  const mapRef = useRef(null);

  const region = repartidorPos
    ? {
        latitude: (repartidorPos.lat + destino.lat) / 2,
        longitude: (repartidorPos.lng + destino.lng) / 2,
        latitudeDelta: Math.max(Math.abs(repartidorPos.lat - destino.lat) * 2.2, 0.01),
        longitudeDelta: Math.max(Math.abs(repartidorPos.lng - destino.lng) * 2.2, 0.01),
      }
    : { latitude: destino.lat, longitude: destino.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  useEffect(() => {
    if (repartidorPos && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [{ latitude: repartidorPos.lat, longitude: repartidorPos.lng }, { latitude: destino.lat, longitude: destino.lng }],
        { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repartidorPos?.lat, repartidorPos?.lng]);

  return (
    <View style={s.contenedor}>
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={s.mapa} initialRegion={region}>
        <Marker coordinate={{ latitude: destino.lat, longitude: destino.lng }} title={tituloDestino} pinColor={colors.primario} />
        {repartidorPos && (
          <Marker coordinate={{ latitude: repartidorPos.lat, longitude: repartidorPos.lng }} title="Repartidor" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.motoPin}>
              <Text style={{ fontSize: 20 }}>🛵</Text>
            </View>
          </Marker>
        )}
      </MapView>
      {!repartidorPos && (
        <View style={s.esperando}>
          <Text style={s.esperandoTxt}>Esperando la ubicación del repartidor…</Text>
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
  mapa: { width: '100%', height: 220 },
  motoPin: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF', borderWidth: 2, borderColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
  },
  esperando: {
    position: 'absolute', bottom: espacio.sm, left: espacio.sm, right: espacio.sm,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radio.sm,
    paddingVertical: espacio.xs, paddingHorizontal: espacio.sm, alignItems: 'center',
  },
  esperandoTxt: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
