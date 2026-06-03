import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

export default function LoginScreen({ navigation }) {
  const { iniciarSesion } = useAuth();
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const submit = async () => {
    if (!telefono || !password) {
      Alert.alert('Faltan datos', 'Escribe tu número y tu contraseña.');
      return;
    }
    try {
      setCargando(true);
      await iniciarSesion(telefono, password);
    } catch (e) {
      Alert.alert('No pudimos entrar', e.mensajeAmigable || 'Verifica tus datos.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={estilos.raiz} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={estilos.kav}
      >
        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Encabezado */}
          <View style={estilos.encabezado}>
            <View style={estilos.logoMini}>
              <Text style={estilos.logoMiniTxt}>VC</Text>
            </View>
            <Text style={estilos.titulo}>{'Bienvenido\nde regreso'}</Text>
            <Text style={estilos.subtitulo}>Inicia sesión para seguir pidiendo</Text>
          </View>

          {/* Formulario */}
          <View style={estilos.tarjeta}>
            <Campo
              etiqueta="Celular"
              placeholder="10 dígitos"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
              maxLength={10}
            />
            <Campo
              etiqueta="Contraseña"
              placeholder="Tu contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={{ height: espacio.xs }} />
            <Boton titulo="Entrar" onPress={submit} cargando={cargando} />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#FFFFFF' },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: espacio.lg,
    paddingBottom: espacio.xl,
  },
  encabezado: {
    paddingTop: espacio.xl,
    marginBottom: espacio.xl,
  },
  logoMini: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.lg,
    shadowColor: colors.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoMiniTxt: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  titulo: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.texto,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 15,
    color: colors.textoSuave,
    marginTop: espacio.sm,
    fontWeight: '500',
  },
  tarjeta: {
    backgroundColor: '#F8F9FA',
    borderRadius: radio.xl,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  linkRegistro: {
    marginTop: espacio.xl,
    alignItems: 'center',
    paddingVertical: espacio.sm,
  },
  linkTxt: { fontSize: 14, color: colors.textoSuave, fontWeight: '500' },
  linkAcento: { color: colors.primario, fontWeight: '800' },
});
