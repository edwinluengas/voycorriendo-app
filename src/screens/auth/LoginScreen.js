import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

export default function LoginScreen({ navigation }) {
  const { iniciarSesion } = useAuth();
  const [telefono, setTelefono]     = useState('');
  const [password, setPassword]     = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando]     = useState(false);

  const submit = async () => {
    if (!telefono || !password) {
      Alert.alert('Faltan datos', 'Escribe tu número y tu contraseña.');
      return;
    }
    try {
      setCargando(true);
      await iniciarSesion(telefono, password);
    } catch (e) {
      if (e?.response?.data?.codigo === 'USUARIO_NO_ENCONTRADO') {
        Alert.alert(
          'No encontramos tu cuenta',
          'Ese número no está registrado. ¿Quieres crear una cuenta nueva?',
          [
            { text: 'Revisar número', style: 'cancel' },
            { text: 'Crear cuenta', onPress: () => navigation.navigate('Registro') },
          ]
        );
        return;
      }
      Alert.alert('No pudimos entrar', e.mensajeAmigable || 'Verifica tus datos.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={estilos.raiz}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={estilos.logoMini}>
          <Text style={estilos.logoMiniTxt}>VC</Text>
        </View>
        <Text style={estilos.titulo}>{'Bienvenido\nde regreso'}</Text>
        <Text style={estilos.subtitulo}>Inicia sesión para seguir pidiendo</Text>

        {/* Formulario */}
        <View style={estilos.tarjeta}>
          <Text style={estilos.label}>CELULAR</Text>
          <TextInput
            style={estilos.input}
            placeholder="10 dígitos"
            placeholderTextColor="#A0A0A8"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={estilos.label}>CONTRASEÑA</Text>
          <View style={estilos.inputRow}>
            <TextInput
              style={[estilos.input, estilos.inputPassword]}
              placeholder="Tu contraseña"
              placeholderTextColor="#A0A0A8"
              secureTextEntry={!verPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={estilos.ojoBtn}
              onPress={() => setVerPassword(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={estilos.ojoTxt}>{verPassword ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[estilos.boton, cargando && estilos.botonDesactivado]}
            onPress={submit}
            disabled={cargando}
            activeOpacity={0.85}
          >
            <Text style={estilos.botonTxt}>{cargando ? 'Entrando...' : 'Entrar'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={estilos.linkRegistro}
          onPress={() => navigation.navigate('Registro')}
          activeOpacity={0.7}
        >
          <Text style={estilos.linkTxt}>
            {'¿No tienes cuenta?  '}
            <Text style={estilos.linkAcento}>Regístrate gratis</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: 60,
    paddingBottom: espacio.xl,
  },
  logoMini: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: espacio.lg,
    elevation: 6,
    shadowColor: colors.primario,
    shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  logoMiniTxt: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  titulo: {
    fontSize: 34, fontWeight: '900',
    color: '#111827', lineHeight: 40,
    letterSpacing: -0.5, marginBottom: espacio.sm,
  },
  subtitulo: { fontSize: 15, color: '#6B7280', marginBottom: espacio.xl },
  tarjeta: {
    backgroundColor: '#F8F9FA',
    borderRadius: radio.xl,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 11, fontWeight: '800',
    color: '#6B7280', marginBottom: 7,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: radio.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: espacio.md,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: espacio.md,
  },
  inputRow: {
    position: 'relative',
    marginBottom: espacio.md,
  },
  inputPassword: {
    marginBottom: 0,
    paddingRight: 80,
  },
  ojoBtn: {
    position: 'absolute',
    right: espacio.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  ojoTxt: { color: colors.primario, fontWeight: '700', fontSize: 14 },
  boton: {
    backgroundColor: colors.primario,
    borderRadius: radio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: espacio.xs,
    elevation: 4,
    shadowColor: colors.primario,
    shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  botonDesactivado: { opacity: 0.7 },
  botonTxt: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  linkRegistro: {
    marginTop: espacio.xl,
    alignItems: 'center',
    paddingVertical: espacio.sm,
  },
  linkTxt: { fontSize: 14, color: '#6B7280' },
  linkAcento: { color: colors.primario, fontWeight: '800' },
});
