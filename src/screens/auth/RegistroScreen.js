import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, Alert, ScrollView, StatusBar, Linking,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import CampoTelefono, { PAISES, validarTelefono } from '../../components/CampoTelefono';
import { colors, espacio, radio } from '../../theme/colors';

const API_BASE = 'https://voycorriendo-backend-production.up.railway.app';
const URL_TERMINOS   = `${API_BASE}/terminos`;
const URL_PRIVACIDAD = `${API_BASE}/privacidad`;

const ROLES = [
  { id: 'cliente',    emoji: '🛒', titulo: 'Soy cliente',    desc: 'Pido a domicilio' },
  { id: 'repartidor', emoji: '🛵', titulo: 'Soy repartidor', desc: 'Gano entregando'  },
  { id: 'negocio',    emoji: '🏪', titulo: 'Soy negocio',    desc: 'Vendo en la app'  },
];

export default function RegistroScreen({ navigation }) {
  const { registrarse } = useAuth();
  const [rol, setRol]                     = useState('cliente');
  const [nombre, setNombre]               = useState('');
  const [apellido, setApellido]           = useState('');
  const [pais, setPais]                   = useState(PAISES[0]);   // México por defecto
  const [telefono, setTelefono]           = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [verPassword, setVerPassword]     = useState(false);
  const [aceptoTerminos, setAceptoTerminos]   = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [cargando, setCargando]           = useState(false);

  const submit = async () => {
    if (!nombre || !apellido || !telefono || !password) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, celular y contraseña.');
      return;
    }
    const errorTel = validarTelefono(telefono, pais);
    if (errorTel) { Alert.alert('Revisa tu número', errorTel); return; }
    if (email && !email.includes('@')) {
      Alert.alert('Revisa tu correo', 'Escribe un correo válido o déjalo vacío (es opcional).');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña corta', 'Usa al menos 8 caracteres.');
      return;
    }
    if (!aceptoTerminos) {
      Alert.alert(
        'Acepta los términos',
        'Para crear tu cuenta debes aceptar los Términos de Uso y el Aviso de Privacidad.'
      );
      return;
    }
    try {
      setCargando(true);
      await registrarse({
        nombre, apellido, telefono, email: email || undefined, password, rol,
        lada: pais.lada,
        pais: pais.iso,
        acepto_terminos: true,
        acepta_marketing: aceptaMarketing,
      });
      if (rol === 'repartidor') {
        Alert.alert(
          '¡Cuenta creada!',
          'Para empezar a repartir necesitamos tu INE, licencia y datos de tu moto. Ve a "Mi perfil" para subirlos. Un operador validará todo en 24 a 48 horas.'
        );
      }
      if (rol === 'negocio') {
        Alert.alert(
          '¡Cuenta creada!',
          'Para empezar a vender necesitamos los datos de tu negocio, ubicación, documentos y productos. Un operador validará todo en 24 a 48 horas.'
        );
      }
    } catch (e) {
      // Mostrar el motivo EXACTO que devolvió el servidor (número ya
      // registrado, correo duplicado, validación…). Antes cualquier error sin
      // campo `mensaje` se veía como "no pudimos conectarnos al servidor" y
      // parecía falla de internet cuando era un dato del formulario.
      const codigo = e?.codigoError;
      if (codigo === 'TELEFONO_YA_REGISTRADO' || (codigo === 'DUPLICADO' && e?.campoError !== 'email')) {
        Alert.alert(
          'Ese número ya tiene cuenta',
          `${e.mensajeAmigable}`,
          [
            { text: 'Cambiar número', style: 'cancel' },
            { text: 'Recuperar contraseña', onPress: () => navigation.navigate('RecuperarPassword', { telefono }) },
          ],
        );
        return;
      }
      Alert.alert('No pudimos crear tu cuenta', e.mensajeAmigable || 'Revisa tus datos.');
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

          <CampoTelefono
            pais={pais} onChangePais={setPais}
            telefono={telefono} onChangeTelefono={setTelefono}
            label="CELULAR"
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
              placeholder="Mínimo 8 caracteres"
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
          {rol === 'negocio' && (
            <View style={estilos.aviso}>
              <Text style={estilos.avisoEmoji}>📋</Text>
              <Text style={estilos.avisoTxt}>
                Necesitarás ubicación confirmada, foto de portada, foto del local, comprobante de domicilio, INE del dueño y cuenta bancaria. Verificaremos tus datos en 24-48 h.
              </Text>
            </View>
          )}
          )}

          {/* ── Consentimiento legal ── */}
          <View style={estilos.separador} />

          {/* Obligatorio: términos + privacidad */}
          <Pressable style={estilos.checkRow} onPress={() => setAceptoTerminos(v => !v)}>
            <View style={[estilos.checkbox, aceptoTerminos && estilos.checkboxActivo]}>
              {aceptoTerminos && <Text style={estilos.checkboxMarca}>✓</Text>}
            </View>
            <Text style={estilos.checkTxtLegal}>
              He leído y acepto los{' '}
              <Text style={estilos.link} onPress={() => Linking.openURL(URL_TERMINOS)}>
                Términos de Uso
              </Text>
              {' '}y el{' '}
              <Text style={estilos.link} onPress={() => Linking.openURL(URL_PRIVACIDAD)}>
                Aviso de Privacidad
              </Text>
              {' '}de VoyCorriendo, incluyendo el tratamiento de mis datos personales conforme a la LFPDPPP.{' '}
              <Text style={estilos.obligatorio}>*Obligatorio</Text>
            </Text>
          </Pressable>

          {/* Opcional: marketing */}
          <Pressable style={[estilos.checkRow, { marginTop: espacio.sm }]} onPress={() => setAceptaMarketing(v => !v)}>
            <View style={[estilos.checkbox, aceptaMarketing && estilos.checkboxMarketing]}>
              {aceptaMarketing && <Text style={estilos.checkboxMarca}>✓</Text>}
            </View>
            <Text style={estilos.checkTxtLegal}>
              Acepto recibir promociones, descuentos y novedades de VoyCorriendo por SMS o notificación push.{' '}
              <Text style={{ color: '#9CA3AF' }}>Opcional. Puedes revocar en cualquier momento.</Text>
            </Text>
          </Pressable>

          <TouchableOpacity
            style={[estilos.boton, (!aceptoTerminos || cargando) && estilos.botonDesactivado]}
            onPress={submit}
            disabled={!aceptoTerminos || cargando}
            activeOpacity={0.85}
          >
            <Text style={estilos.botonTxt}>{cargando ? 'Creando cuenta...' : 'Crear mi cuenta'}</Text>
          </TouchableOpacity>

          <Text style={estilos.footerLegal}>
            Tus datos se tratan conforme a la Ley Federal de Protección de Datos Personales (LFPDPPP). Para ejercer tus derechos ARCO escríbenos a{' '}
            <Text style={estilos.link} onPress={() => Linking.openURL('mailto:voycorriendoadmin@gmail.com')}>
              voycorriendoadmin@gmail.com
            </Text>
          </Text>
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
    padding: espacio.sm,
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

  // ── Consentimiento ──
  separador: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: espacio.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.sm,
  },
  checkbox: {
    width: 22, height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActivo: {
    borderColor: colors.primario,
    backgroundColor: colors.primario,
  },
  checkboxMarketing: {
    borderColor: '#6B7280',
    backgroundColor: '#6B7280',
  },
  checkboxMarca: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  checkTxtLegal: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  link: {
    color: colors.primario,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  obligatorio: { color: '#EF4444', fontWeight: '700' },
  footerLegal: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: espacio.md,
    lineHeight: 16,
  },

  boton: {
    backgroundColor: colors.primario,
    borderRadius: radio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: espacio.md,
    elevation: 4,
    shadowColor: colors.primario,
    shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  botonDesactivado: { opacity: 0.45 },
  botonTxt: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
