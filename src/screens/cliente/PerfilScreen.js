import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

export default function PerfilScreen({ navigation }) {
  const { usuario, roles, cerrarSesion, cambiarModo, cargarRoles } = useAuth();
  const [cambiando, setCambiando] = useState(false);

  // Refresca roles cada vez que abren la pantalla
  useEffect(() => { cargarRoles(); }, []);

  const salir = () => {
    Alert.alert('Cerrar sesion', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
    ]);
  };

  const cambiar = async (modo) => {
    if (modo === usuario?.modo_activo) return;
    setCambiando(true);
    try {
      await cambiarModo(modo);
    } catch (e) {
      Alert.alert('No se pudo cambiar de modo', e?.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setCambiando(false);
    }
  };

  const modoActivo = usuario?.modo_activo || 'cliente';

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <View style={estilos.avatar}>
          <Text style={estilos.avatarTxt}>
            {usuario?.nombre?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={estilos.nombre}>{usuario?.nombre}</Text>
        <Text style={estilos.dato}>📱 {usuario?.telefono}</Text>
        {usuario?.email && <Text style={estilos.dato}>📧 {usuario.email}</Text>}

        {/* ─── Mis modos (multi-rol estilo Uber/Rappi) ──────────── */}
        <Text style={estilos.tituloSeccion}>Mis modos</Text>
        <Text style={estilos.subtituloSeccion}>
          Cambia entre cliente, repartidor y negocio. Activa los modos que quieras usar.
        </Text>

        {cambiando && (
          <View style={estilos.cargando}>
            <ActivityIndicator color={colors.primario} />
          </View>
        )}

        <ModoTarjeta
          icono="🛒"
          titulo="Cliente"
          subtitulo="Pide comida y productos a domicilio"
          activo={modoActivo === 'cliente'}
          estado={roles?.cliente?.estado || 'aprobado'}
          mensaje={roles?.cliente?.mensaje}
          onPress={() => cambiar('cliente')}
          onAccion={() => cambiar('cliente')}
          textoAccion="Usar este modo"
        />

        <ModoTarjeta
          icono="🛵"
          titulo="Repartidor"
          subtitulo="Recibe pedidos y gana dinero entregando"
          activo={modoActivo === 'repartidor'}
          estado={roles?.repartidor?.estado || 'inactivo'}
          mensaje={roles?.repartidor?.mensaje}
          calificacion={roles?.repartidor?.calificacion}
          onAccion={() => {
            const r = roles?.repartidor;
            if (!r?.activo) {
              // No tiene perfil de repartidor todavia: arrancamos el wizard
              navigation.navigate('OnboardingRepartidor');
              return;
            }
            if (r.estado === 'pendiente' || r.estado === 'rechazado') {
              // Tiene perfil pero falta info / fue rechazado: regresar al wizard
              navigation.navigate('OnboardingRepartidor');
              return;
            }
            if (r.estado !== 'aprobado') {
              Alert.alert('Aun no disponible', r.mensaje || 'Tu cuenta de repartidor aun esta en revision.');
              return;
            }
            cambiar('repartidor');
          }}
          textoAccion={
            !roles?.repartidor?.activo ? 'Activar modo' :
            roles?.repartidor?.estado === 'pendiente' ? 'Continuar registro' :
            roles?.repartidor?.estado === 'rechazado' ? 'Corregir y reenviar' :
            roles?.repartidor?.estado === 'aprobado' ? 'Usar este modo' :
            'Ver estado'
          }
        />

        <ModoTarjeta
          icono="🏪"
          titulo="Negocio"
          subtitulo="Administra tu tienda o restaurante"
          activo={modoActivo === 'negocio'}
          estado={roles?.negocio?.estado || 'inactivo'}
          mensaje={roles?.negocio?.mensaje}
          calificacion={roles?.negocio?.calificacion}
          destacado={roles?.negocio?.destacado_calidad}
          onAccion={() => {
            const n = roles?.negocio;
            if (!n?.activo) {
              // No tiene negocio: arrancamos el wizard
              navigation.navigate('OnboardingNegocio');
              return;
            }
            if (n.estado === 'pendiente' || n.estado === 'rechazado') {
              // Tiene negocio pero falta info / fue rechazado: regresar al wizard
              navigation.navigate('OnboardingNegocio');
              return;
            }
            if (n.estado !== 'aprobado') {
              Alert.alert('Aun no disponible', n.mensaje || 'Tu negocio aun esta en revision.');
              return;
            }
            cambiar('negocio');
          }}
          textoAccion={
            !roles?.negocio?.activo ? 'Activar modo' :
            roles?.negocio?.estado === 'pendiente' ? 'Continuar registro' :
            roles?.negocio?.estado === 'rechazado' ? 'Corregir y reenviar' :
            roles?.negocio?.estado === 'aprobado' ? 'Usar este modo' :
            'Ver estado'
          }
        />

        {/* ─── Opciones de cuenta ─────────────────────────────── */}
        <Text style={estilos.tituloSeccion}>Mi cuenta</Text>
        <View style={estilos.opciones}>
          <Opcion icono="📍" titulo="Mis direcciones" onPress={() => Alert.alert('Proximamente')} />
          <Opcion icono="💳" titulo="Metodos de pago" onPress={() => Alert.alert('Proximamente')} />
          <Opcion icono="⭐" titulo="Mis calificaciones" onPress={() => Alert.alert('Proximamente')} />
          <Opcion icono="🔔" titulo="Notificaciones" onPress={() => Alert.alert('Proximamente')} />
          <Opcion icono="📄" titulo="Terminos y privacidad" onPress={() => Alert.alert('Proximamente')} />
        </View>

        <Boton titulo="Cerrar sesion" variante="secundario" onPress={salir} />
        <Text style={estilos.version}>VoyCorriendo v1.0 · Puerto Escondido</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tarjeta de un modo (cliente/repartidor/negocio) ────────────
const ModoTarjeta = ({ icono, titulo, subtitulo, activo, estado, mensaje, calificacion, destacado, onAccion, textoAccion }) => {
  const colorEstado = colorPorEstado(estado);
  return (
    <View style={[estilos.tarjeta, activo && estilos.tarjetaActiva]}>
      <View style={estilos.tarjetaCabecera}>
        <Text style={estilos.tarjetaIcono}>{icono}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={estilos.tarjetaTitulo}>{titulo}</Text>
            {activo && <View style={estilos.bagdgeActivo}><Text style={estilos.bagdgeTxt}>EN USO</Text></View>}
            {destacado && <View style={estilos.badgeDestacado}><Text style={estilos.bagdgeTxt}>TOP</Text></View>}
          </View>
          <Text style={estilos.tarjetaSub}>{subtitulo}</Text>
        </View>
      </View>

      <View style={[estilos.estadoFila, { backgroundColor: colorEstado.fondo }]}>
        <Text style={[estilos.estadoTxt, { color: colorEstado.texto }]}>
          {etiquetaEstado(estado)}
        </Text>
        {calificacion ? (
          <Text style={estilos.calif}>⭐ {Number(calificacion).toFixed(1)}</Text>
        ) : null}
      </View>

      {mensaje ? <Text style={estilos.mensaje}>{mensaje}</Text> : null}

      <Pressable
        style={[estilos.botonModo, activo && estilos.botonModoActivo]}
        onPress={onAccion}
        disabled={activo}
      >
        <Text style={[estilos.botonModoTxt, activo && estilos.botonModoTxtActivo]}>
          {activo ? '✓ Estás aquí' : textoAccion}
        </Text>
      </Pressable>
    </View>
  );
};

function colorPorEstado(estado) {
  switch (estado) {
    case 'aprobado':    return { fondo: '#E7F7EE', texto: '#1B7F3A' };
    case 'pendiente':   return { fondo: '#FFF3D6', texto: '#A66B00' };
    case 'rechazado':   return { fondo: '#FFE2E0', texto: '#B3261E' };
    case 'suspendido':  return { fondo: '#FFE2E0', texto: '#B3261E' };
    case 'bloqueado':   return { fondo: '#3A2A2A', texto: '#FFFFFF' };
    case 'inactivo':
    default:            return { fondo: '#EEE',    texto: '#666' };
  }
}

function etiquetaEstado(estado) {
  switch (estado) {
    case 'aprobado':   return '✓ Aprobado';
    case 'pendiente':  return '⏳ En revision';
    case 'rechazado':  return '✕ Rechazado';
    case 'suspendido': return '⛔ Suspendido';
    case 'bloqueado':  return '🚫 Bloqueado';
    case 'inactivo':
    default:           return 'No activo';
  }
}

const Opcion = ({ icono, titulo, onPress }) => (
  <Pressable style={estilos.opcion} onPress={onPress}>
    <Text style={estilos.opcionIcono}>{icono}</Text>
    <Text style={estilos.opcionTxt}>{titulo}</Text>
    <Text style={estilos.opcionFlecha}>›</Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg, alignItems: 'stretch' },
  avatar: {
    alignSelf: 'center',
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: espacio.md,
  },
  avatarTxt: { color: '#FFF', fontSize: 40, fontWeight: '800' },
  nombre: { fontSize: 22, fontWeight: '700', color: colors.texto, textAlign: 'center' },
  dato: { fontSize: 14, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.xs },

  tituloSeccion: {
    fontSize: 16, fontWeight: '800', color: colors.texto,
    marginTop: espacio.lg, marginBottom: espacio.xs,
  },
  subtituloSeccion: {
    fontSize: 12, color: colors.textoSuave, marginBottom: espacio.md,
  },

  cargando: { marginVertical: espacio.sm, alignItems: 'center' },

  // Tarjeta de modo
  tarjeta: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tarjetaActiva: { borderColor: colors.primario },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center' },
  tarjetaIcono: { fontSize: 32, marginRight: espacio.md },
  tarjetaTitulo: { fontSize: 17, fontWeight: '800', color: colors.texto },
  tarjetaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },

  bagdgeActivo: {
    marginLeft: espacio.sm, paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.primario, borderRadius: 6,
  },
  badgeDestacado: {
    marginLeft: espacio.sm, paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: '#FFB300', borderRadius: 6,
  },
  bagdgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  estadoFila: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    marginTop: espacio.sm,
  },
  estadoTxt: { fontSize: 12, fontWeight: '700' },
  calif: { fontSize: 12, fontWeight: '700', color: '#A66B00' },

  mensaje: { fontSize: 12, color: colors.textoSuave, marginTop: espacio.sm, fontStyle: 'italic' },

  botonModo: {
    marginTop: espacio.md, paddingVertical: 10, borderRadius: radio.sm,
    backgroundColor: colors.primario, alignItems: 'center',
  },
  botonModoActivo: { backgroundColor: '#E7F7EE' },
  botonModoTxt: { color: '#FFF', fontWeight: '700' },
  botonModoTxtActivo: { color: '#1B7F3A' },

  opciones: { marginTop: espacio.sm, marginBottom: espacio.lg },
  opcion: {
    flexDirection: 'row', alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    marginBottom: espacio.xs,
  },
  opcionIcono: { fontSize: 22, marginRight: espacio.md },
  opcionTxt: { flex: 1, fontSize: 15, color: colors.texto, fontWeight: '600' },
  opcionFlecha: { fontSize: 24, color: colors.textoSuave },
  version: { fontSize: 12, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.lg },
});
