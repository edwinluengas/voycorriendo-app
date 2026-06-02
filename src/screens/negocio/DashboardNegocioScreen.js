/**
 * DashboardNegocioScreen
 * ----------------------
 * El dueño del negocio ve sus pedidos en tiempo real, agrupados por estado.
 * - Si el negocio aún no está aprobado: muestra cuadro de estado con CTA al wizard.
 * - Si está aprobado: muestra switch "Abrir/Cerrar" + tabs de pedidos.
 * - Tabs: Nuevos, En preparación, Listos, Historial
 * - Al crearse un pedido nuevo: alerta/beep (Socket.io 'nuevo_pedido')
 * - Al cambiar estado: refresco automático ('estado_pedido')
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Vibration, Alert, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import { negocioDashboardAPI, negocioOnboardingAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

// Tabs y su mapeo a los estados de la base de datos
const TABS = [
  { key: 'nuevos',     label: 'Nuevos',       estados: ['pendiente'] },
  { key: 'preparando', label: 'Preparando',   estados: ['confirmado', 'preparando'] },
  { key: 'listos',     label: 'Listos',       estados: ['listo', 'en_camino'] },
  { key: 'historial',  label: 'Historial',    estados: ['entregado', 'cancelado', 'rechazado'] },
];

const ETIQUETA_ESTADO = {
  pendiente:   { texto: 'Nuevo',        color: colors.advertencia, emoji: '🆕' },
  confirmado:  { texto: 'Confirmado',   color: colors.secundario,  emoji: '✅' },
  preparando:  { texto: 'Preparando',   color: colors.primario,    emoji: '🍳' },
  listo:       { texto: 'Listo',        color: colors.exito,       emoji: '📦' },
  en_camino:   { texto: 'En camino',    color: colors.secundario,  emoji: '🛵' },
  entregado:   { texto: 'Entregado',    color: colors.textoSuave,  emoji: '🎉' },
  cancelado:   { texto: 'Cancelado',    color: colors.error,       emoji: '❌' },
  rechazado:   { texto: 'Rechazado',    color: colors.error,       emoji: '🚫' },
};

const formatoHora = (fecha) => {
  if (!fecha) return '';
  try {
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
};

export default function DashboardNegocioScreen({ navigation }) {
  const { usuario, cerrarSesion, cargarRoles } = useAuth();
  const [tab, setTab]             = useState('nuevos');
  const [pedidos, setPedidos]     = useState([]);
  const [negocio, setNegocio]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [refrescando, setRefrescar] = useState(false);
  const [cambiandoApertura, setCambiandoApertura] = useState(false);
  const socketRef = useRef(null);

  // Carga: 1) datos del negocio (mi-negocio) y 2) pedidos si está aprobado
  const cargar = useCallback(async () => {
    try {
      // Primero traemos el estado completo del negocio
      const respNegocio = await negocioOnboardingAPI.miNegocio();
      const neg = respNegocio.data?.data?.negocio || null;
      setNegocio(neg);

      // Solo cargamos pedidos si el negocio está aprobado
      if (neg?.verificacion_estado === 'aprobado') {
        const respPedidos = await negocioDashboardAPI.misPedidos();
        setPedidos(respPedidos.data.data?.pedidos || []);
      } else {
        setPedidos([]);
      }
    } catch (e) {
      console.log('Error al cargar dashboard negocio:', e.mensajeAmigable);
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Socket.io: solo si el negocio está aprobado
  useEffect(() => {
    if (!negocio?.id || negocio?.verificacion_estado !== 'aprobado') return;
    const socket = conectarSocket();
    socketRef.current = socket;
    socket.emit('unirse_negocio', negocio.id);

    const onNuevo = () => {
      Vibration.vibrate([0, 400, 200, 400]);
      Notifications.scheduleNotificationAsync({
        content: {
          title: '🆕 ¡Nuevo pedido!',
          body: 'Tienes un nuevo pedido esperando confirmación. ¡Ábrelo ahora!',
          sound: true,
          channelId: 'pedidos',
          data: { tipo: 'nuevo_pedido' },
        },
        trigger: null,
      }).catch(() => {});
      Alert.alert(
        '🆕 ¡Nuevo pedido!',
        'Tienes un nuevo pedido esperando. ¿Lo aceptas?',
        [{ text: 'Ver ahora', onPress: () => setTab('nuevos') }],
        { cancelable: true },
      );
      cargar();
    };
    const onEstado = () => { cargar(); };
    socket.on('nuevo_pedido', onNuevo);
    socket.on('estado_pedido', onEstado);

    return () => {
      socket.off('nuevo_pedido', onNuevo);
      socket.off('estado_pedido', onEstado);
    };
  }, [negocio?.id, negocio?.verificacion_estado, cargar]);

  // Toggle abrir/cerrar negocio
  const toggleApertura = async (valor) => {
    setCambiandoApertura(true);
    try {
      await negocioOnboardingAPI.cambiarApertura(valor);
      setNegocio((n) => n ? { ...n, abierto_ahora: valor } : n);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo cambiar el estado.');
    } finally {
      setCambiandoApertura(false);
    }
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  // ─── Si NO está aprobado: mostrar estado y CTA ────────────────
  if (!negocio || negocio.verificacion_estado !== 'aprobado') {
    return (
      <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
        <ScrollView contentContainerStyle={estilos.scrollEstado}>
          <View style={estilos.cuadroEstado}>
            <Text style={estilos.iconoEstado}>{iconoPorEstado(negocio?.verificacion_estado)}</Text>
            <Text style={estilos.tituloEstado}>{tituloPorEstado(negocio?.verificacion_estado)}</Text>
            <Text style={estilos.mensajeEstado}>
              {mensajePorEstado(negocio?.verificacion_estado, negocio?.verificacion_nota)}
            </Text>

            {(negocio?.verificacion_estado === 'pendiente' ||
              negocio?.verificacion_estado === 'rechazado' ||
              !negocio) && (
              <Pressable
                style={estilos.botonCTA}
                onPress={() => navigation.navigate('OnboardingNegocio')}
              >
                <Text style={estilos.botonCTATxt}>
                  {negocio?.verificacion_estado === 'rechazado'
                    ? 'Corregir y reenviar'
                    : 'Continuar registro'}
                </Text>
              </Pressable>
            )}

            {negocio?.verificacion_estado === 'en_revision' && (
              <Pressable style={estilos.botonRefresh} onPress={() => { setRefrescar(true); cargar(); }}>
                <Text style={estilos.botonRefreshTxt}>🔄 Verificar estado</Text>
              </Pressable>
            )}

            {/* Botón de fotos disponible siempre que exista el negocio */}
            {negocio && (
              <Pressable
                style={estilos.botonFotos}
                onPress={() => navigation.navigate('FotosNegocio')}
              >
                <Text style={estilos.botonFotosTxt}>📷 Seleccionar fotos</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View style={estilos.footer}>
          <Pressable style={estilos.perfilBtn} onPress={() => navigation.navigate('Perfil')}>
            <Text style={estilos.perfilBtnTxt}>👤 Cambiar de modo</Text>
          </Pressable>
          <Pressable onPress={() => {
            Alert.alert('Cerrar sesión', '¿Seguro que deseas salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
            ]);
          }}>
            <Text style={estilos.salir}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Si SÍ está aprobado: dashboard normal ────────────────────
  const tabActual = TABS.find((t) => t.key === tab);
  const filtrados = pedidos.filter((p) => tabActual?.estados.includes(p.estado));
  const abierto = !!negocio.abierto_ahora;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* Saludo + switch abrir/cerrar */}
      <View style={estilos.saludo}>
        <View style={estilos.saludoFila}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.hola}>🏪 {negocio?.nombre || 'Tu negocio'}</Text>
            <Text style={estilos.subtitulo}>
              Hola {usuario?.nombre?.split(' ')[0]}, aquí ves los pedidos entrando.
            </Text>
          </View>
          {cambiandoApertura
            ? <ActivityIndicator color={colors.primario} />
            : <Switch
                value={abierto}
                onValueChange={toggleApertura}
                trackColor={{ false: '#999', true: colors.exito }}
                thumbColor="#FFF"
              />
          }
        </View>
        <View style={[estilos.estadoApertura, { backgroundColor: abierto ? '#E7F7EE' : '#FFE2E0' }]}>
          <Text style={[estilos.estadoAperturaTxt, { color: abierto ? '#1B7F3A' : '#B3261E' }]}>
            {abierto ? '✅ ABIERTO — recibiendo pedidos' : '⛔ CERRADO — no recibes pedidos'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={estilos.tabs}>
        {TABS.map((t) => {
          const n = pedidos.filter((p) => t.estados.includes(p.estado)).length;
          const activo = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[estilos.tab, activo && estilos.tabActiva]}
            >
              <Text style={[estilos.tabTxt, activo && estilos.tabTxtActiva]}>
                {t.label}
              </Text>
              {n > 0 && (
                <View style={estilos.badge}>
                  <Text style={estilos.badgeTxt}>{n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Lista */}
      <FlatList
        data={filtrados}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescar(true); cargar(); }}
            tintColor={colors.primario}
          />
        }
        contentContainerStyle={{ paddingVertical: espacio.sm, paddingBottom: espacio.xl * 2 }}
        ListEmptyComponent={
          <View style={estilos.vacio}>
            <Text style={{ fontSize: 54 }}>📭</Text>
            <Text style={estilos.vacioTxt}>No hay pedidos aquí</Text>
            <Text style={estilos.vacioSub}>
              {tab === 'nuevos'
                ? abierto
                  ? 'Cuando llegue un pedido te avisaremos.'
                  : 'Abre tu negocio para empezar a recibir pedidos.'
                : 'Desliza hacia abajo para refrescar.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaPedido
            pedido={item}
            onPress={() => navigation.navigate('PedidoDetalleNegocio', { pedidoId: item.id })}
          />
        )}
      />

      {/* Footer */}
      <View style={estilos.footer}>
        <View style={estilos.footerBotones}>
          <Pressable onPress={() => navigation.navigate('ProductosNegocio')} style={estilos.tokenBtn}>
            <Text style={estilos.tokenBtnTxt}>🍽️ Productos</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FotosNegocio')} style={estilos.fotosBtn}>
            <Text style={estilos.fotosBtnTxt}>📷 Fotos</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Perfil')} style={estilos.perfilBtn}>
            <Text style={estilos.perfilBtnTxt}>👤 Perfil</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => {
          Alert.alert('Cerrar sesión', '¿Seguro que deseas salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
          ]);
        }}>
          <Text style={estilos.salir}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Helpers de estado de verificación ─────────────────────────
function iconoPorEstado(estado) {
  switch (estado) {
    case 'pendiente':   return '📝';
    case 'en_revision': return '⏳';
    case 'rechazado':   return '⚠️';
    case 'aprobado':    return '✅';
    default:            return '🏪';
  }
}

function tituloPorEstado(estado) {
  switch (estado) {
    case 'pendiente':   return 'Termina tu registro';
    case 'en_revision': return 'En revisión';
    case 'rechazado':   return 'Documentos rechazados';
    case 'aprobado':    return '¡Aprobado!';
    default:            return 'Activa tu negocio';
  }
}

function mensajePorEstado(estado, nota) {
  switch (estado) {
    case 'pendiente':
      return 'Aún te faltan datos para enviar tu negocio a revisión. Completa el registro para empezar a recibir pedidos.';
    case 'en_revision':
      return 'Recibimos tu negocio y nuestro equipo lo está revisando. En menos de 24 horas te avisaremos.';
    case 'rechazado':
      return nota || 'Tus documentos no pudieron ser aprobados. Revisa el motivo, corrige la información y vuelve a enviarlos.';
    default:
      return 'Para empezar a recibir pedidos necesitamos algunos datos de tu tienda o restaurante.';
  }
}

function TarjetaPedido({ pedido, onPress }) {
  const et = ETIQUETA_ESTADO[pedido.estado] || { texto: pedido.estado, color: colors.textoSuave, emoji: '•' };
  const totalItems = Array.isArray(pedido.items)
    ? pedido.items.reduce((a, it) => a + (it.cantidad || 0), 0)
    : 0;
  const requiereID = Array.isArray(pedido.items) && pedido.items.some((it) => it.requiere_id);
  const clienteNombre = pedido.cliente?.nombre || 'Cliente';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.7 }]}>
      <View style={estilos.encab}>
        <Text style={estilos.numero}>#{pedido.numero}</Text>
        <View style={[estilos.pill, { backgroundColor: et.color + '22', borderColor: et.color }]}>
          <Text style={[estilos.pillTxt, { color: et.color }]}>
            {et.emoji} {et.texto}
          </Text>
        </View>
      </View>

      <Text style={estilos.cliente}>👤 {clienteNombre}</Text>
      <Text style={estilos.direccion} numberOfLines={2}>📍 {pedido.direccion_entrega}</Text>

      <View style={estilos.fila}>
        <Text style={estilos.items}>🛍️ {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}</Text>
        {requiereID && (
          <View style={estilos.edadPill}>
            <Text style={estilos.edadTxt}>🔞 Requiere INE</Text>
          </View>
        )}
      </View>

      <View style={estilos.pie}>
        <Text style={estilos.total}>${parseFloat(pedido.total).toFixed(2)}</Text>
        <Text style={estilos.hora}>{formatoHora(pedido.creado_en)}</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  // ── Pantalla de estado (no aprobado) ──
  scrollEstado: { padding: espacio.lg, paddingTop: espacio.xl, alignItems: 'center' },
  cuadroEstado: {
    backgroundColor: colors.superficie,
    padding: espacio.xl,
    borderRadius: radio.lg,
    alignItems: 'center',
    width: '100%',
  },
  iconoEstado: { fontSize: 64, marginBottom: espacio.md },
  tituloEstado: {
    fontSize: 22, fontWeight: '800', color: colors.texto,
    textAlign: 'center', marginBottom: espacio.sm,
  },
  mensajeEstado: {
    fontSize: 14, color: colors.textoSuave,
    textAlign: 'center', lineHeight: 20, marginBottom: espacio.lg,
  },
  botonCTA: {
    backgroundColor: colors.primario,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radio.md,
  },
  botonCTATxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  botonRefresh: {
    backgroundColor: colors.fondo,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: radio.md,
    borderWidth: 1, borderColor: colors.borde,
  },
  botonRefreshTxt: { color: colors.texto, fontSize: 14, fontWeight: '700' },
  botonFotos: {
    marginTop: espacio.md,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: radio.md,
    borderWidth: 1, borderColor: '#3B82F6',
  },
  botonFotosTxt: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },

  // ── Dashboard normal (aprobado) ──
  saludo: { padding: espacio.lg, backgroundColor: colors.superficie, borderBottomWidth: 1, borderBottomColor: colors.borde },
  saludoFila: { flexDirection: 'row', alignItems: 'center' },
  hola: { fontSize: 20, fontWeight: '800', color: colors.texto },
  subtitulo: { fontSize: 13, color: colors.textoSuave, marginTop: 4 },
  estadoApertura: {
    marginTop: espacio.sm,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: radio.sm, alignItems: 'center',
  },
  estadoAperturaTxt: { fontSize: 12, fontWeight: '800' },

  tabs: { flexDirection: 'row', backgroundColor: colors.superficie, paddingHorizontal: espacio.sm, paddingTop: espacio.sm },
  tab: {
    flex: 1, paddingVertical: espacio.sm, paddingHorizontal: espacio.xs,
    alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  tabActiva: { borderBottomColor: colors.primario },
  tabTxt: { fontSize: 13, fontWeight: '600', color: colors.textoSuave },
  tabTxtActiva: { color: colors.primario },
  badge: {
    backgroundColor: colors.primario, borderRadius: radio.full,
    minWidth: 20, height: 20, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  tarjeta: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.md,
    borderLeftWidth: 4, borderLeftColor: colors.primario,
  },
  encab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontSize: 16, fontWeight: '800', color: colors.texto },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.full, borderWidth: 1 },
  pillTxt: { fontSize: 12, fontWeight: '700' },
  cliente: { marginTop: espacio.sm, fontSize: 14, color: colors.texto },
  direccion: { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: espacio.sm, gap: espacio.sm, flexWrap: 'wrap' },
  items: { fontSize: 13, color: colors.texto, fontWeight: '600' },
  edadPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radio.full },
  edadTxt: { fontSize: 11, color: '#991B1B', fontWeight: '700' },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.md },
  total: { fontSize: 18, fontWeight: '800', color: colors.primario },
  hora: { fontSize: 12, color: colors.textoSuave },

  vacio: { alignItems: 'center', marginTop: espacio.xl * 2, paddingHorizontal: espacio.lg },
  vacioTxt: { fontSize: 18, fontWeight: '700', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 13, color: colors.textoSuave, marginTop: 4, textAlign: 'center' },

  footer: { padding: espacio.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borde, backgroundColor: colors.superficie, gap: espacio.sm },
  footerBotones: { flexDirection: 'row', gap: espacio.sm },
  tokenBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#FFF3E8', borderRadius: radio.full, borderWidth: 1, borderColor: colors.primario },
  tokenBtnTxt: { color: colors.primario, fontSize: 14, fontWeight: '700' },
  fotosBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: radio.full, borderWidth: 1, borderColor: '#3B82F6' },
  fotosBtnTxt: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  perfilBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#F0FDF4', borderRadius: radio.full, borderWidth: 1, borderColor: '#16A34A' },
  perfilBtnTxt: { color: '#16A34A', fontSize: 14, fontWeight: '700' },
  salir: { color: colors.error, fontSize: 14, fontWeight: '600' },
});
