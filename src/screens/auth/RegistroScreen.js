import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, Alert, ScrollView, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

const ROLES = [
  { id: 'cliente',    emoji: '🛒', titulo: 'Soy cliente',    desc: 'Pido a domicilio' },
  { id: 'repartidor', emoji: '🛵', titulo: 'Soy repartidor', desc: 'Gano entregando'  },
];

export default function RegistroScreen() {
  const { registrarse } = useAuth();
  const [rol, setRol]             = useState('cliente');
  const [nombre, setNombre]       = useState('');
  const [apellido, setApellido]   = useState('');
  const [telefono, setTelefono]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando]   = useState(false);

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
    <View style={estilos.raiz}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={estilos.titulo}>Crea tu cuenta</Text>
        <Text style={estilos.subtitulo}>¿Cómo vas a usar VoyCorriendo?</Text>

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
                <Text style={estilos.rolEmoji}>{r.emoji}</Text>
                <Text style={[estilos.rolTitulo, activo && estilos.rolTituloActivo]}>
                  {r.titulo}
                </Text>
                <Text style={estilos.rolDesc}>{r.desc}</Text>
                {activo && (
                  <View style={estilos.checkCircle}>
                    <Text style={estilos.checkTxt}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Formulario */}
        <View style={estilos.tarjeta}>
          {/* Nombre y Apellido en fila */}
          <View style={estilos.fila}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.label}>NOMBRE(S)</Text>
              <TextInput
                style={estilos.input}
                placeholder="Juan"
                placeholderTextColor="#A0A0A8"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={{ width: espacio.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.label}>APELLIDO(S)</Text>
              <TextInput
                style={estilos.input}
                placeholder="Pérez"
                placeholderTextColor="#A0A0A8"
                value={apellido}
                onChangeText={setApellido}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <Text style={estilos.label}>CELULAR (10 DÍGITOS)</Text>
          <TextInput
            style={estilos.input}
            placeholder="9531234567"
            placeholderTextColor="#A0A0A8"
            keyboardType="phone-pad"
            maxLength={10}
            value={telefono}
            onChangeText={setTelefono}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={estilos.label}>CORREO (OPCIONAL)</Text>
          <TextInput
            style={estilos.input}
            placeholder="tu@correo.com"
            placeholderTextColor="#A0A0A8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={estilos.label}>CONTRASEÑA</Text>
          <View style={estilos.inputRow}>
            <TextInput
              style={[estilos.input, estilos.inputPassword]}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#A0A0A8"
              secureTextEntry={!verPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={estilos.ojoBtn}
              onPress={() => setVerPassword(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={estilos.ojoTxt}>{verPassword ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>

          {rol === 'repartidor' && (
            <View style={estilos.aviso}>
              <Text style={estilos.avisoEmoji}>📋</Text>
              <Text style={estilos.avisoTxt}>
                Necesitarás INE, licencia de moto, tarjeta de circulación y cuenta bancaria a tu nombre. Verificaremos tus datos en 24-48 h.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[estilos.boton, cargando && estilos.botonDesactivado]}
            onPress={submit}
            disabled={cargando}
            activeOpacity={0.85}
          >
            <Text style={estilos.botonTxt}>{cargando ? 'Creando cuenta...' : 'Crear mi cuenta'}</Text>
          </TouchableOpacity>
        </View>
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
  titulo: {
    fontSize: 32, fontWeight: '900',
    color: '#111827', letterSpacing: -0.5,
    marginBottom: espacio.xs,
  },
  subtitulo: { fontSize: 15, color: '#6B7280', marginBottom: espacio.lg },
  roles: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.lg },
  rolCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: radio.lg,
    padding: espacio.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  rolCardActivo: { borderColor: colors.primario, backgroundColor: '#FFF5F0' },
  rolEmoji: { fontSize: 28, marginBottom: espacio.sm },
  rolTitulo: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  rolTituloActivo: { color: '#111827' },
  rolDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  checkCircle: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
  },
  checkTxt: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  tarjeta: {
    backgroundColor: '#F8F9FA',
    borderRadius: radio.xl,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fila: { flexDirection: 'row' },
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
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: espacio.md,
  },
  inputRow: { position: 'relative', marginBottom: espacio.md },
  inputPassword: { marginBottom: 0, paddingRight: 80 },
  ojoBtn: {
    position: 'absolute', right: espacio.md,
    top: 0, bottom: 0, justifyContent: 'center',
  },
  ojoTxt: { color: colors.primario, fontWeight: '700', fontSize: 14 },
  aviso: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avisoEmoji: { fontSize: 20 },
  avisoTxt: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
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
});
