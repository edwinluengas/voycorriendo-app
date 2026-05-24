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
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { pedidosAPI } from '../../api/client';
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
  listo:       { texto: 'Listo para recoger',  color: colors.exito,       emoji: '📦' },
  en_camino:   { texto: 'En camino',           color: colors.secundario,  emoji: '🛵' },
  entregado:   { texto: 'Entregado',           color: colors.textoSuave,  emoji: '🎉' },
  cancelado:   { texto: 'Cancelado',           color: colors.error,       emoji: '❌' },
  rechazado:   { texto: 'Rechazado',           color: colors.error,       emoji: '🚫' },
};

export default function PedidoDetalleNegocioScreen({ route, navigation }) {
  const { pedidoId } = route.params || {};
  const [pedido, setPedido]       = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [enviando, setEnviando]   = useState(false);
  const [mostrarINE, setMostrarINE] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await pedidosAPI.detalle(pedidoId);
      setPedido(data.data?.pedido || null);
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos cargar el pedido.');
    } finally {
      setCargando(false);
    }
  }, [pedidoId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

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

  const llamarCliente = () => {
    const tel = pedido?.cliente?.telefono;
    if (!tel) return;
    Linking.openURL(`tel:${tel}`).catch(() => {});
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
            <Pressable onPress={llamarCliente} style={estilos.telBoton}>
              <Text style={estilos.telTxt}>📞 {pedido.cliente.telefono} (toca para llamar)</Text>
            </Pressable>
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

        {/* Repartidor si ya se asignó */}
        {pedido.repartidor?.usuario && (
          <Seccion titulo="Repartidor">
            <Text style={estilos.nombre}>🛵 {pedido.repartidor.usuario.nombre}</Text>
            {pedido.repartidor.usuario.telefono && (
              <Text style={estilos.direccion}>📞 {pedido.repartidor.usuario.telefono}</Text>
            )}
          </Seccion>
        )}
      </ScrollView>

      {/* Botones de acción */}
      <BarraAcciones
        estado={pedido.estado}
        enviando={enviando}
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
      />

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

function BarraAcciones({ estado, enviando, onAceptar, onRechazar, onPreparando, onListo }) {
  if (estado === 'pendiente') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnRechazar]} disabled={enviando} onPress={onRechazar}>
          <Text style={estilos.btnRechazarTxt}>🚫 Rechazar</Text>
        </Pressable>
        <Pressable style={[estilos.btn, estilos.btnAceptar]} disabled={enviando} onPress={onAceptar}>
          <Text style={estilos.btnAceptarTxt}>
            {enviando ? 'Enviando…' : '✅ Aceptar'}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'confirmado') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1 }]} disabled={enviando} onPress={onPreparando}>
          <Text style={estilos.btnAceptarTxt}>
            {enviando ? 'Actualizando…' : '🍳 Empezar a preparar'}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (estado === 'preparando') {
    return (
      <View style={estilos.barra}>
        <Pressable style={[estilos.btn, estilos.btnAceptar, { flex: 1 }]} disabled={enviando} onPress={onListo}>
          <Text style={estilos.btnAceptarTxt}>
            {enviando ? 'Actualizando…' : '📦 Marcar como listo'}
          </Text>
        </Pressable>
      </View>
    );
  }
  // listo / en_camino / entregado / cancelado / rechazado → solo lectura
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
  telBoton:   { marginTop: espacio.xs },
  telTxt:     { fontSize: 14, color: colors.secundario, fontWeight: '600', textDecorationLine: 'underline' },
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

  barra:      {
    flexDirection: 'row', gap: espacio.sm,
    padding: espacio.md, backgroundColor: colors.superficie,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
  btn:        { flex: 1, paddingVertical: espacio.md, borderRadius: radio.md, alignItems: 'center' },
  btnAceptar: { backgroundColor: colors.primario },
  btnAceptarTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  btnRechazar:{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: colors.error },
  btnRechazarTxt: { color: colors.error, fontSize: 16, fontWeight: '800' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: espacio.md },
  ineGrande:  { width: '100%', height: '80%' },
  cerrarModal:{ color: '#FFF', marginTop: espacio.md, fontSize: 14 },
});
