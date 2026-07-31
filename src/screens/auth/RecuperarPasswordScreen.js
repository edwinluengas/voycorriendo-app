/**
 * RecuperarPasswordScreen — "olvidé mi contraseña"
 *
 * Paso 1: elegir a dónde mandar el código (correo, Telegram o SMS).
 * Paso 2: escribir el código de 6 dígitos + la contraseña nueva.
 * Al terminar, el backend devuelve un token y se entra directo a la app.
 *
 * Los canales NO están fijos en el código: el servidor dice cuáles pueden
 * entregar hoy (/api/config-publica). Ofrecer uno apagado sería mandar al
 * usuario a esperar un mensaje que nadie va a enviarle.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { authAPI, pedidosAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import CampoTelefono, { PAISES, validarTelefono } from '../../components/CampoTelefono';
import { Ionicons } from '@expo/vector-icons';
import { CANALES_RECUPERACION_DEFAULT } from '../../config/businessRules';
import { colors, espacio, radio } from '../../theme/colors';

// Catálogo completo. Lo que se muestra es la intersección con lo que el
// servidor reporta como activo — el orden de aquí manda en la pantalla.
const CANALES = [
  { id: 'email',    icono: 'mail-outline',                label: 'Correo' },
  { id: 'telegram', icono: 'paper-plane-outline',         label: 'Telegram' },
  { id: 'sms',      icono: 'chatbubble-ellipses-outline', label: 'SMS' },
];

// Los que piden número de celular para identificar la cuenta (el correo se
// identifica con el correo).
const CANALES_POR_TELEFONO = ['sms', 'telegram'];

export default function RecuperarPasswordScreen({ navigation, route }) {
  const { entrarConToken } = useAuth();

  const [paso, setPaso]         = useState(1);
  const [canalesActivos, setCanalesActivos] = useState(CANALES_RECUPERACION_DEFAULT);
  const [canal, setCanal]       = useState(CANALES_RECUPERACION_DEFAULT[0]);
  const [pais, setPais]         = useState(PAISES[0]);
  const [telefono, setTelefono] = useState(route?.params?.telefono || '');
  const [email, setEmail]       = useState('');
  const [codigo, setCodigo]     = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [destino, setDestino]   = useState(null);

  // Qué canales puede entregar el servidor HOY. Si no contesta se queda con
  // el default compilado — mejor ofrecer algo razonable que una pantalla vacía.
  useEffect(() => {
    let vivo = true;
    pedidosAPI.configPublica()
      .then(({ data }) => {
        const lista = data?.data?.canales_recuperacion;
        if (!vivo || !Array.isArray(lista) || !lista.length) return;
        setCanalesActivos(lista);
        // Si el canal preseleccionado resultó estar apagado, moverse al
        // primero que sí sirva: si no, el usuario pide un código que el
        // servidor va a rechazar con 503.
        setCanal((actual) => (lista.includes(actual) ? actual : lista[0]));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const canalesVisibles = CANALES.filter((c) => canalesActivos.includes(c.id));
  const porTelefono = CANALES_POR_TELEFONO.includes(canal);

  const identidad = () => (porTelefono
    ? { telefono, lada: pais.lada }
    : { email: email.trim().toLowerCase() });

  const pedirCodigo = async () => {
    if (porTelefono) {
      const err = validarTelefono(telefono, pais);
      if (err) { Alert.alert('Revisa tu número', err); return; }
    } else if (!email.includes('@')) {
      Alert.alert('Revisa tu correo', 'Escribe un correo válido, por ejemplo nombre@correo.com.');
      return;
    }

    try {
      setCargando(true);
      const { data } = await authAPI.recuperarPassword({ ...identidad(), canal });
      setDestino(data?.destino || null);
      setPaso(2);
      Alert.alert(
        'Código enviado',
        data?.mensaje || 'Revisa tus mensajes y escribe el código de 6 dígitos.',
      );
    } catch (e) {
      // El backend distingue: canal no configurado, cuenta sin correo, fallo
      // real de envío. Se muestra tal cual — nada de "sin conexión" genérico.
      Alert.alert('No pudimos enviar el código', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const restablecer = async () => {
    if (codigo.trim().length !== 6) {
      Alert.alert('Código incompleto', 'El código son 6 dígitos.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Usa mínimo 8 caracteres.');
      return;
    }
    if (password !== password2) {
      Alert.alert('No coinciden', 'Las dos contraseñas deben ser iguales.');
      return;
    }
    try {
      setCargando(true);
      const { data } = await authAPI.restablecerPassword({ ...identidad(), codigo: codigo.trim(), password });
      const { token, usuario } = data.data || data;
      await entrarConToken(token, usuario);
      // El RootNavigator cambia solo al haber usuario — no hace falta navegar.
    } catch (e) {
      Alert.alert('No pudimos cambiar tu contraseña', e.mensajeAmigable || 'Intenta de nuevo.');
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
        <TouchableOpacity onPress={() => (paso === 2 ? setPaso(1) : navigation.goBack())} style={estilos.volver}>
          <Text style={estilos.volverTxt}>{'‹  Volver'}</Text>
        </TouchableOpacity>

        <Text style={estilos.titulo}>{paso === 1 ? 'Recupera tu\ncontraseña' : 'Escribe tu\ncódigo'}</Text>
        <Text style={estilos.subtitulo}>
          {paso === 1
            ? 'Te mandamos un código para crear una contraseña nueva.'
            : `Código enviado a ${destino?.telefono || destino?.email || 'tu cuenta'}. Vence en 15 minutos.`}
        </Text>

        <View style={estilos.tarjeta}>
          {paso === 1 ? (
            <>
              {/* Con un solo canal disponible no hay nada que elegir: se
                  ahorra el paso y se dice a secas por dónde va a llegar. */}
              <Text style={estilos.label}>
                {canalesVisibles.length > 1 ? '¿CÓMO QUIERES RECIBIRLO?' : 'TE LO MANDAMOS ASÍ'}
              </Text>
              <View style={estilos.canales}>
                {canalesVisibles.map((c) => {
                  const activo = canal === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[estilos.canal, activo && estilos.canalActivo]}
                      onPress={() => setCanal(c.id)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activo }}
                    >
                      <Ionicons
                        name={c.icono}
                        size={20}
                        color={activo ? colors.primario : colors.textoSuave}
                      />
                      <Text style={[estilos.canalTxt, activo && estilos.canalTxtActivo]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {canal === 'telegram' && (
                <Text style={estilos.ayudaCanal}>
                  Te llega al chat con @Voycorriendobot. Necesitas haberlo vinculado antes desde tu perfil.
                </Text>
              )}

              {porTelefono ? (
                <CampoTelefono
                  pais={pais} onChangePais={setPais}
                  telefono={telefono} onChangeTelefono={setTelefono}
                  label="TU CELULAR REGISTRADO"
                />
              ) : (
                <>
                  <Text style={estilos.label}>TU CORREO REGISTRADO</Text>
                  <TextInput
                    style={estilos.input}
                    placeholder="nombre@correo.com"
                    placeholderTextColor="#A0A0A8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </>
              )}

              <TouchableOpacity
                style={[estilos.boton, cargando && estilos.botonDesactivado]}
                onPress={pedirCodigo}
                disabled={cargando}
                activeOpacity={0.85}
              >
                {cargando
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={estilos.botonTxt}>Enviarme el código</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={estilos.label}>CÓDIGO DE 6 DÍGITOS</Text>
              <TextInput
                style={[estilos.input, estilos.inputCodigo]}
                placeholder="000000"
                placeholderTextColor="#D1D5DB"
                keyboardType="number-pad"
                maxLength={6}
                value={codigo}
                onChangeText={(v) => setCodigo(v.replace(/\D/g, ''))}
                autoFocus
              />

              <Text style={estilos.label}>CONTRASEÑA NUEVA</Text>
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
                  onPress={() => setVerPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={estilos.ojoTxt}>{verPassword ? 'Ocultar' : 'Ver'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={estilos.label}>REPITE LA CONTRASEÑA</Text>
              <TextInput
                style={estilos.input}
                placeholder="Otra vez"
                placeholderTextColor="#A0A0A8"
                secureTextEntry={!verPassword}
                value={password2}
                onChangeText={setPassword2}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={restablecer}
              />

              <TouchableOpacity
                style={[estilos.boton, cargando && estilos.botonDesactivado]}
                onPress={restablecer}
                disabled={cargando}
                activeOpacity={0.85}
              >
                {cargando
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={estilos.botonTxt}>Cambiar contraseña y entrar</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={pedirCodigo} disabled={cargando} style={estilos.reenviar}>
                <Text style={estilos.reenviarTxt}>¿No te llegó? Enviar otro código</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, paddingHorizontal: espacio.lg, paddingTop: 50, paddingBottom: espacio.xl },
  volver: { paddingVertical: espacio.sm, marginBottom: espacio.sm },
  volverTxt: { fontSize: 16, color: colors.primario, fontWeight: '700' },
  titulo: { fontSize: 32, fontWeight: '900', color: '#111827', lineHeight: 38, letterSpacing: -0.5, marginBottom: espacio.sm },
  subtitulo: { fontSize: 15, color: '#6B7280', marginBottom: espacio.xl },
  tarjeta: {
    backgroundColor: '#F8F9FA', borderRadius: radio.xl, padding: espacio.lg,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  label: { fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 7, letterSpacing: 0.8 },
  canales: { flexDirection: 'row', gap: 10, marginBottom: espacio.md },
  canal: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: radio.md,
    borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14,
  },
  canalActivo: { borderColor: colors.primario, backgroundColor: '#FFF4ED' },
  ayudaCanal: { fontSize: 12, color: colors.textoSuave, marginBottom: espacio.md, lineHeight: 17 },
  canalTxt: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  canalTxtActivo: { color: colors.primario },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: radio.md,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: espacio.md, paddingVertical: 16,
    fontSize: 16, color: '#111827', marginBottom: espacio.md,
  },
  inputCodigo: { fontSize: 28, fontWeight: '800', letterSpacing: 10, textAlign: 'center' },
  inputRow: { position: 'relative', marginBottom: espacio.md },
  inputPassword: { marginBottom: 0, paddingRight: 80 },
  ojoBtn: { position: 'absolute', right: espacio.md, top: 0, bottom: 0, justifyContent: 'center' },
  ojoTxt: { color: colors.primario, fontWeight: '700', fontSize: 14 },
  boton: {
    backgroundColor: colors.primario, borderRadius: radio.lg,
    paddingVertical: 16, alignItems: 'center', marginTop: espacio.xs,
    elevation: 4, shadowColor: colors.primario,
    shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  botonDesactivado: { opacity: 0.7 },
  botonTxt: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  reenviar: { alignItems: 'center', paddingVertical: espacio.md },
  reenviarTxt: { color: colors.primario, fontWeight: '700', fontSize: 14 },
});
