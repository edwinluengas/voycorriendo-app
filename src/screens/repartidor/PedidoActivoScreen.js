import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Linking, TextInput, Image, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { repartidoresAPI, pedidosAPI, pagosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import MapaSeguimiento from '../../components/MapaSeguimiento';
import useRutaPedido from '../../hooks/useRutaPedido';
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
  const [errorCarga, setErrorCarga]   = useState(false);
  const [montoEfe, setMontoEfe]       = useState('');
  const [codigoEntrega, setCodigo]    = useState('');
  const [codigoError, setCodigoError] = useState(false);
  const [marcandoRecogido, setMarcandoRecogido] = useState(false);
  // Su propia posición, para dibujarse en el mapa del recorrido.
  const [miPos, setMiPos]             = useState(null);
  const [verINE, setVerINE]           = useState(false);
  // Ruta por calles para el mapa (null si Google no esta disponible).
  const rutaPolyline = useRutaPedido(pedidoId, miPos);
  const scrollRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setErrorCarga(false);
      const { data } = await pedidosAPI.detalle(pedidoId);
      if (data.data?.pedido) setPedido(data.data.pedido);
    } catch (_) {
      setErrorCarga(true);
    }
  }, [pedidoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuando el estado llega a en_camino, bajar al área de entrega automáticamente
  useEffect(() => {
    if (pedido?.estado === 'en_camino') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [pedido?.estado]);

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

  // Tracking de ubicación: envía cada 15s mientras hay pedido activo.
  // La misma lectura alimenta su propio mapa (`miPos`), así no hace falta
  // pedir el GPS dos veces. La primera lectura es inmediata: esperar 15s
  // para que aparezca su moto en el mapa se siente como que no funciona.
  useEffect(() => {
    let interval;
    let vivo = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const socket = conectarSocket();

      const reportar = async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          if (!vivo) return;
          setMiPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          socket.emit('actualizar_ubicacion', {
            pedido_id: pedidoId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          repartidoresAPI.ubicacion(pos.coords.latitude, pos.coords.longitude).catch(() => {});
        } catch (_) {}
      };

      await reportar();
      interval = setInterval(reportar, 15000);
    })();
    return () => { vivo = false; clearInterval(interval); };
  }, [pedidoId]);

  // `aceptarPedido` salta directo a estado='en_camino' en el mismo instante
  // de aceptar el pedido — no hay ningún estado intermedio de "voy por él".
  // Este paso marca recogido_en (columna que ya existía sin usarse) para
  // dar una ventana real entre "acepté, voy por el pedido" y "ya lo tengo,
  // salgo a entregar" — es lo que activa el mapa en vivo del NEGOCIO.
  const confirmarRecogido = async () => {
    setMarcandoRecogido(true);
    try {
      await repartidoresAPI.marcarRecogido(pedidoId);
      await cargar();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No se pudo confirmar. Intenta de nuevo.');
    } finally {
      setMarcandoRecogido(false);
    }
  };

  const avanzar = async () => {
    const sig = SIGUIENTE[pedido?.estado];
    if (!sig) return;

    // --- Validaciones antes de "Confirmar entrega" ---
    if (sig.estado === 'entregado') {
      // 1. Cobro en efectivo: validar monto recibido — contra el NETO
      // (total - crédito de plataforma ya aplicado), no el total completo.
      // Si el crédito cubrió el pedido entero, no hay nada que cobrar.
      const netoACobrar = Math.max(0, parseFloat(pedido.total) - parseFloat(pedido.credito_aplicado || 0));
      if (pedido.metodo_pago === 'efectivo' && netoACobrar > 0) {
        const monto = parseFloat(montoEfe);
        if (!montoEfe || isNaN(monto) || monto < netoACobrar) {
          Alert.alert('Efectivo', `El cliente debe pagarte al menos $${netoACobrar.toFixed(2)} MXN.`);
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
        setCodigoError(true);
        scrollRef.current?.scrollToEnd({ animated: true });
        Alert.alert('Código de entrega', 'Pide al cliente el código de 4 dígitos que aparece en su app y escríbelo en la casilla naranja.');
        setCargando(false);
        return;
      }
      setCodigoError(false);

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
      await cargar();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos actualizar el estado.');
    } finally {
      setCargando(false);
    }
  };

  if (errorCarga || (!pedido && !cargando)) {
    return (
      <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
        <View style={estilos.errorBox}>
          <Text style={estilos.errorTxt}>No pudimos cargar el pedido. Revisa tu conexión.</Text>
          <Boton titulo="Reintentar" onPress={cargar} />
          <Boton titulo="Volver" variante="secundario" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }
  if (!pedido) return null;

  const sig = SIGUIENTE[pedido.estado];
  // Ver nota en confirmarRecogido: al aceptar, el pedido ya llega en
  // 'en_camino' — esta bandera local es lo único que distingue "voy por él"
  // de "ya lo llevo, voy a entregar".
  const faltaRecoger = pedido.estado === 'en_camino' && !pedido.recogido_en;
  const esEntrega = sig?.estado === 'entregado' && !faltaRecoger;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets={true}
      >
        <Text style={estilos.numero}>{pedido.numero}</Text>

        {/* Su recorrido de un vistazo: dónde está él, el restaurante donde
            recoge y la casa del cliente. Antes esta pantalla no tenía mapa
            —solo un botón que sacaba a Google Maps— así que el repartidor
            no podía ver de un golpe qué tan lejos le queda cada tramo. */}
        <MapaSeguimiento
          repartidorPos={miPos}
          rutaPolyline={rutaPolyline}
          origen={pedido.negocio?.latitud && pedido.negocio?.longitud
            ? { lat: pedido.negocio.latitud, lng: pedido.negocio.longitud }
            : null}
          destino={pedido.latitud_entrega && pedido.longitud_entrega
            ? { lat: pedido.latitud_entrega, lng: pedido.longitud_entrega }
            : null}
          tituloOrigen={pedido.negocio?.nombre || 'Recoger aquí'}
          tituloDestino="Entregar aquí"
          altura={240}
        />

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

        {/* Verificación de edad. Solo aparece si el pedido lleva algo
            restringido: el backend manda la foto únicamente en ese caso y
            mientras el pedido esté en curso. El repartidor es quien entrega,
            así que es quien tiene que comparar la cara con el documento. */}
        {!!pedido.ine_foto_url && (
          <View style={[estilos.seccion, { borderColor: '#E5484D', borderWidth: 2 }]}>
            <Text style={[estilos.seccionTit, { color: '#E5484D' }]}>🔞 Verifica la edad antes de entregar</Text>
            <Text style={estilos.seccionDir}>
              Este pedido lleva producto con restricción de edad. Compara esta identificación
              con la persona que recibe. Si no coincide o es menor de edad, NO entregues.
            </Text>
            <Pressable onPress={() => setVerINE(true)}>
              <Image
                source={{ uri: pedido.ine_foto_url }}
                style={{ width: '100%', height: 200, borderRadius: radio.md, marginTop: espacio.sm }}
                resizeMode="contain"
              />
              <Text style={[estilos.seccionDir, { textAlign: 'center', marginTop: 6 }]}>
                Toca para verla en grande
              </Text>
            </Pressable>
          </View>
        )}

        {/* Entregar a */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTit}>🏠 Entregar a</Text>
          <Text style={estilos.seccionTxt}>{pedido.cliente?.nombre}</Text>
          <Text style={estilos.seccionDir}>{pedido.direccion_entrega}</Text>
          {!!pedido.notas_entrega && (
            <Text style={estilos.notas}>📝 {pedido.notas_entrega}</Text>
          )}
          {/* El tramo largo es este y no tenía botón de navegación: solo el
              restaurante lo traía. Sin esto había que copiar la dirección
              a mano en Google Maps a media entrega. */}
          {!!pedido.latitud_entrega && !!pedido.longitud_entrega && (
            <Boton
              titulo="Abrir en Google Maps"
              variante="secundario"
              onPress={() =>
                Linking.openURL(`https://maps.google.com/?q=${pedido.latitud_entrega},${pedido.longitud_entrega}`)
              }
            />
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

        {/* Cobro — si el cliente usó crédito de plataforma, lo que hay que
            cobrarle EN MANO es el neto (total - crédito), no el total
            completo: ese pedazo ya lo cubrió el crédito, no es dinero que
            el repartidor deba recibir. */}
        {(() => {
          const creditoAplicado = parseFloat(pedido.credito_aplicado || 0);
          const netoACobrar = Math.max(0, parseFloat(pedido.total) - creditoAplicado);
          return (
            <View style={estilos.cobroBox}>
              <Text style={estilos.cobroLabel}>Cobrar al cliente</Text>
              <Text style={estilos.cobroValor}>${netoACobrar.toFixed(2)} MXN</Text>
              {creditoAplicado > 0 && (
                <Text style={estilos.cobroCredito}>
                  🎁 ${creditoAplicado.toFixed(2)} ya cubiertos con crédito de la app (total del pedido: ${parseFloat(pedido.total).toFixed(2)})
                </Text>
              )}
              <Text style={estilos.cobroPago}>
                {pedido.metodo_pago === 'efectivo'
                  ? (netoACobrar > 0 ? '💵 En efectivo' : '✅ Cubierto 100% con crédito — no cobres nada')
                  : pedido.pago_estado === 'capturado' ? '✅ Ya pagó en la app' :
                    '⏳ Pago digital pendiente'}
              </Text>
            </View>
          );
        })()}

        {/* Monto en efectivo — solo al entregar */}
        {esEntrega && pedido.metodo_pago === 'efectivo' && Math.max(0, parseFloat(pedido.total) - parseFloat(pedido.credito_aplicado || 0)) > 0 && (
          <Campo
            etiqueta="¿Con cuánto te pagó el cliente?"
            placeholder={`Ej. $${Math.ceil((parseFloat(pedido.total) - parseFloat(pedido.credito_aplicado || 0)) / 50) * 50}`}
            keyboardType="numeric"
            value={montoEfe}
            onChangeText={setMontoEfe}
            maxLength={6}
          />
        )}

        {/* Código de entrega — obligatorio al confirmar entrega */}
        {esEntrega && (
          <View style={[estilos.codigoBox, codigoError && estilos.codigoBoxError]}>
            <View style={estilos.codigoHeader}>
              <Text style={estilos.codigoTitulo}>🔑 Paso final: Código del cliente</Text>
              {codigoEntrega.length === 4 && (
                <Text style={estilos.codigoOk}>✅ Listo</Text>
              )}
            </View>
            <Text style={estilos.codigoDesc}>
              Pide al cliente que abra su app — verá un código de 4 dígitos en pantalla. Escríbelo aquí para confirmar la entrega.
            </Text>
            {/* Campo grande dedicado — solo presentación, la validación del
                código (obligatorio, coincidencia) sigue intacta en backend
                y en el handler de "Confirmar entrega". */}
            <TextInput
              style={[estilos.codigoInputGrande, codigoError && estilos.codigoInputGrandeError]}
              placeholder="— — — —"
              placeholderTextColor="#D1D5DB"
              keyboardType="number-pad"
              value={codigoEntrega}
              onChangeText={(v) => { setCodigo(v.replace(/\D/g, '').slice(0, 4)); setCodigoError(false); }}
              maxLength={4}
            />
            {codigoError && (
              <Text style={estilos.codigoErrorTxt}>⚠️ Ingresa el código antes de confirmar</Text>
            )}
          </View>
        )}

        {faltaRecoger ? (
          <Boton
            titulo="📦 Ya recogí el pedido"
            onPress={confirmarRecogido}
            cargando={marcandoRecogido}
          />
        ) : sig && (
          <Boton
            titulo={sig.label}
            onPress={avanzar}
            cargando={cargando}
            estilo={esEntrega ? estilos.btnEntregar : undefined}
          />
        )}
      </ScrollView>

      {/* Visor a pantalla completa: una INE en 200 px no se lee, y aquí de eso
          depende decidir si se entrega o no. */}
      <Modal visible={verINE} transparent animationType="fade" onRequestClose={() => setVerINE(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}
          onPress={() => setVerINE(false)}
        >
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          >
            <Image
              source={{ uri: pedido?.ine_foto_url }}
              style={{ width: '100%', height: 500 }}
              resizeMode="contain"
            />
          </ScrollView>
          <Text style={{ color: '#FFF', textAlign: 'center', padding: espacio.md }}>
            Toca para cerrar
          </Text>
        </Pressable>
      </Modal>
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
  cobroCredito: { color: '#FFF', fontSize: 12, opacity: 0.85, textAlign: 'center', marginBottom: espacio.xs },

  codigoBox: {
    backgroundColor: '#FFF3E8',
    borderWidth: 2, borderColor: colors.primario,
    borderRadius: radio.md, padding: espacio.md,
    marginBottom: espacio.md,
  },
  codigoBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  codigoHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: espacio.xs,
  },
  codigoTitulo: { fontSize: 16, fontWeight: '900', color: colors.primario },
  codigoOk: { fontSize: 13, fontWeight: '800', color: '#16A34A' },
  codigoInputGrande: {
    height: 76,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: colors.primario, borderRadius: radio.md,
    fontSize: 40, fontWeight: '900', color: colors.texto,
    textAlign: 'center', letterSpacing: 16,
    marginTop: espacio.sm,
  },
  codigoInputGrandeError: { borderColor: colors.error, backgroundColor: '#FEF2F2' },
  codigoDesc: { fontSize: 13, color: colors.textoSuave, lineHeight: 18, marginBottom: espacio.sm },
  codigoErrorTxt: { fontSize: 13, color: '#DC2626', fontWeight: '700', marginTop: espacio.xs },

  btnEntregar: { backgroundColor: colors.exito },

  errorBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: espacio.xl, gap: espacio.md,
  },
  errorTxt: { fontSize: 15, color: colors.textoSuave, textAlign: 'center', marginBottom: espacio.sm },
});
