import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { repartidoresAPI, pedidosAPI, pagosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import { colors, espacio, radio } from '../../theme/colors';

const WA_VOYCORRIENDO = '527542462564';

const SIGUIENTE = {
  confirmado: { estado: 'preparando', label: 'Estoy en el negocio' },
  preparando: { estado: 'listo',      label: 'Ya recogí el pedido' },
  listo:      { estado: 'en_camino',  label: 'Voy en camino' },
  en_camino:  { estado: 'entregado',  label: 'Confirmar entrega' },
};

export default function PedidoActivoScreen({ route, navigation }) {
  const { pedidoId } = route.params;
  const [pedido, setPedido]           = useState(null);
  const [cargando, setCargando]       = useState(false);
  const [montoEfe, setMontoEfe]       = useState('');
  const [codigoEntrega, setCodigo]    = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await pedidosAPI.detalle(pedidoId);
      if (data.data?.pedido) setPedido(data.data.pedido);
    } catch (_) {}
  }, [pedidoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Escuchar cambios de estado via socket (ej: negocio marca "listo")
  useEffect(() => {
    const socket = conectarSocket();
    socket.emit('unirse_pedido', pedidoId);
    const onEstado = (data) => {
      if (data.pedido_id !== pedidoId) return;
      setPedido((p) => p ? { ...p, estado: data.estado } : p);
      if (data.estado === 'listo') {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '📦 ¡Pedido listo!',
            body: 'El negocio ya tiene listo el pedido. Ve a recogerlo.',
            sound: true,
            channelId: 'repartidor',
            data: { tipo: 'estado_pedido', pedidoId },
          },
          trigger: null,
        }).catch(() => {});
      }
    };
    socket.on('estado_pedido', onEstado);
    return () => { socket.off('estado_pedido', onEstado); };
  }, [pedidoId]);

  // Tracking de ubicación: envía cada 15s mientras hay pedido activo
  useEffect(() => {
    let interval;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const socket = conectarSocket();
      interval = setInterval(async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          socket.emit('actualizar_ubicacion', {
            pedido_id: pedidoId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          repartidoresAPI.ubicacion(pos.coords.latitude, pos.coords.longitude).catch(() => {});
        } catch (_) {}
      }, 15000);
    })();
    return () => clearInterval(interval);
  }, [pedidoId]);

  const avanzar = async () => {
    const sig = SIGUIENTE[pedido?.estado];
    if (!sig) return;

    // --- Validaciones antes de "Confirmar entrega" ---
    if (sig.estado === 'entregado') {
      // 1. Cobro en efectivo: validar monto recibido
      if (pedido.metodo_pago === 'efectivo') {
        const monto = parseFloat(montoEfe);
        if (!montoEfe || isNaN(monto) || monto < parseFloat(pedido.total)) {
          Alert.alert('Efectivo', `El cliente debe pagarte al menos $${parseFloat(pedido.total).toFixed(2)} MXN.`);
          return;
        }
        try {
          setCargando(true);
          const res = await pagosAPI.efectivo(pedidoId, monto);
          Alert.alert('Cobro registrado', `Cambio a entregar al cliente: $${res.data.data.cambio.toFixed(2)} MXN`);
        } catch (e) {
          Alert.alert('Error', e.mensajeAmigable || 'No se pudo registrar el pago en efectivo.');
          setCargando(false);
          return;
        }
      }

      // 2. Código de entrega: obligatorio para confirmar
      const codigo = codigoEntrega.trim();
      if (!codigo || codigo.length < 4) {
        Alert.alert('Código de entrega', 'Pide el código de 4 dígitos al cliente y escríbelo aquí para confirmar.');
        setCargando(false);
        return;
      }

      try {
        setCargando(true);
        await repartidoresAPI.actualizarEstado(pedidoId, 'entregado', { codigo_entrega: codigo });
        Alert.alert('¡Entrega confirmada! 🎉', 'Excelente trabajo. El pago se acreditará a tu cuenta.');
        navigation.replace('Inicio');
      } catch (e) {
        const msg = e.mensajeAmigable || e?.response?.data?.mensaje || 'No pudimos confirmar la entrega.';
        Alert.alert('Error', msg);
      } finally {
        setCargando(false);
      }
      return;
    }

    // --- Avance normal de estado (no entrega) ---
    try {
      setCargando(true);
      await repartidoresAPI.actualizarEstado(pedidoId, sig.estado);
      cargar();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos actualizar el estado.');
    } finally {
      setCargando(false);
    }
  };

  if (!pedido) return null;

  const sig = SIGUIENTE[pedido.estado];
  const esEntrega = sig?.estado === 'entregado';

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <Text style={estilos.numero}>{pedido.numero}</Text>

        {/* Recoger en */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTit}>🏪 Recoger en</Text>
          <Text style={estilos.seccionTxt}>{pedido.negocio?.nombre}</Text>
          <Text style={estilos.seccionDir}>{pedido.negocio?.direccion}</Text>
          {pedido.negocio?.latitud && pedido.negocio?.longitud && (
            <Boton
              titulo="Abrir en Google Maps"
              variante="secundario"
              onPress={() =>
                Linking.openURL(`https://maps.google.com/?q=${pedido.negocio.latitud},${pedido.negocio.longitud}`)
              }
            />
          )}
        </View>

        {/* Entregar a */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTit}>🏠 Entregar a</Text>
          <Text style={estilos.seccionTxt}>{pedido.cliente?.nombre}</Text>
          <Text style={estilos.seccionDir}>{pedido.direccion_entrega}</Text>
          {!!pedido.notas_entrega && (
            <Text style={estilos.notas}>📝 {pedido.notas_entrega}</Text>
          )}
          <Boton
            titulo="💬 Contactar cliente vía VoyCorriendo"
            variante="secundario"
            onPress={() => {
              const msg = encodeURIComponent(
                `Hola VoyCorriendo, soy el repartidor del pedido #${pedido.numero}. Necesito contactar al cliente.`
              );
              Linking.openURL(`whatsapp://send?phone=${WA_VOYCORRIENDO}&text=${msg}`)
                .catch(() => Linking.openURL(`https://wa.me/${WA_VOYCORRIENDO}?text=${msg}`));
            }}
          />
        </View>

        {/* Cobro */}
        <View style={estilos.cobroBox}>
          <Text style={estilos.cobroLabel}>Cobrar al cliente</Text>
          <Text style={estilos.cobroValor}>${parseFloat(pedido.total).toFixed(2)} MXN</Text>
          <Text style={estilos.cobroPago}>
            {pedido.metodo_pago === 'efectivo' ? '💵 En efectivo' :
             pedido.pago_estado === 'capturado' ? '✅ Ya pagó en la app' :
             '⏳ Pago digital pendiente'}
          </Text>
        </View>

        {/* Monto en efectivo — solo al entregar */}
        {esEntrega && pedido.metodo_pago === 'efectivo' && (
          <Campo
            etiqueta="¿Con cuánto te pagó el cliente?"
            placeholder={`Ej. $${Math.ceil(parseFloat(pedido.total) / 50) * 50}`}
            keyboardType="numeric"
            value={montoEfe}
            onChangeText={setMontoEfe}
          />
        )}

        {/* Código de entrega — obligatorio al confirmar entrega */}
        {esEntrega && (
          <View style={estilos.codigoBox}>
            <Text style={estilos.codigoTitulo}>🔑 Código de entrega</Text>
            <Text style={estilos.codigoDesc}>
              Pide al cliente el código de 4 dígitos que aparece en su app y escríbelo aquí para confirmar la entrega.
            </Text>
            <Campo
              placeholder="Ej. 3847"
              keyboardType="numeric"
              value={codigoEntrega}
              onChangeText={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
            />
          </View>
        )}

        {sig && (
          <Boton
            titulo={sig.label}
            onPress={avanzar}
            cargando={cargando}
            estilo={esEntrega ? estilos.btnEntregar : undefined}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg, paddingBottom: espacio.xl * 2 },
  numero: { fontSize: 14, color: colors.textoSuave, fontWeight: '700', marginBottom: espacio.md },

  seccion: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.md,
    gap: espacio.xs,
  },
  seccionTit: { fontSize: 12, color: colors.textoSuave, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  seccionTxt: { fontSize: 17, fontWeight: '700', color: colors.texto },
  seccionDir: { fontSize: 14, color: colors.textoSuave, lineHeight: 20 },
  notas: {
    backgroundColor: '#FFF9E6', padding: espacio.sm, borderRadius: radio.sm,
    color: colors.texto, fontSize: 13,
  },

  cobroBox: {
    backgroundColor: colors.primario, padding: espacio.md,
    borderRadius: radio.md, alignItems: 'center', marginBottom: espacio.md,
  },
  cobroLabel: { color: '#FFF', fontSize: 12, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 },
  cobroValor: { color: '#FFF', fontSize: 34, fontWeight: '900', marginVertical: espacio.xs },
  cobroPago:  { color: '#FFF', fontSize: 14, fontWeight: '600' },

  codigoBox: {
    backgroundColor: '#FFF3E8',
    borderWidth: 2, borderColor: colors.primario,
    borderRadius: radio.md, padding: espacio.md,
    marginBottom: espacio.md,
  },
  codigoTitulo: { fontSize: 15, fontWeight: '800', color: colors.primario, marginBottom: espacio.xs },
  codigoDesc: { fontSize: 13, color: colors.textoSuave, lineHeight: 18, marginBottom: espacio.sm },

  btnEntregar: { backgroundColor: colors.exito },
});
