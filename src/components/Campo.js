import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, radio, espacio } from '../theme/colors';

export default function Campo({ etiqueta, error, secureTextEntry, oscuro = false, style, ...textInputProps }) {
  const [verPassword, setVerPassword] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const esPassword = !!secureTextEntry;

  return (
    <View style={[estilos.contenedor, style]}>
      {etiqueta && (
        <Text style={[estilos.etiqueta, oscuro && estilos.etiquetaOscuro, enfocado && estilos.etiquetaFoco]}>
          {etiqueta}
        </Text>
      )}
      <View style={[
        estilos.input,
        oscuro ? estilos.inputOscuro : estilos.inputClaro,
        enfocado && estilos.inputFoco,
        error && estilos.inputError,
      ]}>
        <TextInput
          style={[estilos.textInput, oscuro && estilos.textInputOscuro]}
          placeholderTextColor={oscuro ? 'rgba(255,255,255,0.3)' : '#A0A0A8'}
          secureTextEntry={esPassword && !verPassword}
          autoCapitalize={esPassword ? 'none' : textInputProps.autoCapitalize}
          autoCorrect={esPassword ? false : textInputProps.autoCorrect}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          {...textInputProps}
        />
        {esPassword && (
          <Pressable
            onPress={() => setVerPassword(!verPassword)}
            style={estilos.botonOjo}
            hitSlop={12}
          >
            <Text style={[estilos.ojoTxt, oscuro && estilos.ojoTxtOscuro]}>
              {verPassword ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}
      </View>
      {error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: espacio.md },
  etiqueta: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textoSuave,
    marginBottom: 7,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  etiquetaOscuro: { color: 'rgba(255,255,255,0.45)' },
  etiquetaFoco: { color: colors.primario },
  input: {
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputClaro: {
    backgroundColor: colors.superficie,
    borderWidth: 1.5,
    borderColor: colors.borde,
  },
  inputOscuro: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputFoco: {
    borderColor: colors.primario,
    borderWidth: 2,
    shadowColor: colors.primario,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.texto,
    paddingVertical: 16,
    fontWeight: '500',
  },
  textInputOscuro: { color: '#FFFFFF' },
  botonOjo: {
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.sm,
    justifyContent: 'center',
  },
  ojoTxt: { fontSize: 13, color: colors.primario, fontWeight: '700' },
  ojoTxtOscuro: { color: colors.primario },
  error: { color: colors.error, fontSize: 12, marginTop: 5, fontWeight: '600' },
});
