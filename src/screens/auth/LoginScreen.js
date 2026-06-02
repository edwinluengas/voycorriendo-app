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
    <View style={estilos.contenedor}>
      <View style={estilos.decorCirculo} />
      <View style={estilos.decorCirculo2} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={estilos.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={estilos.encabezado}>
              <View style={estilos.logoMini}>
                <Text style={estilos.logoMiniTxt}>VC</Text>
              </View>
              <Text style={estilos.titulo}>{'Bienvenido\nde regreso'}</Text>
              <Text style={estilos.subtitulo}>Inicia sesión para seguir pidiendo</Text>
            </View>

            <View style={estilos.tarjeta}>
              <Campo
                etiqueta="Celular"
                placeholder="10 dígitos"
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
                maxLength={10}
                oscuro
              />
              <Campo
                etiqueta="Contraseña"
                placeholder="Tu contraseña"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                oscuro
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
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.oscuro },
  decorCirculo: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primario,
    opacity: 0.07,
  },
  decorCirculo2: {
    position: 'absolute',
    bottom: 60,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primario,
    opacity: 0.04,
  },
  scroll: { flexGrow: 1, paddingHorizontal: espacio.lg, paddingBottom: espacio.xl },
  encabezado: { paddingTop: espacio.xl, marginBottom: espacio.xl },
  logoMini: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.lg,
    shadowColor: colors.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  logoMiniTxt: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  titulo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  subtitulo: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    marginTop: espacio.sm,
    fontWeight: '500',
  },
  tarjeta: {
    backgroundColor: colors.oscuroCard,
    borderRadius: radio.xl,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  linkRegistro: {
    marginTop: espacio.xl,
    alignItems: 'center',
    paddingVertical: espacio.sm,
  },
  linkTxt: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  linkAcento: { color: colors.primario, fontWeight: '800' },
});
