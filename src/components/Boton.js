import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radio, espacio } from '../theme/colors';

/**
 * Botón estándar de VoyCorriendo
 * props: titulo, onPress, variante (primario|secundario|fantasma), cargando, deshabilitado
 */
export default function Boton({
  titulo, onPress, variante = 'primario', cargando = false, deshabilitado = false, estilo,
}) {
  const est = [estilos.base, estilos[variante], deshabilitado && estilos.deshabilitado, estilo];
  const colorTexto = variante === 'primario' ? '#FFF' : colors.primario;
  return (
    <Pressable style={est} onPress={onPress} disabled={deshabilitado || cargando}>
      {cargando
        ? <ActivityIndicator color={colorTexto} />
        : <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    paddingVertical: espacio.md,
    paddingHorizontal: espacio.lg,
    borderRadius: radio.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primario:   { backgroundColor: colors.primario },
  secundario: { backgroundColor: colors.superficie, borderWidth: 1.5, borderColor: colors.primario },
  fantasma:   { backgroundColor: 'transparent' },
  deshabilitado: { opacity: 0.5 },
  texto: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
