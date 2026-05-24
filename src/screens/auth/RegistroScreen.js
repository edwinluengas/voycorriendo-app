import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

export default function RegistroScreen() {
  const { registrarse } = useAuth();
  const [rol, setRol]           = useState('cliente');
  const [nombre, setNombre]     = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const submit = async () => {
    if (!nombre || !apellido || !telefono || !password) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, celular y contraseña.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña corta', 'Usa al menos 6 caracteres.');
      return;
    }
    try {
      setCargando(true);
      await registrarse({ nombre, apellido, telefono, email, password, rol });
      if (rol === 'repartidor') {
        Alert.alert(
          '¡Cuenta creada!',
          'Para empezar a repartir necesitamos tu INE, licencia y datos de tu moto. Ve a "Mi perfil" para subirlos. Un operador validará todo en 24 a 48 horas.'
        );
      }
    } catch (e) {
      Alert.alert('No pudimos registrarte', e.mensajeAmigable || 'Revisa tus datos.');
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
          <Text style={estilos.titulo}>Crea tu cuenta</Text>
          <Text style={estilos.subtitulo}>Elige cómo quieres usar VoyCorriendo.</Text>

          <View style={estilos.roles}>
            <Pressable
              style={[estilos.rol, rol === 'cliente' && estilos.rolActivo]}
              onPress={() => setRol('cliente')}
            >
              <Text style={estilos.rolEmoji}>🛒</Text>
              <Text style={[estilos.rolTxt, rol === 'cliente' && estilos.rolTxtActivo]}>Soy cliente</Text>
              <Text style={estilos.rolDesc}>Quiero pedir</Text>
            </Pressable>
            <Pressable
              style={[estilos.rol, rol === 'repartidor' && estilos.rolActivo]}
              onPress={() => setRol('repartidor')}
            >
              <Text style={estilos.rolEmoji}>🛵</Text>
              <Text style={[estilos.rolTxt, rol === 'repartidor' && estilos.rolTxtActivo]}>Soy repartidor</Text>
              <Text style={estilos.rolDesc}>Tengo moto</Text>
            </Pressable>
          </View>

          <Campo etiqueta="Nombre(s)" placeholder="Ej. Juan" value={nombre} onChangeText={setNombre} />
          <Campo etiqueta="Apellido(s)" placeholder="Ej. Pérez García" value={apellido} onChangeText={setApellido} />
          <Campo
            etiqueta="Celular (10 dígitos)"
            placeholder="9531234567"
            keyboardType="phone-pad"
            maxLength={10}
            value={telefono}
            onChangeText={setTelefono}
          />
          <Campo
            etiqueta="Correo (opcional)"
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Campo
            etiqueta="Contraseña"
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {rol === 'repartidor' && (
            <View style={estilos.aviso}>
              <Text style={estilos.avisoTxt}>
                📋 Como repartidor te pediremos INE, licencia de motocicleta, tarjeta de circulación,
                comprobante de domicilio y una cuenta bancaria a tu nombre. Haremos una verificación
                de antecedentes antes de activarte.
              </Text>
            </View>
          )}

          <Boton titulo="Crear mi cuenta" onPress={submit} cargando={cargando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },
  titulo: { fontSize: 28, fontWeight: '800', color: colors.texto },
  subtitulo: { fontSize: 15, color: colors.textoSuave, marginBottom: espacio.lg },
  roles: { flexDirection: 'row', gap: espacio.md, marginBottom: espacio.lg },
  rol: {
    flex: 1,
    padding: espacio.md,
    borderRadius: radio.md,
    borderWidth: 1.5,
    borderColor: colors.borde,
    backgroundColor: colors.superficie,
    alignItems: 'center',
  },
  rolActivo: { borderColor: colors.primario, backgroundColor: '#FFF3E8' },
  rolEmoji: { fontSize: 36, marginBottom: espacio.xs },
  rolTxt: { fontWeight: '700', fontSize: 15, color: colors.texto },
  rolTxtActivo: { color: colors.primario },
  rolDesc: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  aviso: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: colors.acento,
    padding: espacio.md,
    borderRadius: radio.sm,
    marginBottom: espacio.md,
  },
  avisoTxt: { color: colors.texto, fontSize: 13, lineHeight: 19 },
});
