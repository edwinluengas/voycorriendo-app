import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

const ROLES = [
  {
    id: 'cliente',
    emoji: '🛒',
    titulo: 'Soy cliente',
    desc: 'Pido a domicilio',
  },
  {
    id: 'repartidor',
    emoji: '🛵',
    titulo: 'Soy repartidor',
    desc: 'Gano entregando',
  },
];

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
    <View style={estilos.contenedor}>
      <View style={estilos.decorCirculo} />

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
              <Text style={estilos.titulo}>Crea tu cuenta</Text>
              <Text style={estilos.subtitulo}>¿Cómo vas a usar VoyCorriendo?</Text>
            </View>

            {/* Selector de rol */}
            <View style={estilos.roles}>
              {ROLES.map((r) => {
                const activo = rol === r.id;
                return (
                  <Pressable
                    key={r.id}
                    style={[estilos.rolCard, activo && estilos.rolCardActivo]}
                    onPress={() => setRol(r.id)}
                  >
                    <View style={[estilos.rolIcono, activo && estilos.rolIconoActivo]}>
                      <Text style={estilos.rolEmoji}>{r.emoji}</Text>
                    </View>
                    <Text style={[estilos.rolTitulo, activo && estilos.rolTituloActivo]}>
                      {r.titulo}
                    </Text>
                    <Text style={estilos.rolDesc}>{r.desc}</Text>
                    {activo && <View style={estilos.checkCircle}><Text style={estilos.checkTxt}>✓</Text></View>}
                  </Pressable>
                );
              })}
            </View>

            {/* Formulario */}
            <View style={estilos.tarjeta}>
              <View style={estilos.fila2}>
                <Campo
                  etiqueta="Nombre(s)"
                  placeholder="Juan"
                  value={nombre}
                  onChangeText={setNombre}
                  oscuro
                  style={{ flex: 1 }}
                />
                <View style={{ width: espacio.sm }} />
                <Campo
                  etiqueta="Apellido(s)"
                  placeholder="Pérez"
                  value={apellido}
                  onChangeText={setApellido}
                  oscuro
                  style={{ flex: 1 }}
                />
              </View>

              <Campo
                etiqueta="Celular (10 dígitos)"
                placeholder="9531234567"
                keyboardType="phone-pad"
                maxLength={10}
                value={telefono}
                onChangeText={setTelefono}
                oscuro
              />
              <Campo
                etiqueta="Correo (opcional)"
                placeholder="tu@correo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                oscuro
              />
              <Campo
                etiqueta="Contraseña"
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                oscuro
              />

              {rol === 'repartidor' && (
                <View style={estilos.aviso}>
                  <Text style={estilos.avisoEmoji}>📋</Text>
                  <Text style={estilos.avisoTxt}>
                    Necesitarás INE, licencia de moto, tarjeta de circulación y cuenta bancaria a tu nombre. Verificaremos tus datos en 24-48 h.
                  </Text>
                </View>
              )}

              <View style={{ height: espacio.xs }} />
              <Boton titulo="Crear mi cuenta" onPress={submit} cargando={cargando} />
            </View>
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
    top: -60,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primario,
    opacity: 0.06,
  },
  scroll: { flexGrow: 1, paddingHorizontal: espacio.lg, paddingBottom: espacio.xl },
  encabezado: { paddingTop: espacio.xl, marginBottom: espacio.lg },
  titulo: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  subtitulo: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    marginTop: espacio.xs,
    fontWeight: '500',
  },
  roles: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.lg },
  rolCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radio.lg,
    padding: espacio.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  rolCardActivo: {
    borderColor: colors.primario,
    backgroundColor: 'rgba(255,92,0,0.08)',
  },
  rolIcono: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.sm,
  },
  rolIconoActivo: { backgroundColor: 'rgba(255,92,0,0.2)' },
  rolEmoji: { fontSize: 28 },
  rolTitulo: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  rolTituloActivo: { color: '#FFFFFF' },
  rolDesc: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  checkCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTxt: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  tarjeta: {
    backgroundColor: colors.oscuroCard,
    borderRadius: radio.xl,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  fila2: { flexDirection: 'row' },
  aviso: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,159,10,0.1)',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.25)',
  },
  avisoEmoji: { fontSize: 20 },
  avisoTxt: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
});
