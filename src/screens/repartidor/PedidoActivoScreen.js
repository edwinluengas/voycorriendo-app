import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { repartidoresAPI, pedidosAPI, pagosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import { colors, espacio, radio } from '../../theme/colors';

const SIGUIENTE = {
  confirmado: { estado: 'preparando', label: 'Marcar que estoy en el negocio' },
  preparando: { estado: 'listo',      label: 'Ya lo recogí' },
  listo:      { estado: 'en_camino',  label: 'Ya voy en camino' },
  en_camino:  { estado: 'entregado',  label: 'Entregar pedido' },
};

export default function PedidoActivoScreen({ route, navigation }) {
  const { pedidoId } = route.params;
  const [pedido, setPedido]       = useState(null);
  const [cargando, setCargando]   = useState(false);
  const [montoEfe, setMontoEfe]   = useState('');

  const cargar = async () => {
    const { data } = await pedidosAPI.detalle(pedidoId);
    setPedido(data.data?.pedido);
  };

  useEffect(() => { cargar(); }, [pedidoId]);

  // Tracking de ubicación: envía cada 15s
  useEffect(() => {
    let interval;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const socket = conectarSocket();
      interval = setInterval(async () => {
        const pos = await Location.getCurrentPositionAsync({});
        socket.emit('actualizar_ubicacion', {
          pedido_id: pedidoId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        repartidoresAPI.ubicacion(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      }, 15000);
    })();
    return () => clearInterval(interval);
  }, [pedidoId]);

  const avanzar = async () => {
    const sig = SIGUIENTE[pedido?.estado];
    if (!sig) return;

    // Si es entrega y es efectivo, validar monto
    if (sig.estado === 'entregado' && pedido.metodo_pago === 'efectivo') {
      if (!montoEfe || parseFloat(montoEfe) < parseFloat(pedido.total)) {
        Alert.alert('Efectivo', 'Escribe el monto que recibiste (mayor o igual al total).');
        return;
      }
      try {
        setCargando(true);
        const res = await pagosAPI.efectivo(pedidoId, parseFloat(montoEfe));
        Alert.alert('Cobro registrado', `Cambio a entregar: $${res.data.data.cambio.toFixed(2)}`);
      } catch (e) {
        Alert.alert('Error', e.mensajeAmigable || 'No se pudo registrar el pago.');
        setCargando(false);
        return;
      }
    }

    try {
      setCargando(true);
      await repartidoresAPI.actualizarEstado(pedidoId, sig.estado);
      if (sig.estado === 'entregado') {
        Alert.alert('¡Pedido entregado!', 'Buen trabajo. 🎉');
        navigation.replace('Inicio');
      } else {
        cargar();
      }
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos actualizar el estado.');
    } finally {
      setCargando(false);
    }
  };

  if (!pedido) return null;

  const sig = SIGUIENTE[pedido.estado];

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <Text style={estilos.numero}>{pedido.numero}</Text>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTit}>🏪 Recoger en</Text>
          <Text style={estilos.seccionTxt}>{pedido.negocio?.nombre}</Text>
          <Text style={estilos.seccionDir}>{pedido.negocio?.direccion}</Text>
          <Boton
            titulo="Abrir en Google Maps"
            variante="secundario"
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${pedido.negocio?.latitud},${pedido.negocio?.longitud}`)}
          />
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTit}>🏠 Entregar a</Text>
          <Text style={estilos.seccionTxt}>{pedido.cliente?.nombre}</Text>
          <Text style={estilos.seccionDir}>{pedido.direccion_entrega}</Text>
          {pedido.notas_entrega && <Text style={estilos.notas}>📝 {pedido.notas_entrega}</Text>}
          <Boton
            titulo="Llamar al cliente"
            variante="secundario"
            onPress={() => Linking.openURL(`tel:${pedido.cliente?.telefono}`)}
          />
        </View>

        <View style={estilos.cobroBox}>
          <Text style={estilos.cobroLabel}>Cobrar al cliente</Text>
          <Text style={estilos.cobroValor}>${parseFloat(pedido.total).toFixed(2)} MXN</Text>
          <Text style={estilos.cobroPago}>
            {pedido.metodo_pago === 'efectivo' ? '💵 En efectivo' :
             pedido.pago_estado === 'capturado' ? '✅ Ya pagó en la app' :
             '⏳ Pago pendiente'}
          </Text>
        </View>

        {sig?.estado === 'entregado' && pedido.metodo_pago === 'efectivo' && (
          <Campo
            etiqueta="¿Con cuánto te pagó el cliente?"
            placeholder="Ej. 500"
            keyboardType="numeric"
            value={montoEfe}
            onChangeText={setMontoEfe}
          />
        )}

        {sig && (
          <Boton titulo={sig.label} onPress={avanzar} cargando={cargando} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },
  numero: { fontSize: 14, color: colors.textoSuave, fontWeight: '700', marginBottom: espacio.md },
  seccion: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.md,
  },
  seccionTit: { fontSize: 13, color: colors.textoSuave, fontWeight: '700', marginBottom: espacio.xs },
  seccionTxt: { fontSize: 17, fontWeight: '700', color: colors.texto },
  seccionDir: { fontSize: 14, color: colors.textoSuave, marginTop: 2, marginBottom: espacio.sm },
  notas: {
    backgroundColor: '#FFF9E6', padding: espacio.sm, borderRadius: radio.sm,
    color: colors.texto, fontSize: 13, marginVertical: espacio.sm,
  },
  cobroBox: {
    backgroundColor: colors.primario, padding: espacio.md, borderRadius: radio.md, alignItems: 'center', marginBottom: espacio.md,
  },
  cobroLabel: { color: '#FFF', fontSize: 13, opacity: 0.9 },
  cobroValor: { color: '#FFF', fontSize: 32, fontWeight: '800', marginVertical: espacio.xs },
  cobroPago:  { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
