/**
 * PedidoDetalleNegocioScreen
 * --------------------------
 * Vista de detalle para el dueño del negocio:
 * - Datos del cliente y dirección
 * - Ítems con opcion_elegida, notas y badge de edad
 * - Visor de foto del INE (si algún producto la requiere)
 * - Botones de acción según el estado actual:
 *     pendiente   → [Aceptar] / [Rechazar]
 *     confirmado  → [Empezar a preparar]
 *     preparando  → [Marcar listo]
 *     listo/+     → solo lectura
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert, Linking, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { pedidosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import MapaSeguimiento from '../../components/MapaSeguimiento';
import useRutaPedido from '../../hooks/useRutaPedido';
import { colors, espacio, radio } from '../../theme/colors';

const METODO_PAGO_TXT = {
  efectivo:      '💵 Efectivo',
  tarjeta:       '💳 Tarjeta',
  transferencia: '🏦 Transferencia',
  mercado_pago:  '💙 Mercado Pago',
};

const ETIQUETA_ESTADO = {
  pendiente:   { texto: 'Nuevo pedido',        color: colors.advertencia, emoji: '🆕' },
  confirmado:  { texto: 'Confirmado',          color: colors.secundario,  emoji: '✅' },
  preparando:  { texto: 'Preparando',          color: colors.primario,    emoji: '🍳' },
  listo:       { texto: 'Listo para enviar',   color: colors.exito,       emoji: '📦' },
  en_camino:   { texto: 'En camino',           color: colors.secundario,  emoji: '🛵' },
  en_envio:    { texto: 'Enviado 🚚',          color: colors.secundario,  emoji: '🚚' },
  entregado:   { texto: 'Entregado',           color: colors.textoSuave,  emoji: '🎉' },
  cancelado:   { texto: 'Cancelado',           color: colors.error,       emoji: '❌' },
  rechazado:   { texto: 'Rechazado',           color: colors.error,       emoji: '🚫' },
};

export default function PedidoDetalleNegocioScreen({ route, navigation }) {
  const { pedidoId } = route.params || {};
  const [pedido, setPedido]         = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [enviando, setEnviando]     = useState(false);
  const [mostrarINE, setMostrarINE] = useState(false);
  const [modalGuia, setModalGuia]   = useState(false);
  const [guia, setGuia]             = useState('');
  // Entrega de pedidos para recoger (pickup): código que muestra el cliente
  const [modalCodigo, setModalCodigo]     = useState(false);
  const [codigoEntrega, setCodigoEntrega] = useState('');
  const [errorCodigo, setErrorCodigo]     = useState('');
  const [repartidorPos, setRepartidorPos] = useState(null);
  // Ruta por calles para el mapa (null si Google no esta disponible).
  const rutaPolyline = useRutaPedido(pedidoId, repartidorPos, !!pedido?.repartidor);

  const cargar = useCallback(async () => {
    try {
      const { data } = await pedidosAPI.detalle(pedidoId);
      const p = data.data?.pedido || null;
      setPedido(p);
      // Última ubicación conocida en DB — mientras llega el primer evento
      // en vivo del socket, mejor mostrar algo aproximado que nada.
      if (p?.repartidor?.latitud && p?.repartidor?.longitud) {
        setRepartidorPos((actual) => actual || { lat: parseFloat(p.repartidor.latitud), lng: parseFloat(p.repartidor.longitud) });
      }
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos cargar el pedido.');
    } finally {
      setCargando(false);
    }
  }, [pedidoId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Ubicación en vivo del repartidor asignado — mientras va por el pedido.
  // Misma sala 'pedido:<id>' que usa el cliente; el backend valida ownership
  // por el lado del negocio (esNegocio) antes de dejar entrar al socket.
  useEffect(() => {
    const socket = conectarSocket();
    socket.emit('unirse_pedido', pedidoId);
    const onUbicacion = (data) => {
      if (data?.lat === undefined || data?.lng === undefined) return;
      setRepartidorPos({ lat: data.lat, lng: data.lng });
    };
    const onEstado = (data) => {
      if (data?.pedido_id !== pedidoId) return;
      setPedido((p) => (p ? { ...p, estado: data.estado } : p));
    };
    // El repartidor marca "ya recogí el pedido" (ver PedidoActivoScreen) —
    // el mapa de "viene por tu pedido" debe ocultarse solo, sin esperar a
    // que el negocio salga y vuelva a entrar a la pantalla.
    const onRecogido = (data) => {
      if (data?.pedido_id !== pedidoId) return;
      setPedido((p) => (p ? { ...p, recogido_en: new Date().toISOString() } : p));
    };
    socket.on('ubicacion_repartidor', onUbicacion);
    socket.on('estado_pedido', onEstado);
    socket.on('pedido_recogido', onRecogido);
    return () => {
      socket.off('ubicacion_repartidor', onUbicacion);
      socket.off('estado_pedido', onEstado);
      socket.off('pedido_recogido', onRecogido);
    };
  }, [pedidoId]);

  const cambiarEstado = async (nuevoEstado, nota) => {
    if (enviando) return;
    setEnviando(true);
    try {
      await pedidosAPI.actualizarEstado(pedidoId, nuevoEstado, nota);
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo actualizar', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarAccion = (titulo, mensaje, nuevoEstado, destructivo = false) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: destructivo ? 'Sí, rechazar' : 'Sí, continuar',
        style: destructivo ? 'destructive' : 'default',
        onPress: () => cambiarEstado(nuevoEstado),
      },
    ]);
  };

  // ── Entregar un pedido PICKUP ──
  // El cliente pasa por su pedido y muestra su código de 4 dígitos. Sin ese
  // código el pedido NO se cierra: es la única prueba de que se le entregó a
  // quien lo hizo y no a cualquiera que dio un nombre. El negocio nunca ve el
  // código en su pantalla (el servidor se lo oculta) — tiene que pedírselo.
  const entregarPickup = async () => {
    const codigo = codigoEntrega.trim();
    if (codigo.length !== 4) {
      setErrorCodigo('El código son 4 dígitos. Pídeselo al cliente.');
      return;
    }
    setEnviando(true);
    setErrorCodigo('');
    try {
      await pedidosAPI.actualizarEstado(pedidoId, 'entregado', null, { codigo_entrega: codigo });
      setModalCodigo(false);
      setCodigoEntrega('');
      await cargar();
    } catch (e) {
      // El error del servidor se muestra DENTRO del modal, no en un alert que
      // lo cierre: el negocio tiene al cliente enfrente y necesita reintentar
      // sin volver a empezar.
      setErrorCodigo(e.mensajeAmigable || 'No se pudo confirmar la entrega.');
    } finally {
      setEnviando(false);
    }
  };

  const marcarEnviado = async () => {
    setModalGuia(false);
    setEnviando(true);
    try {
      await pedidosAPI.actualizarEstado(pedidoId, 'en_envio', null, { numero_guia: guia.trim() || null });
      setGuia('');
      await cargar();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No se pudo actualizar el pedido.');
    } finally {
      setEnviando(false);
    }
  };

  const llamarCliente = () => {
    const tel = pedido?.cliente?.telefono;
    if (!tel) return;
    Linking.openURL(`tel:${tel}`).catch(() => {});
  };

  const whatsappCliente = () => {
    const tel = pedido?.cliente?.telefono;
    if (!tel) return;
    const num = `52${tel.replace(/\D/g, '')}`;
    const msg = encodeURIComponent(
      `Hola ${pedido.cliente?.nombre || ''}, soy de Tienda VoyCorriendo 🛍️\n` +
      `Recibimos tu pedido #${pedido.numero}.\n` +
      `Te escribimos para darte seguimiento personalizado y coordinar tu envío.`
    );
    Linking.openURL(`whatsapp://send?phone=${num}&text=${msg}`)
      .catch(() => Linking.openURL(`https://wa.me/${num}?text=${msg}`));
  };

  if (cargando || !pedido) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  const et = ETIQUETA_ESTADO[pedido.estado] || { texto: pedido.estado, color: colors.textoSuave, emoji: '•' };
  const hayINE = !!pedido.ine_foto_url;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xl * 2 }}>
        {/* Encabezado */}
        <View style={estilos.header}>
          <Text style={estilos.numero}>#{pedido.numero}</Text>
          <View style={[estilos.pill, { backgroundColor: et.color + '22', borderColor: et.color }]}>
            <Text style={[estilos.pillTxt, { color: et.color }]}>
              {et.emoji} {et.texto}
            </Text>
          </View>
        </View>

        {/* Cliente */}
        <Seccion titulo="Cliente">
          <Text style={estilos.nombre}>👤 {pedido.cliente?.nombre || 'Cliente'}</Text>
          {pedido.cliente?.telefono && (
            <View style={estilos.contactoFila}>
              <Pressable onPress={llamarCliente} style={estilos.contactoBtn}>
                <Text style={estilos.contactoBtnTxt}>📞 Llamar</Text>
              </Pressable>
              <Pressable onPress={whatsappCliente} style={[estilos.contactoBtn, estilos.contactoBtnWA]}>
                <Text style={[estilos.contactoBtnTxt, { color: '#FFF' }]}>💬 WhatsApp</Text>
              </Pressable>
            </View>
          )}
          <Text style={estilos.direccion}>📍 {pedido.direccion_entrega}</Text>
          {(pedido.zona || pedido.distancia_km != null) && (
            <Text style={estilos.zonaChip}>
              {pedido.zona ? `🗺️ Zona ${pedido.zona}` : ''}
              {pedido.distancia_km != null
                ? `  ·  ${Number(pedido.distancia_km).toFixed(1)} km`
                : ''}
            </Text>
          )}
          {pedido.notas_entrega ? (
            <Text style={estilos.notasEntrega}>📝 {pedido.notas_entrega}</Text>
          ) : null}
        </Seccion>

        {/* Número de guía si ya fue enviado */}
        {pedido.numero_guia && (
          <Seccion titulo="📦 Número de guía">
            <Text style={estilos.guiaTxt}>{pedido.numero_guia}</Text>
          </Seccion>
        )}

        {/* INE si aplica */}
        {hayINE && (
          <Seccion titulo="🔞 Verificación de edad (INE)">
            <Text style={estilos.avisoINE}>
              Este pedido incluye productos con restricción de edad. Verifica que la foto
              corresponda al cliente antes de entregar.
            </Text>
            <Pressable onPress={() => setMostrarINE(true)}>
              <Image source={{ uri: pedido.ine_foto_url }} style={estilos.ineMini} resizeMode="cover" />
              <Text style={estilos.verINE}>Toca la imagen para ver en grande</Text>
            </Pressable>
          </Seccion>
        )}

        {/* Ítems */}
        <Seccion titulo={`Productos (${pedido.items?.length || 0})`}>
          {(pedido.items || []).map((it, idx) => (
            <View key={`${it.producto_id}-${idx}`} style={estilos.item}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.itemNombre}>
                  {it.cantidad}× {it.nombre}
                </Text>
                {it.opcion_elegida && (
                  <Text style={estilos.itemOpcion}>🏷️ {it.opcion_elegida}</Text>
                )}
                {it.notas && (
                  <Text style={estilos.itemNotas}>📝 {it.notas}</Text>
                )}
                {it.requiere_id && (
                  <View style={estilos.edadPill}>
                    <Text style={estilos.edadTxt}>🔞 Requiere INE</Text>
                  </View>
                )}
              </View>
              <Text style={estilos.itemPrecio}>${parseFloat(it.subtotal).toFixed(2)}</Text>
            </View>
          ))}
        </Seccion>

        {/* Aviso de seguridad: entregar sellado al repartidor */}
        {['confirmado', 'preparando', 'listo'].includes(pedido.estado) && (
          <View style={estilos.selladoAviso}>
            <Text style={estilos.selladoAvisoEmoji}>🔒</Text>
            <Text style={estilos.selladoAvisoTxt}>
              Por seguridad, entrega el pedido <Text style={{ fontWeight: '800' }}>sellado</Text> al repartidor
              (bolsa cerrada, cinta o sticker de seguridad). No lo entregues abierto.
            </Text>
          </View>
        )}

        {/* Totales y pago */}
        <Seccion titulo="Pago">
          <FilaMonto etiqueta="Subtotal"       monto={pedido.subtotal} />
          <FilaMonto etiqueta="Costo de envío" monto={pedido.costo_envio} />
          {parseFloat(pedido.descuento) > 0 && (
            <FilaMonto etiqueta="Descuento" monto={-pedido.descuento} />
          )}
          <View style={estilos.totalFila}>
            <Text style={estilos.totalLabel}>Total</Text>
            <Text style={estilos.totalMonto}>${parseFloat(pedido.total).toFixed(2)}</Text>
          </View>
          <Text style={estilos.metodo}>
            Método: {METODO_PAGO_TXT[pedido.metodo_pago] || pedido.metodo_pago}
          </Text>
          {pedido.metodo_pago === 'efectivo' && (
            <Text style={estilos.efectivoAviso}>
              💵 El cliente pagará en efectivo al repartidor. Entrega con confianza.
            </Text>
          )}
        </Seccion>

        {/* Económico: lo que el negocio recibe neto */}
        {parseFloat(pedido.comision_negocio) > 0 && (
          <Seccion titulo="💰 Resumen económico">
            <FilaMonto etiqueta="Subtotal (productos)" monto={pedido.subtotal} />
            <FilaMonto
              etiqueta={`Comisión VoyCorriendo`}
              monto={-parseFloat(pedido.comision_negocio)}
            />
            <View style={estilos.totalFila}>
              <Text style={estilos.totalLabel}>Tú recibes</Text>
              <Text style={estilos.totalMontoExito}>
                ${(parseFloat(pedido.subtotal) - parseFloat(pedido.comision_negocio)).toFixed(2)}
              </Text>
            </View>
            <Text style={estilos.efectivoAviso}>
              El costo de envío (${parseFloat(pedido.costo_envio).toFixed(2)}) lo cobra VoyCorriendo al cliente
              y se usa para pagar al repartidor.
            </Text>
          </Seccion>
        )}

        {/* Mapa en vivo — repartidor asignado, viene por el pedido (aún no
            marca "ya recogí"; ver recogido_en). El backend salta el
            `estado` del pedido a 'en_camino' desde el instante mismo de
            aceptar, así que NO sirve para distinguir esta ventana — el
            gate real es recogido_en. Destino = ubicación del negocio. */}
        {pedido.repartidor
          && !['entregado', 'cancelado', 'rechazado'].includes(pedido.estado)
          && pedido.negocio?.latitud && pedido.negocio?.longitud && (
          <MapaSeguimiento
            repartidorPos={repartidorPos}
            rutaPolyline={rutaPolyline}
            origen={{ lat: pedido.negocio.latitud, lng: pedido.negocio.longitud }}
            destino={pedido.latitud_entrega && pedido.longitud_entrega
              ? { lat: pedido.latitud_entrega, lng: pedido.longitud_entrega }
              : null}
            tituloOrigen="Tu negocio"
            tituloDestino="Entrega al cliente"
          />
        )}

        {/* Repartidor si ya se asignó — foto + placa para verificar en la entrega */}
        {(pedido.repartidor?.usuario || pedido.repartidor_nombre_snapshot) && (
          <Seccion titulo="Repartidor">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!!(pedido.repartidor_foto_snapshot || pedido.repartidor?.usuario?.foto_perfil) && (
                <Image
                  source={{ uri: pedido.repartidor_foto_snapshot || pedido.repartidor.usuario.foto_perfil }}
                  style={estilos.repartidorFoto}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={estilos.nombre}>
                  🛵 {pedido.repartidor_nombre_snapshot || pedido.repartidor?.usuario?.nombre}
                </Text>
                {pedido.repartidor?.usuario?.telefono && (
                  <Text style={estilos.direccion}>📞 {pedido.repartidor.usuario.telefono}</Text>
                )}
                {!!pedido.repartidor_placa_snapshot && (
                  <Text style={estilos.direccion}>🪪 Placa: {pedido.repartidor_placa_snapshot}</Text>
                )}
              </View>
            </View>
          </Seccion>
        )}
      </ScrollView>

      {/* Botones de acción */}
      <BarraAcciones
        estado={pedido.estado}
        enviando={enviando}
        esPaqueteria={pedido.negocio?.tipo_entrega === 'paqueteria'}
        esPickup={pedido.tipo_envio === 'pickup'}
        onEntregarPickup={() => { setErrorCodigo(''); setCodigoEntrega(''); setModalCodigo(true); }}
        onAceptar={() => confirmarAccion(
          'Aceptar pedido',
          `¿Aceptas el pedido #${pedido.numero}? El cliente será notificado.`,
          'confirmado'
        )}
        onRechazar={() => confirmarAccion(
          'Rechazar pedido',
          `¿Seguro que deseas rechazar #${pedido.numero}? El cliente recibirá su reembolso si pagó en línea.`,
          'rechazado',
          true
        )}
        onPreparando={() => cambiarEstado('preparando')}
        onListo={() => cambiarEstado('listo')}
        onMarcarEnviado={() => setModalGuia(true)}
        onConfirmarEntrega={() => confirmarAccion(
          'Confirmar entrega',
          `¿Confirmas que el pedido #${pedido.numero} fue entregado al cliente?`,
          'entregado'
        )}
      />

      {/* Entrega de un pedido para RECOGER: el cliente muestra su código */}
      <Modal visible={modalCodigo} transparent animationType="slide" onRequestClose={() => setModalCodigo(false)}>
        <KeyboardAvoidingView
          style={estilos.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={estilos.modalCaja}>
            <View style={estilos.codigoIconoCaja}>
              <Ionicons name="bag-check" size={26} color={colors.secundario} />
            </View>
            <Text style={estilos.modalTitulo}>Entregar al cliente</Text>
            <Text style={estilos.modalSub}>
              Pídele su código de 4 dígitos — lo tiene en su app. Sin él el pedido no se cierra.
            </Text>

            <TextInput
              style={[estilos.codigoInput, !!errorCodigo && estilos.codigoInputError]}
              placeholder="0000"
              placeholderTextColor={colors.bordeOscuro}
              keyboardType="number-pad"
              maxLength={4}
              value={codigoEntrega}
              onChangeText={(v) => { setCodigoEntrega(v.replace(/\D/g, '')); setErrorCodigo(''); }}
              autoFocus
              onSubmitEditing={entregarPickup}
            />
            {!!errorCodigo && <Text style={estilos.codigoError}>{errorCodigo}</Text>}

            <View style={{ flexDirection: 'row', gap: espacio.sm, marginTop: espacio.md }}>
              <Pressable
                style={[estilos.btnModal, { flex: 1, backgroundColor: colors.fondo, borderWidth: 1, borderColor: colors.borde }]}
                onPress={() => { setModalCodigo(false); setCodigoEntrega(''); setErrorCodigo(''); }}
              >
                <Text style={{ fontWeight: '700', color: colors.texto }}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[estilos.btnModal, { flex: 2, backgroundColor: colors.secundario },
                  codigoEntrega.length !== 4 && { opacity: 0.5 }]}
                onPress={entregarPickup}
                disabled={enviando || codigoEntrega.length !== 4}
              >
                <Text style={{ color: '#FFF', fontWeight: '800' }}>
                  {enviando ? 'Confirmando…' : 'Confirmar entrega'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para ingresar número de guía */}
      <Modal visible={modalGuia} transparent animationType="slide">
        <KeyboardAvoidingView
          style={estilos.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={estilos.modalCaja}>
            <Text style={estilos.modalTitulo}>📦 Marcar como enviado</Text>
            <Text style={estilos.modalSub}>Agrega el número de guía (opcional)</Text>
            <TextInput
              style={estilos.guiaInput}
              placeholder="Ej. 1Z999AA10123456784"
              value={guia}
              onChangeText={setGuia}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: espacio.sm, marginTop: espacio.md }}>
              <Pressable
                style={[estilos.btnModal, { flex: 1, backgroundColor: colors.fondo, borderWidth: 1, borderColor: colors.borde }]}
                onPress={() => { setModalGuia(false); setGuia(''); }}
              >
                <Text style={{ fontWeight: '700', color: colors.texto }}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[estilos.btnModal, { flex: 2, backgroundColor: colors.primario }]}
                onPress={marcarEnviado}
                disabled={enviando}
              >
                <Text style={{ color: '#FFF', fontWeight: '800' }}>
                  {enviando ? 'Enviando…' : '🚚 Confirmar envío'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de foto INE en grande */}
      <Modal visible={mostrarINE} transparent animationType="fade" onRequestClose={() => setMostrarINE(false)}>
        <Pressable style={estilos.modalFondo} onPress={() => setMostrarINE(false)}>
          <Image source={{ uri: pedido.ine_foto_url }} style={estilos.ineGrande} resizeMode="contain" />
          <Text style={estilos.cerrarModal}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Seccion({ titulo, children }) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>{titulo}</Text>
      <View>{children}</View>
    </View>
  );
}

function FilaMonto({ etiqueta, monto }) {
  const signo = monto < 0 ? '-' : '';
  return (
    <View style={estilos.montoFila}>
      <Text style={estilos.montoLabel}>{etiqueta}</Text>
      <Text style={estilos.montoValor}>{signo}${Math.abs(parseFloat(monto)).toFixed(2)}</Text>
    </View>
  );
}

function BarraAcciones({ estado, enviando, esPaqueteria, esPickup, onAceptar, onRechazar, onPreparando, onListo, onMarcarEnviado, onConfirmarEntrega, onEntregarPickup }) {
  if (estado === 'pendiente') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnRechazar]} disabled={enviando} onPress={onRechazar}>
          <Text style={estilos.btnRechazarTxt}>🚫 Rechazar</Text>
        </Pressable>
        <Pressable style={[estilos.btn, estilos.btnAceptar]} disabled={enviando} onPress={onAceptar}>
          <Text style={estilos.btnAceptarTxt}>{enviando ? 'Enviando…' : '✅ Aceptar'}</Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'confirmado') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1 }]} disabled={enviando} onPress={onPreparando}>
          <Text style={estilos.btnAceptarTxt}>{enviando ? 'Actualizando…' : '🍳 Empezar a preparar'}</Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'preparando') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1 }]} disabled={enviando} onPress={onListo}>
          <Text style={estilos.btnAceptarTxt}>{enviando ? 'Actualizando…' : '📦 Listo para enviar'}</Text>
        </Pressable>
      </View>
    );
  }
  // PICKUP listo: el cliente viene por él. Es el ÚNICO camino para cerrarlo,
  // y exige su código — sin esto el pedido se quedaba atorado en "listo"
  // para siempre porque esta barra no mostraba ninguna acción.
  if (estado === 'listo' && esPickup) {
    return (
      <View style={estilos.barra}>
        <Pressable
          style={[estilos.btn, estilos.btnAceptar, { flex: 1, backgroundColor: colors.secundario }]}
          disabled={enviando}
          onPress={onEntregarPickup}
        >
          <Ionicons name="bag-check-outline" size={18} color="#FFF" />
          <Text style={estilos.btnAceptarTxt}>
            {enviando ? 'Actualizando…' : 'Entregar al cliente'}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'listo' && esPaqueteria) {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1 }]} disabled={enviando} onPress={onMarcarEnviado}>
          <Ionicons name="cube-outline" size={18} color="#FFF" />
          <Text style={estilos.btnAceptarTxt}>{enviando ? 'Actualizando…' : 'Marcar como enviado'}</Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'en_envio' && esPaqueteria) {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1, backgroundColor: colors.exito }]} disabled={enviando} onPress={onConfirmarEntrega}>
          <Text style={estilos.btnAceptarTxt}>{enviando ? 'Actualizando…' : '✅ Confirmar entregado'}</Text>
        </Pressable>
      </View>
    );
  }
  return null;
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  header:     {
    backgroundColor: colors.superficie, paddingHorizontal: espacio.lg, paddingVertical: espacio.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  numero:     { fontSize: 18, fontWeight: '800', color: colors.texto },
  pill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.full, borderWidth: 1 },
  pillTxt:    { fontSize: 12, fontWeight: '700' },

  seccion:    {
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginTop: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
  },
  seccionTitulo: { fontSize: 14, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm, textTransform: 'uppercase' },

  nombre:     { fontSize: 16, fontWeight: '700', color: colors.texto },
  repartidorFoto: { width: 48, height: 48, borderRadius: 24, marginRight: espacio.sm, backgroundColor: colors.borde },
  contactoFila: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.sm },
  contactoBtn: {
    flex: 1, paddingVertical: espacio.sm, borderRadius: radio.md,
    alignItems: 'center', backgroundColor: '#F0FDF4',
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  contactoBtnWA: { backgroundColor: '#25D366', borderColor: '#25D366' },
  contactoBtnTxt: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  direccion:  { fontSize: 14, color: colors.texto, marginTop: espacio.xs },
  notasEntrega: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs, fontStyle: 'italic' },

  avisoINE:   { fontSize: 13, color: '#991B1B', marginBottom: espacio.sm, lineHeight: 18 },
  ineMini:    { width: '100%', height: 180, borderRadius: radio.md, backgroundColor: colors.borde },
  verINE:     { fontSize: 12, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },

  item:       {
    flexDirection: 'row', paddingVertical: espacio.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  itemNombre: { fontSize: 15, fontWeight: '600', color: colors.texto },
  itemOpcion: { fontSize: 13, color: colors.secundario, marginTop: 2 },
  itemNotas:  { fontSize: 13, color: colors.textoSuave, marginTop: 2, fontStyle: 'italic' },
  itemPrecio: { fontSize: 15, fontWeight: '700', color: colors.texto, marginLeft: espacio.sm },
  edadPill:   { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radio.full, alignSelf: 'flex-start', marginTop: 4 },
  edadTxt:    { fontSize: 10, color: '#991B1B', fontWeight: '700' },

  montoFila:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  montoLabel: { fontSize: 14, color: colors.textoSuave },
  montoValor: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  totalFila:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: espacio.sm, marginTop: espacio.sm,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.texto },
  totalMonto: { fontSize: 20, fontWeight: '800', color: colors.primario },
  totalMontoExito: { fontSize: 20, fontWeight: '800', color: colors.exito },
  zonaChip:   { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs, fontWeight: '600' },
  metodo:     { fontSize: 14, color: colors.texto, marginTop: espacio.sm, fontWeight: '600' },
  efectivoAviso: { fontSize: 12, color: colors.textoSuave, marginTop: espacio.xs, lineHeight: 16 },

  selladoAviso: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: '#FFF9E6', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: radio.md, padding: espacio.md,
    marginHorizontal: espacio.lg, marginTop: espacio.sm, marginBottom: espacio.md,
  },
  selladoAvisoEmoji: { fontSize: 22 },
  selladoAvisoTxt: { flex: 1, fontSize: 12.5, color: '#78350F', lineHeight: 18, fontWeight: '600' },

  barra:      {
    flexDirection: 'row', gap: espacio.sm,
    padding: espacio.md, backgroundColor: colors.superficie,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
  // flexDirection/gap: los botones ahora llevan icono + texto en línea
  btn: {
    flex: 1, paddingVertical: espacio.md, borderRadius: radio.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.xs,
  },
  btnAceptar: { backgroundColor: colors.primario },
  btnAceptarTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  btnRechazar:{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: colors.error },
  btnRechazarTxt: { color: colors.error, fontSize: 16, fontWeight: '800' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: espacio.md },
  ineGrande:  { width: '100%', height: '80%' },
  cerrarModal:{ color: '#FFF', marginTop: espacio.md, fontSize: 14 },

  guiaTxt: { fontSize: 16, fontWeight: '700', color: colors.primario, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: espacio.lg,
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  modalSub:    { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.md },
  guiaInput: {
    borderWidth: 1, borderColor: colors.borde, borderRadius: radio.md,
    paddingHorizontal: espacio.md, paddingVertical: espacio.sm,
    fontSize: 15, color: colors.texto, backgroundColor: colors.fondo,
  },
  btnModal: { paddingVertical: 14, borderRadius: radio.md, alignItems: 'center' },

  // ── Entrega de pickup ──
  // El código es el protagonista del modal: cifras grandes y separadas para
  // que se lea de un vistazo mientras el cliente lo dicta en el mostrador.
  codigoIconoCaja: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: espacio.sm,
  },
  codigoInput: {
    borderWidth: 1.5, borderColor: colors.borde, borderRadius: radio.md,
    backgroundColor: colors.fondo,
    paddingVertical: espacio.sm,
    marginTop: espacio.md,
    fontSize: 34, fontWeight: '900', letterSpacing: 14,
    textAlign: 'center', color: colors.texto,
    fontVariant: ['tabular-nums'],
  },
  codigoInputError: { borderColor: colors.error, backgroundColor: '#FEF2F2' },
  codigoError: {
    marginTop: espacio.xs, fontSize: 13, color: colors.error,
    textAlign: 'center', lineHeight: 18,
  },
});
