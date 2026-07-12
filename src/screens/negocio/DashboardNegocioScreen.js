/**
 * DashboardNegocioScreen — Dashboard en tiempo real para el dueño del negocio.
 * Tabs: Nuevos, Preparando, Listos, Historial
 * Socket.io para pedidos en vivo y notificaciones locales.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { negocioDashboardAPI, negocioOnboardingAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

const TABS = [
  { key: 'nuevos',     label: 'Nuevos',     estados: ['pendiente'] },
  { key: 'preparando', label: 'Preparando', estados: ['confirmado', 'preparando'] },
  { key: 'listos',     label: 'Listos',     estados: ['listo', 'en_camino'] },
  { key: 'historial',  label: 'Historial',  estados: ['entregado', 'cancelado', 'rechazado'] },
];

const ETIQUETA_ESTADO = {
  pendiente:  { texto: 'Nuevo',      color: colors.advertencia, fondo: '#FFF9E6', emoji: '🆕' },
  confirmado: { texto: 'Confirmado', color: colors.secundario,  fondo: '#E7F7EE', emoji: '✅' },
  preparando: { texto: 'Preparando', color: colors.primario,    fondo: '#FFF3E8', emoji: '🍳' },
  listo:      { texto: 'Listo',      color: colors.exito,       fondo: '#ECFDF5', emoji: '📦' },
  en_camino:  { texto: 'En camino',  color: colors.secundario,  fondo: '#E7F7EE', emoji: '🛵' },
  entregado:  { texto: 'Entregado',  color: colors.textoSuave,  fondo: '#F3F4F6', emoji: '🎉' },
  cancelado:  { texto: 'Cancelado',  color: colors.error,       fondo: '#FEF2F2', emoji: '❌' },
  rechazado:  { texto: 'Rechazado',  color: colors.error,       fondo: '#FEF2F2', emoji: '🚫' },
};

const formatoHora = (fecha) => {
  if (!fecha) return '';
  try {
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
};

export default function DashboardNegocioScreen({ navigation }) {
  const { usuario, cerrarSesion, cargarRoles } = useAuth();
  const [tab, setTab]               = useState('nuevos');
  const [pedidos, setPedidos]       = useState([]);
  const [negocio, setNegocio]       = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);
  const [cambiandoApertura, setCambiandoApertura] = useState(false);
  const socketRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const respNegocio = await negocioOnboardingAPI.miNegocio();
      const neg = respNegocio.data?.data?.negocio || null;
      setNegocio(neg);
      if (neg?.verificacion_estado === 'aprobado') {
        const respPedidos = await negocioDashboardAPI.misPedidos();
        setPedidos(respPedidos.data.data?.pedidos || []);
      } else {
        setPedidos([]);
      }
    } catch (e) {
      console.log('Error dashboard negocio:', e.mensajeAmigable);
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  useEffect(() => {
    if (!negocio?.id || negocio?.verificacion_estado !== 'aprobado') return;
    const socket = conectarSocket();
    socketRef.current = socket;

    // Entra al room del negocio — y vuelve a entrar si la conexión cae y reconecta
    const unirse = () => socket.emit('unirse_negocio', negocio.id);
    if (socket.connected) unirse();
    socket.on('connect', unirse);

    const onNuevo = () => {
      // Vibración y notificación push: AuthContext las dispara globalmente
      Alert.alert('🆕 ¡Nuevo pedido!', '¿Lo aceptas ahora?',
        [{ text: 'Ver ahora', onPress: () => setTab('nuevos') }],
        { cancelable: true },
      );
      cargar();
    };
    const onEstado = () => { cargar(); };
    socket.on('nuevo_pedido', onNuevo);
    socket.on('estado_pedido', onEstado);
    return () => {
      socket.off('connect', unirse);
      socket.off('nuevo_pedido', onNuevo);
      socket.off('estado_pedido', onEstado);
    };
  }, [negocio?.id, negocio?.verificacion_estado, cargar]);

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
      <View style={estilos.cargando}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  // Estado: negocio no aprobado
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
              negocio?.verificacion_estado === 'rechazado' || !negocio) && (
              <Pressable style={estilos.ctaBtn} onPress={() => navigation.navigate('OnboardingNegocio')}>
                <Text style={estilos.ctaBtnTxt}>
                  {negocio?.verificacion_estado === 'rechazado' ? 'Corregir y reenviar' : 'Continuar registro'}
                </Text>
              </Pressable>
            )}
            {negocio?.verificacion_estado === 'en_revision' && (
              <Pressable style={estilos.refreshBtn} onPress={() => { setRefrescar(true); cargar(); }}>
                <Text style={estilos.refreshBtnTxt}>🔄 Verificar estado</Text>
              </Pressable>
            )}
            {negocio && (
              <Pressable style={estilos.fotosBtn} onPress={() => navigation.navigate('FotosNegocio')}>
                <Text style={estilos.fotosBtnTxt}>📷 Subir fotos</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View style={estilos.footerEstado}>
          <Pressable style={estilos.footerLink} onPress={() => navigation.navigate('Perfil')}>
            <Text style={estilos.footerLinkTxt}>👤 Cambiar de modo</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Cerrar sesión', '¿Seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
          ])}>
            <Text style={estilos.salirTxt}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Dashboard normal
  const tabActual = TABS.find((t) => t.key === tab);
  const filtrados = pedidos.filter((p) => tabActual?.estados.includes(p.estado));
  const abierto = !!negocio.abierto_ahora;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* Header oscuro */}
      <View style={estilos.header}>
        <View style={estilos.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.headerNombre} numberOfLines={1}>{negocio?.nombre || 'Tu negocio'}</Text>
            <Text style={estilos.headerSub}>Hola {usuario?.nombre?.split(' ')[0]}, aquí van los pedidos</Text>
          </View>
          {cambiandoApertura
            ? <ActivityIndicator color="#FFF" />
            : <Switch
                value={abierto}
                onValueChange={toggleApertura}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.exito }}
                thumbColor="#FFF"
              />
          }
        </View>
        <View style={[estilos.aperturaBanner, { backgroundColor: abierto ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)' }]}>
          <View style={[estilos.aperturaDot, { backgroundColor: abierto ? colors.exito : colors.error }]} />
          <Text style={[estilos.aperturaTxt, { color: abierto ? '#34C759' : '#FF3B30' }]}>
            {abierto ? 'ABIERTO — recibiendo pedidos' : 'CERRADO — no recibes pedidos'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={estilos.tabs}>
        {TABS.map((t) => {
          const n = pedidos.filter((p) => t.estados.includes(p.estado)).length;
          const activo = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)}
              style={[estilos.tab, activo && estilos.tabActiva]}>
              <Text style={[estilos.tabTxt, activo && estilos.tabTxtActiva]}>{t.label}</Text>
              {n > 0 && (
                <View style={[estilos.badge, activo && estilos.badgeActivo]}>
                  <Text style={estilos.badgeTxt}>{n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Lista de pedidos */}
      <FlatList
        data={filtrados}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescar(true); cargar(); }}
            tintColor={colors.primario}
            colors={[colors.primario]}
          />
        }
        contentContainerStyle={{ paddingVertical: espacio.sm, paddingBottom: espacio.xl * 2 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={estilos.vacio}>
            <Text style={estilos.vacioEmoji}>📭</Text>
            <Text style={estilos.vacioTxt}>Sin pedidos aquí</Text>
            <Text style={estilos.vacioSub}>
              {tab === 'nuevos' && abierto
                ? 'Cuando llegue un pedido te avisaremos.'
                : tab === 'nuevos'
                ? 'Abre tu negocio para recibir pedidos.'
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

      {/* Footer de navegación */}
      <View style={estilos.footer}>
        <Pressable style={estilos.footerTab} onPress={() => navigation.navigate('ProductosNegocio')}>
          <Text style={estilos.footerTabEmoji}>🍽️</Text>
          <Text style={estilos.footerTabTxt}>Productos</Text>
        </Pressable>
        <Pressable style={estilos.footerTab} onPress={() => navigation.navigate('GananciasNegocio')}>
          <Text style={estilos.footerTabEmoji}>💰</Text>
          <Text style={estilos.footerTabTxt}>Ganancias</Text>
        </Pressable>
        <Pressable style={estilos.footerTab} onPress={() => navigation.navigate('Tokens')}>
          <Text style={estilos.footerTabEmoji}>🪙</Text>
          <Text style={estilos.footerTabTxt}>Tokens</Text>
        </Pressable>
        <Pressable style={estilos.footerTab} onPress={() => navigation.navigate('Perfil')}>
          <Text style={estilos.footerTabEmoji}>👤</Text>
          <Text style={estilos.footerTabTxt}>Perfil</Text>
        </Pressable>
        <Pressable style={estilos.footerTab} onPress={() => Alert.alert('Cerrar sesión', '¿Seguro?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
        ])}>
          <Text style={[estilos.footerTabEmoji, { fontSize: 14 }]}>🚪</Text>
          <Text style={[estilos.footerTabTxt, { color: colors.error }]}>Salir</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TarjetaPedido({ pedido, onPress }) {
  const et = ETIQUETA_ESTADO[pedido.estado] || { texto: pedido.estado, color: colors.textoSuave, fondo: '#EEE', emoji: '•' };
  const totalItems = Array.isArray(pedido.items)
    ? pedido.items.reduce((a, it) => a + (it.cantidad || 0), 0) : 0;
  const requiereID = Array.isArray(pedido.items) && pedido.items.some((it) => it.requiere_id);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.8 }]}
    >
      <View style={[estilos.tarjetaFranja, { backgroundColor: et.color }]} />
      <View style={estilos.tarjetaCuerpo}>
        <View style={estilos.tarjetaEncab}>
          <Text style={estilos.tarjetaNumero}>#{pedido.numero}</Text>
          <View style={[estilos.pill, { backgroundColor: et.fondo }]}>
            <Text style={[estilos.pillTxt, { color: et.color }]}>{et.emoji} {et.texto}</Text>
          </View>
        </View>

        <Text style={estilos.tarjetaCliente} numberOfLines={1}>
          👤 {pedido.cliente?.nombre || 'Cliente'}
        </Text>
        <Text style={estilos.tarjetaDireccion} numberOfLines={2}>
          📍 {pedido.direccion_entrega}
        </Text>

        <View style={estilos.tarjetaMeta}>
          <Text style={estilos.tarjetaItems}>
            🛍️ {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
          </Text>
          {requiereID && (
            <View style={estilos.edadBadge}>
              <Text style={estilos.edadBadgeTxt}>🔞 INE</Text>
            </View>
          )}
        </View>

        <View style={estilos.tarjetaPie}>
          <Text style={estilos.tarjetaTotal}>${parseFloat(pedido.total).toFixed(2)}</Text>
          <Text style={estilos.tarjetaHora}>{formatoHora(pedido.creado_en)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function iconoPorEstado(e) {
  return { pendiente: '📝', en_revision: '⏳', rechazado: '⚠️', aprobado: '✅' }[e] || '🏪';
}
function tituloPorEstado(e) {
  return { pendiente: 'Termina tu registro', en_revision: 'En revisión', rechazado: 'Documentos rechazados', aprobado: '¡Aprobado!' }[e] || 'Activa tu negocio';
}
function mensajePorEstado(e, nota) {
  if (e === 'pendiente') return 'Aún te faltan datos. Completa el registro para empezar a recibir pedidos.';
  if (e === 'en_revision') return 'Tu negocio está siendo revisado. Te avisaremos en menos de 24 horas.';
  if (e === 'rechazado') return nota || 'Tus documentos no fueron aprobados. Corrige la información y vuelve a enviarla.';
  return 'Para recibir pedidos necesitamos los datos de tu tienda o restaurante.';
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  cargando: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo },

  // Estado no aprobado
  scrollEstado: { padding: espacio.lg, paddingTop: espacio.xl, alignItems: 'center' },
  cuadroEstado: {
    backgroundColor: colors.superficie, padding: espacio.xl,
    borderRadius: radio.xl, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  iconoEstado: { fontSize: 64, marginBottom: espacio.md },
  tituloEstado: { fontSize: 22, fontWeight: '900', color: colors.texto, textAlign: 'center', marginBottom: espacio.sm },
  mensajeEstado: { fontSize: 14, color: colors.textoSuave, textAlign: 'center', lineHeight: 21, marginBottom: espacio.lg },
  ctaBtn: {
    backgroundColor: colors.primario, paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radio.lg, marginBottom: espacio.sm,
    shadowColor: colors.primario, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  ctaBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  refreshBtn: {
    backgroundColor: colors.fondo, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: radio.lg, borderWidth: 1, borderColor: colors.borde, marginBottom: espacio.sm,
  },
  refreshBtnTxt: { color: colors.texto, fontSize: 14, fontWeight: '700' },
  fotosBtn: {
    backgroundColor: '#EFF6FF', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: radio.lg, borderWidth: 1, borderColor: '#3B82F6',
  },
  fotosBtnTxt: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  footerEstado: {
    padding: espacio.md, alignItems: 'center', gap: espacio.sm,
    borderTopWidth: 1, borderTopColor: colors.borde, backgroundColor: colors.superficie,
  },
  footerLink: { paddingVertical: 10 },
  footerLinkTxt: { color: colors.primario, fontSize: 14, fontWeight: '700' },
  salirTxt: { color: colors.error, fontSize: 13, fontWeight: '600' },

  // Header
  header: { backgroundColor: colors.primario, paddingHorizontal: espacio.lg, paddingTop: espacio.md, paddingBottom: espacio.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.sm },
  headerNombre: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  aperturaBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: radio.sm, gap: 6,
  },
  aperturaDot: { width: 8, height: 8, borderRadius: 4 },
  aperturaTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: colors.superficie,
    paddingHorizontal: espacio.xs,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  tab: {
    flex: 1, paddingVertical: espacio.md, paddingHorizontal: espacio.xs,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    gap: 5, borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActiva: { borderBottomColor: colors.primario },
  tabTxt: { fontSize: 12, fontWeight: '700', color: colors.textoSuave },
  tabTxtActiva: { color: colors.primario },
  badge: {
    backgroundColor: colors.borde, borderRadius: radio.full,
    minWidth: 18, height: 18, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeActivo: { backgroundColor: colors.primario },
  badgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  // Cards de pedidos
  tarjeta: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tarjetaFranja: { width: 5 },
  tarjetaCuerpo: { flex: 1, padding: espacio.md },
  tarjetaEncab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.xs },
  tarjetaNumero: { fontSize: 17, fontWeight: '900', color: colors.texto },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.full },
  pillTxt: { fontSize: 12, fontWeight: '700' },
  tarjetaCliente: { fontSize: 13, color: colors.texto, fontWeight: '600', marginBottom: 2 },
  tarjetaDireccion: { fontSize: 12, color: colors.textoSuave, marginBottom: espacio.sm },
  tarjetaMeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, marginBottom: espacio.sm, flexWrap: 'wrap' },
  tarjetaItems: { fontSize: 13, color: colors.texto, fontWeight: '600' },
  edadBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radio.full },
  edadBadgeTxt: { fontSize: 11, color: '#991B1B', fontWeight: '700' },
  tarjetaPie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tarjetaTotal: { fontSize: 20, fontWeight: '900', color: colors.primario },
  tarjetaHora: { fontSize: 12, color: colors.textoSuave },

  // Vacío
  vacio: { alignItems: 'center', marginTop: espacio.xl * 2, paddingHorizontal: espacio.lg },
  vacioEmoji: { fontSize: 56 },
  vacioTxt: { fontSize: 18, fontWeight: '800', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 13, color: colors.textoSuave, marginTop: 4, textAlign: 'center', lineHeight: 19 },

  // Footer
  footer: {
    flexDirection: 'row',
    paddingVertical: espacio.sm,
    paddingHorizontal: espacio.md,
    backgroundColor: colors.superficie,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
  },
  footerTab: { flex: 1, alignItems: 'center', paddingVertical: espacio.xs },
  footerTabEmoji: { fontSize: 22 },
  footerTabTxt: { fontSize: 11, fontWeight: '700', color: colors.textoSuave, marginTop: 2 },
});
