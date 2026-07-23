/**
 * Pantalla principal del repartidor - estilo Uber/Rappi
 *
 * Si NO esta aprobado: muestra estado del onboarding y boton para
 * abrir el wizard.
 *
 * Si esta aprobado: muestra el switch "Conectarme" (Go Online).
 *   - Apagado: no recibe pedidos, mensaje "Estas fuera de linea".
 *   - Encendido: pide ubicacion y muestra pedidos disponibles.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Alert, RefreshControl, Switch, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { repartidoresAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import { useAuth } from '../../context/AuthContext';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

export default function InicioRepartidorScreen({ navigation }) {
  const { usuario, roles, cargarRoles, cambiarModo, cerrarSesion } = useAuth();
  const [conectado, setConectado]   = useState(false);
  const [pedidos, setPedidos]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);
  const [conectando, setConectando] = useState(false);
  const pedidosAnterioresRef = useRef(new Set());
  // Ref para que el socket siempre llame la versión más reciente de cargarPedidos
  const cargarPedidosRef    = useRef(null);

  const r = roles?.repartidor;
  const aprobado = r?.estado === 'aprobado';

  // Pedidos YA ACEPTADOS y aún no entregados (mi ruta activa). Sin esto, si
  // el repartidor cierra la app o cambia de rol a media entrega, el pedido
  // "desaparecía": la única navegación a PedidoActivo era el instante de
  // aceptar, y esta pantalla solo lista pedidos disponibles (sin asignar).
  const [rutaActiva, setRutaActiva] = useState([]);
  const cargarRuta = useCallback(async () => {
    try {
      const { data } = await repartidoresAPI.miRuta();
      setRutaActiva(data.data?.batch?.pedidos || []);
    } catch (_) {}
  }, []);

  // Cargar estado actual al entrar
  useFocusEffect(useCallback(() => {
    (async () => {
      await cargarRoles();
      cargarRuta();
      setCargando(false);
    })();
  }, []));

  // Sincroniza el switch local con el estado del backend
  useEffect(() => {
    if (r?.conectado !== undefined) setConectado(!!r.conectado);
  }, [r?.conectado]);

  // Polling cada 10s cuando está conectado y aprobado
  useEffect(() => {
    if (!conectado || !aprobado) {
      setPedidos([]);
      return;
    }
    cargarPedidos();
    const intervalo = setInterval(cargarPedidos, 10000);
    return () => clearInterval(intervalo);
  }, [conectado, aprobado]);

  const cargarPedidos = useCallback(async () => {
    try {
      const { data } = await repartidoresAPI.pedidosDisponibles();
      const nuevos = data.data?.pedidos || [];
      const nuevosIds = nuevos.map((p) => p.id);
      const hayNuevos = nuevosIds.some((id) => !pedidosAnterioresRef.current.has(id));
      if (hayNuevos && pedidosAnterioresRef.current.size > 0) {
        Vibration.vibrate([0, 300, 200, 300]);
        Notifications.scheduleNotificationAsync({
          content: {
            title: '🛵 ¡Nuevo pedido disponible!',
            body: 'Hay un pedido cerca de ti. ¡Tómalo antes que alguien más!',
            sound: true,
            channelId: 'repartidor',
            data: { tipo: 'pedido_disponible' },
          },
          trigger: null,
        }).catch(() => {});
        Alert.alert(
          '🛵 ¡Nuevo pedido!',
          'Hay un pedido disponible cerca de ti.',
          [{ text: '¡Ver ahora!', style: 'default' }],
          { cancelable: true },
        );
      }
      pedidosAnterioresRef.current = new Set(nuevosIds);
      setPedidos(nuevos);
    } catch (_) {
      setPedidos([]);
    } finally {
      setRefrescar(false);
    }
    cargarRuta();
  }, [cargarRuta]);

  // Mantener ref actualizada para el socket (evita stale closure)
  useEffect(() => { cargarPedidosRef.current = cargarPedidos; }, [cargarPedidos]);

  // Socket para notificación inmediata de pedidos disponibles
  useEffect(() => {
    if (!conectado || !aprobado || !usuario?.id) return;
    const socket = conectarSocket();

    // Entrar al room del repartidor — y volver a entrar si el socket reconecta
    const unirse = () => socket.emit('unirse_repartidor', usuario.id);
    if (socket.connected) unirse();
    socket.on('connect', unirse);

    const onDisponible = () => { cargarPedidosRef.current?.(); };
    socket.on('pedido_disponible', onDisponible);

    return () => {
      socket.off('connect', unirse);
      socket.off('pedido_disponible', onDisponible);
    };
  }, [conectado, aprobado, usuario?.id]);

  // ─── Conectarse / desconectarse ──────────────────────────
  const togglearConexion = async (nuevoEstado) => {
    setConectando(true);
    try {
      let lat = null, lng = null;
      if (nuevoEstado) {
        // Pedir ubicacion solo al conectarse
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('Necesitamos tu ubicacion',
            'Para asignarte pedidos cercanos necesitamos acceso a tu ubicacion.');
          setConectando(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const { data } = await repartidoresAPI.conectarse(nuevoEstado, lat, lng);
      setConectado(data.data?.conectado);
      if (nuevoEstado) cargarPedidos();
    } catch (e) {
      Alert.alert('No se pudo cambiar', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setConectando(false);
    }
  };

  const aceptar = async (id) => {
    try {
      await repartidoresAPI.aceptarPedido(id);
      navigation.navigate('PedidoActivo', { pedidoId: id });
    } catch (e) {
      Alert.alert('No se pudo aceptar', e.mensajeAmigable || 'Otro repartidor lo tomo primero.');
      cargarPedidos();
    }
  };

  const volverACliente = async () => {
    try { await cambiarModo('cliente'); } catch (_) {}
  };

  if (cargando) {
    return (
      <View style={[estilos.contenedor, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.secundario} />
      </View>
    );
  }

  // ── Si NO esta aprobado: pantalla de estado + accion ──
  if (!aprobado) {
    return (
      <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
        <View style={estilos.estadoBox}>
          <Text style={{ fontSize: 64 }}>{iconoEstado(r?.estado)}</Text>
          <Text style={estilos.estadoTitulo}>{tituloEstado(r?.estado)}</Text>
          <Text style={estilos.estadoMensaje}>{r?.mensaje || textoEstado(r?.estado)}</Text>

          {(r?.estado === 'pendiente' || r?.estado === 'rechazado' || !r?.activo) && (
            <Boton
              titulo={r?.estado === 'rechazado' ? 'Corregir y reenviar' : 'Continuar registro'}
              onPress={() => navigation.navigate('OnboardingRepartidor')}
              estilo={{ marginTop: espacio.lg, alignSelf: 'stretch' }}
            />
          )}

          <Boton
            titulo="Volver a modo cliente"
            variante="secundario"
            onPress={volverACliente}
            estilo={{ marginTop: espacio.sm, alignSelf: 'stretch' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Aprobado: switch Go Online + lista de pedidos ──
  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* Cabecera con switch */}
      <View style={[estilos.cabecera, conectado && estilos.cabeceraConectada]}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.hola}>
            {conectado ? '🟢 Estas en linea' : '⚪ Fuera de linea'}
          </Text>
          <Text style={estilos.subtitulo}>
            {conectado
              ? `Hola ${usuario?.nombre?.split(' ')[0]}, esperando pedidos cercanos`
              : 'Conectate para empezar a recibir pedidos'}
          </Text>
        </View>
        {conectando ? (
          <ActivityIndicator color={colors.primario} />
        ) : (
          <Switch
            value={conectado}
            onValueChange={togglearConexion}
            trackColor={{ false: '#CCC', true: colors.exito }}
            thumbColor="#FFF"
          />
        )}
      </View>

      {/* Pedido(s) en curso — SIEMPRE visible, conectado o no */}
      {rutaActiva.map((p) => (
        <Pressable
          key={p.id}
          style={estilos.enCurso}
          onPress={() => navigation.navigate('PedidoActivo', { pedidoId: p.id })}
        >
          <Text style={{ fontSize: 28 }}>🛵</Text>
          <View style={{ flex: 1 }}>
            <Text style={estilos.enCursoTitulo}>Pedido en curso — {p.numero}</Text>
            <Text style={estilos.enCursoSub} numberOfLines={1}>→ {p.direccion_entrega}</Text>
          </View>
          <Text style={estilos.enCursoIr}>Continuar ›</Text>
        </Pressable>
      ))}

      {/* Indicadores rapidos */}
      <View style={estilos.statsBar}>
        <Stat icono="⭐" valor={r?.calificacion?.toFixed(1) || '5.0'} label="Calif." />
        <Stat icono="📦" valor={r?.total_entregas || 0}              label="Entregas" />
        <Pressable style={estilos.statBtn} onPress={() => navigation.navigate('Tier')}>
          <Text style={estilos.statBtnEmoji}>{r?.tier === 'daily' ? '⚡' : '📅'}</Text>
          <Text style={estilos.statBtnTxt}>{r?.tier === 'daily' ? 'Diario' : 'Semanal'}</Text>
          <Text style={estilos.statBtnSub}>Cambiar</Text>
        </Pressable>
      </View>

      {/* Lista de pedidos */}
      {!conectado ? (
        <View style={estilos.vacio}>
          <Text style={{ fontSize: 56 }}>💤</Text>
          <Text style={estilos.vacioTxt}>Estas fuera de linea</Text>
          <Text style={estilos.vacioSub}>Activa el switch de arriba para empezar a trabajar.</Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => { setRefrescar(true); cargarPedidos(); }}
            />
          }
          ListEmptyComponent={
            <View style={estilos.vacio}>
              <Text style={{ fontSize: 56 }}>⏳</Text>
              <Text style={estilos.vacioTxt}>No hay pedidos ahorita</Text>
              <Text style={estilos.vacioSub}>Tranqui, te avisamos cuando llegue uno.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={estilos.tarjeta}>
              <View style={estilos.encab}>
                <Text style={estilos.numero}>{item.numero}</Text>
                <Text style={estilos.distancia}>📍 ~{item.distancia_km || '?'} km</Text>
              </View>
              <Text style={estilos.negocio}>🏪 {item.negocio?.nombre}</Text>
              <Text style={estilos.direccion}>→ {item.direccion_entrega}</Text>
              <View style={estilos.pie}>
                <View>
                  <Text style={estilos.total}>${parseFloat(item.total).toFixed(2)}</Text>
                  <Text style={estilos.ganancia}>Ganancia: ${item.ganancia_estimada || '35'}</Text>
                </View>
                <Boton
                  titulo="Tomar pedido"
                  onPress={() => aceptar(item.id)}
                  estilo={{ flex: 0, paddingHorizontal: espacio.lg }}
                />
              </View>
            </View>
          )}
        />
      )}

      <View style={estilos.footer}>
        <View style={{ flexDirection: 'row', gap: espacio.md, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Pressable onPress={volverACliente}>
            <Text style={estilos.cambiarModo}>← Modo cliente</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('GananciasRepartidor')}>
            <Text style={estilos.cambiarModo}>💰 Mis ganancias</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Perfil')}>
            <Text style={estilos.cambiarModo}>👤 Mi perfil</Text>
          </Pressable>
        </View>
        <Pressable onPress={cerrarSesion}>
          <Text style={estilos.salir}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Helpers de estado ──────────────────────────────────────
function iconoEstado(estado) {
  switch (estado) {
    case 'pendiente':  return '📋';
    case 'rechazado':  return '❌';
    case 'suspendido': return '⛔';
    case 'bloqueado':  return '🚫';
    default:           return '🛵';
  }
}
function tituloEstado(estado) {
  switch (estado) {
    case 'pendiente':  return 'Completa tu registro';
    case 'rechazado':  return 'Documentos rechazados';
    case 'suspendido': return 'Cuenta suspendida';
    case 'bloqueado':  return 'Cuenta bloqueada';
    default:           return 'Hola repartidor';
  }
}
function textoEstado(estado) {
  switch (estado) {
    case 'pendiente':  return 'Sube tus documentos para empezar a trabajar.';
    case 'rechazado':  return 'Necesitamos que actualices algunos documentos.';
    case 'suspendido': return 'Contacta a soporte para reactivar tu cuenta.';
    case 'bloqueado':  return 'Tu cuenta no puede recibir pedidos.';
    default:           return '';
  }
}

const Stat = ({ icono, valor, label }) => (
  <View style={estilos.stat}>
    <Text style={estilos.statIcono}>{icono}</Text>
    <Text style={estilos.statValor}>{valor}</Text>
    <Text style={estilos.statLabel}>{label}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  // Cabecera Go Online
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.lg,
    backgroundColor: colors.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  cabeceraConectada: { backgroundColor: '#E7F7EE' },
  hola: { fontSize: 18, fontWeight: '800', color: colors.texto },
  subtitulo: { fontSize: 13, color: colors.textoSuave, marginTop: 2 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    paddingVertical: espacio.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },

  // Banner de pedido en curso (ruta activa)
  enCurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    backgroundColor: colors.primario,
    marginHorizontal: espacio.md,
    marginTop: espacio.sm,
    padding: espacio.md,
    borderRadius: radio.md,
  },
  enCursoTitulo: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  enCursoSub:    { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  enCursoIr:     { color: '#FFF', fontWeight: '800', fontSize: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statBtnEmoji: { fontSize: 18 },
  statBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primario, marginTop: 2 },
  statBtnSub: { fontSize: 10, color: colors.textoSuave },
  statIcono: { fontSize: 18 },
  statValor: { fontSize: 16, fontWeight: '800', color: colors.texto, marginTop: 2 },
  statLabel: { fontSize: 11, color: colors.textoSuave },

  // Estado de onboarding
  estadoBox: {
    flex: 1,
    padding: espacio.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadoTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.texto,
    marginTop: espacio.md,
    textAlign: 'center',
  },
  estadoMensaje: {
    fontSize: 14,
    color: colors.textoSuave,
    marginTop: espacio.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Lista vacia
  vacio: { alignItems: 'center', marginTop: espacio.xl * 2, paddingHorizontal: espacio.lg },
  vacioTxt: { fontSize: 18, fontWeight: '600', marginTop: espacio.md, color: colors.texto },
  vacioSub: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },

  // Tarjeta de pedido
  tarjeta: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.secundario,
  },
  encab: { flexDirection: 'row', justifyContent: 'space-between' },
  numero: { fontSize: 14, fontWeight: '700', color: colors.textoSuave },
  distancia: { fontSize: 14, fontWeight: '700', color: colors.primario },
  negocio: { fontSize: 16, fontWeight: '700', color: colors.texto, marginTop: espacio.sm },
  direccion: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.md },
  total: { fontSize: 20, fontWeight: '800', color: colors.texto },
  ganancia: { fontSize: 12, color: colors.exito, fontWeight: '600' },

  footer: {
    padding: espacio.md,
    alignItems: 'center',
    gap: espacio.sm,
  },
  cambiarModo: { color: colors.primario, fontSize: 14, fontWeight: '600' },
  salir: { color: colors.error, fontSize: 13, marginTop: espacio.xs },
});
