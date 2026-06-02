import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radio, espacio } from '../theme/colors';

export default function Boton({
  titulo, onPress, variante = 'primario', cargando = false, deshabilitado = false, estilo,
}) {
  const est = [estilos.base, estilos[variante], deshabilitado && estilos.deshabilitado, estilo];
  const colorTexto = variante === 'primario' ? '#FFF' : colors.primario;
  return (
    <Pressable
      style={({ pressed }) => [est, pressed && !deshabilitado && estilos.presionado]}
      onPress={onPress}
      disabled={deshabilitado || cargando}
    >
      {cargando
        ? <ActivityIndicator color={colorTexto} />
        : <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    paddingVertical: 15,
    paddingHorizontal: espacio.lg,
    borderRadius: radio.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primario: {
    backgroundColor: colors.primario,
    shadowColor: colors.primario,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  secundario: {
    backgroundColor: colors.superficie,
    borderWidth: 1.5,
    borderColor: colors.primario,
  },
  fantasma: { backgroundColor: 'transparent' },
  deshabilitado: { opacity: 0.45 },
  presionado: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  texto: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
