/**
 * Mapa estático de una sola ubicación — usado para mostrar dónde está
 * un negocio antes de ordenar (sin seguimiento en vivo, a diferencia de
 * MapaSeguimiento). No interactivo: solo confirma la zona al cliente.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { colors, espacio, radio } from '../theme/colors';

export default function MapaUbicacion({ lat, lng, titulo }) {
  if (!lat || !lng) return null;

  const region = { latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 };

  return (
    <View style={s.contenedor}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={s.mapa}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={titulo} pinColor={colors.primario} />
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: {
    borderRadius: radio.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.borde,
    marginTop: espacio.sm,
  },
  mapa: { width: '100%', height: 140 },
});
