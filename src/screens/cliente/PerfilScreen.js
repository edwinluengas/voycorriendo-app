import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';
import { usePlaza } from '../../context/PlazaContext';

export default function PerfilScreen({ navigation }) {
  const { usuario, roles, cerrarSesion, cambiarModo, cargarRoles } = useAuth();
  const plaza = usePlaza();
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => { cargarRoles(); }, []);

  const salir = () => {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
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
  const inicial = usuario?.nombre?.charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={estilos.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero del perfil */}
        <View style={estilos.hero}>
          <View style={estilos.avatarWrap}>
            <View style={estilos.avatar}>
              <Text style={estilos.avatarTxt}>{inicial}</Text>
            </View>
          </View>
          <Text style={estilos.nombre}>{usuario?.nombre}</Text>
          <View style={estilos.datosFila}>
            <Text style={estilos.dato}>📱 {usuario?.telefono}</Text>
            {usuario?.email && <Text style={estilos.dato}>  ·  📧 {usuario.email}</Text>}
          </View>
        </View>

        {/* Modos */}
        <View style={estilos.seccionHeader}>
          <Text style={estilos.seccionTit}>Mis modos</Text>
          {cambiando && <ActivityIndicator color={colors.primario} size="small" />}
        </View>
        <Text style={estilos.seccionSub}>Sé cliente, repartidor y negocio con una sola cuenta</Text>

        <ModoCard
          icono="🛒"
          iconoColor="#FF5C00"
          titulo="Cliente"
          subtitulo="Pide comida y productos"
          activo={modoActivo === 'cliente'}
          estado={roles?.cliente?.estado || 'aprobado'}
          mensaje={roles?.cliente?.mensaje}
          onAccion={() => cambiar('cliente')}
          textoAccion="Usar este modo"
        />
        <ModoCard
          icono="🛵"
          iconoColor="#00B341"
          titulo="Repartidor"
          subtitulo="Gana dinero repartiendo"
          activo={modoActivo === 'repartidor'}
          estado={roles?.repartidor?.estado || 'inactivo'}
          mensaje={roles?.repartidor?.mensaje}
          calificacion={roles?.repartidor?.calificacion}
          onAccion={() => {
            const r = roles?.repartidor;
            if (!r?.activo || r.estado === 'pendiente' || r.estado === 'rechazado') {
              navigation.navigate('OnboardingRepartidor'); return;
            }
            if (r.estado !== 'aprobado') {
              Alert.alert('Aún no disponible', r.mensaje || 'Tu cuenta está en revisión.'); return;
            }
            cambiar('repartidor');
          }}
          textoAccion={
            !roles?.repartidor?.activo ? 'Activar modo' :
            roles?.repartidor?.estado === 'pendiente' ? 'Continuar registro' :
            roles?.repartidor?.estado === 'rechazado' ? 'Corregir y reenviar' :
            roles?.repartidor?.estado === 'aprobado' ? 'Usar este modo' : 'Ver estado'
          }
        />
        <ModoCard
          icono="🏪"
          iconoColor="#3B82F6"
          titulo="Negocio"
          subtitulo="Administra tu tienda"
          activo={modoActivo === 'negocio'}
          estado={roles?.negocio?.estado || 'inactivo'}
          mensaje={roles?.negocio?.mensaje}
          calificacion={roles?.negocio?.calificacion}
          destacado={roles?.negocio?.destacado_calidad}
          onAccion={() => {
            const n = roles?.negocio;
            if (!n?.activo || n.estado === 'pendiente' || n.estado === 'rechazado') {
              navigation.navigate('OnboardingNegocio'); return;
            }
            if (n.estado !== 'aprobado') {
              Alert.alert('Aún no disponible', n.mensaje || 'Tu negocio está en revisión.'); return;
            }
            cambiar('negocio');
          }}
          textoAccion={
            !roles?.negocio?.activo ? 'Activar modo' :
            roles?.negocio?.estado === 'pendiente' ? 'Continuar registro' :
            roles?.negocio?.estado === 'rechazado' ? 'Corregir y reenviar' :
            roles?.negocio?.estado === 'aprobado' ? 'Usar este modo' : 'Ver estado'
          }
        />

        {/* Opciones de cuenta */}
        <Text style={[estilos.seccionTit, { marginTop: espacio.lg }]}>Mi cuenta</Text>
        <View style={estilos.menuCard}>
          <MenuItem icono="📍" titulo="Mis direcciones" onPress={() => navigation.navigate('Direcciones')} />
          <View style={estilos.divider} />
          <MenuItem icono="💳" titulo="Métodos de pago" onPress={() => navigation.navigate('MetodosPago')} />
          <View style={estilos.divider} />
          <MenuItem icono="⭐" titulo="Mis calificaciones" onPress={() => navigation.navigate('Calificaciones')} />
          <View style={estilos.divider} />
          <MenuItem icono="🔔" titulo="Notificaciones" onPress={() => navigation.navigate('Notificaciones')} />
          <View style={estilos.divider} />
          <MenuItem icono="📄" titulo="Términos y privacidad" onPress={() => navigation.navigate('PoliticaPrivacidad')} ultima />
        </View>

        <Pressable style={estilos.btnSalir} onPress={salir}>
          <Text style={estilos.btnSalirTxt}>Cerrar sesión</Text>
        </Pressable>

        <Text style={estilos.version}>{plaza.marca || 'VoyCorriendo'}</Text>
      </ScrollView>

    </SafeAreaView>
  );
}

function ModoCard({ icono, iconoColor, titulo, subtitulo, activo, estado, mensaje, calificacion, destacado, onAccion, textoAccion }) {
  const infoEstado = estadoInfo(estado);
  return (
    <View style={[estilos.modoCard, activo && estilos.modoCardActivo]}>
      <View style={estilos.modoCabecera}>
        <View style={[estilos.modoIconoWrap, { backgroundColor: iconoColor + '20' }]}>
          <Text style={estilos.modoIcono}>{icono}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={estilos.modoTituloFila}>
            <Text style={estilos.modoTitulo}>{titulo}</Text>
            {activo && <View style={estilos.badgeActivo}><Text style={estilos.badgeActivoTxt}>EN USO</Text></View>}
            {destacado && <View style={estilos.badgeTop}><Text style={estilos.badgeActivoTxt}>TOP</Text></View>}
          </View>
          <Text style={estilos.modoSub}>{subtitulo}</Text>
          {calificacion && <Text style={estilos.calif}>⭐ {Number(calificacion).toFixed(1)}</Text>}
        </View>
      </View>

      <View style={[estilos.estadoFila, { backgroundColor: infoEstado.fondo }]}>
        <Text style={[estilos.estadoTxt, { color: infoEstado.color }]}>{infoEstado.texto}</Text>
      </View>

      {mensaje && <Text style={estilos.mensaje}>{mensaje}</Text>}

      <Pressable
        style={[estilos.modoBtn, activo && estilos.modoBtnActivo]}
        onPress={onAccion}
        disabled={activo}
      >
        <Text style={[estilos.modoBtnTxt, activo && estilos.modoBtnTxtActivo]}>
          {activo ? '✓ Modo activo' : textoAccion}
        </Text>
      </Pressable>
    </View>
  );
}

function estadoInfo(estado) {
  switch (estado) {
    case 'aprobado':   return { texto: '✓ Aprobado',     color: '#1B7F3A', fondo: '#E7F7EE' };
    case 'pendiente':  return { texto: '⏳ En revisión', color: '#A66B00', fondo: '#FFF3D6' };
    case 'rechazado':  return { texto: '✕ Rechazado',    color: '#B3261E', fondo: '#FFE2E0' };
    case 'suspendido': return { texto: '⛔ Suspendido',  color: '#B3261E', fondo: '#FFE2E0' };
    case 'bloqueado':  return { texto: '🚫 Bloqueado',   color: '#FFFFFF', fondo: '#3A2A2A' };
    default:           return { texto: 'No activo',      color: '#666',    fondo: '#EEE' };
  }
}

const MenuItem = ({ icono, titulo, onPress, ultima = false }) => (
  <Pressable
    style={({ pressed }) => [estilos.menuItem, pressed && { backgroundColor: colors.fondo }]}
    onPress={onPress}
  >
    <View style={estilos.menuIconoWrap}>
      <Text style={estilos.menuIcono}>{icono}</Text>
    </View>
    <Text style={estilos.menuTxt}>{titulo}</Text>
    <Text style={estilos.menuChevron}>›</Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { paddingBottom: espacio.xl },

  hero: {
    backgroundColor: colors.oscuro,
    paddingVertical: espacio.xl,
    paddingHorizontal: espacio.lg,
    alignItems: 'center',
  },
  avatarWrap: {
    padding: 3,
    borderRadius: 52,
    backgroundColor: colors.primario,
    shadowColor: colors.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: espacio.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.oscuroCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primario,
  },
  avatarTxt: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  nombre: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: espacio.xs },
  datosFila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dato: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },


  seccionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.lg,
    marginTop: espacio.lg,
  },
  seccionTit: {
    fontSize: 18, fontWeight: '900', color: colors.texto,
    paddingHorizontal: espacio.lg,
    marginTop: espacio.lg,
  },
  seccionSub: {
    fontSize: 13, color: colors.textoSuave,
    paddingHorizontal: espacio.lg,
    marginTop: 2, marginBottom: espacio.md,
  },

  modoCard: {
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.lg,
    marginBottom: espacio.sm,
    borderRadius: radio.lg,
    padding: espacio.md,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modoCardActivo: { borderColor: colors.primario },
  modoCabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.sm, gap: espacio.md },
  modoIconoWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modoIcono: { fontSize: 26 },
  modoTituloFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  modoTitulo: { fontSize: 17, fontWeight: '800', color: colors.texto },
  modoSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  calif: { fontSize: 12, fontWeight: '700', color: '#A66B00', marginTop: 2 },

  badgeActivo: { backgroundColor: colors.primario, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTop: { backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeActivoTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  estadoFila: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginBottom: espacio.sm },
  estadoTxt: { fontSize: 12, fontWeight: '700' },
  mensaje: { fontSize: 12, color: colors.textoSuave, marginBottom: espacio.sm, fontStyle: 'italic' },

  modoBtn: {
    paddingVertical: 11, borderRadius: radio.md,
    backgroundColor: colors.primario, alignItems: 'center',
  },
  modoBtnActivo: { backgroundColor: '#E7F7EE' },
  modoBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  modoBtnTxtActivo: { color: '#1B7F3A' },

  menuCard: {
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.lg,
    marginTop: espacio.sm,
    borderRadius: radio.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
  },
  menuIconoWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.fondo,
    alignItems: 'center', justifyContent: 'center',
    marginRight: espacio.md,
  },
  menuIcono: { fontSize: 18 },
  menuTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.texto },
  menuChevron: { fontSize: 22, color: colors.textoSuave },
  divider: { height: 1, backgroundColor: colors.borde, marginLeft: espacio.md + 36 + espacio.md },

  btnSalir: {
    margin: espacio.lg,
    marginTop: espacio.xl,
    paddingVertical: 14,
    borderRadius: radio.lg,
    borderWidth: 1.5,
    borderColor: colors.error + '40',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  btnSalirTxt: { color: colors.error, fontSize: 15, fontWeight: '800' },
  version: {
    fontSize: 12, color: colors.textoSuave,
    textAlign: 'center', marginBottom: espacio.lg,
  },
});
