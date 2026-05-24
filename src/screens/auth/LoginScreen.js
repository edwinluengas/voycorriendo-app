import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio } from '../../theme/colors';

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
    <SafeAreaView style={estilos.contenedor}>
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
          <Text style={estilos.titulo}>¡Qué bueno verte!</Text>
          <Text style={estilos.subtitulo}>Inicia sesión para pedir lo que necesites.</Text>

          <Campo
            etiqueta="Número de celular"
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

          <Boton titulo="Entrar" onPress={submit} cargando={cargando} />
          <View style={{ height: espacio.md }} />
          <Boton
            titulo="¿No tienes cuenta? Regístrate"
            variante="fantasma"
            onPress={() => navigation.navigate('Registro')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg, paddingTop: espacio.xl },
  titulo: { fontSize: 28, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  subtitulo: { fontSize: 15, color: colors.textoSuave, marginBottom: espacio.lg },
});
