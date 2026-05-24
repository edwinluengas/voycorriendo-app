import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, radio, espacio } from '../theme/colors';

/**
 * Campo de texto etiquetado
 * Si recibe secureTextEntry, muestra un botón 👁️ para mostrar/ocultar la contraseña.
 */
export default function Campo({ etiqueta, error, secureTextEntry, ...textInputProps }) {
  const [verPassword, setVerPassword] = useState(false);
  const esPassword = !!secureTextEntry;

  return (
    <View style={estilos.contenedor}>
      {etiqueta && <Text style={estilos.etiqueta}>{etiqueta}</Text>}
      <View style={[estilos.input, error && estilos.inputError, esPassword && estilos.inputConBoton]}>
        <TextInput
          style={estilos.textInput}
          placeholderTextColor={colors.textoSuave}
          secureTextEntry={esPassword && !verPassword}
          autoCapitalize={esPassword ? 'none' : textInputProps.autoCapitalize}
          autoCorrect={esPassword ? false : textInputProps.autoCorrect}
          {...textInputProps}
        />
        {esPassword && (
          <Pressable
            onPress={() => setVerPassword(!verPassword)}
            style={estilos.botonOjo}
            hitSlop={10}
          >
            <Text style={estilos.emojiOjo}>{verPassword ? '🙈' : '👁️'}</Text>
          </Pressable>
        )}
      </View>
      {error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: espacio.md },
  etiqueta:   { fontSize: 14, color: colors.texto, marginBottom: espacio.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.superficie,
    borderWidth: 1,
    borderColor: colors.borde,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputConBoton: { paddingRight: espacio.xs },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.texto,
    paddingVertical: espacio.md,
  },
  botonOjo: {
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.sm,
    justifyContent: 'center',
  },
  emojiOjo: { fontSize: 22 },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13, marginTop: espacio.xs },
});
