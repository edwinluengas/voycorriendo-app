import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Pressable, Linking, ScrollView, Vibration, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { pedidosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

const WA_VOYCORRIENDO = '527542462564';

const ESTADOS_LOCAL = [
  { id: 'pendiente',  label: 'Recibimos tu pedido',        emoji: '📝' },
  { id: 'confirmado', label: 'El negocio lo aceptó',        emoji: '✅' },
  { id: 'preparando', label: 'Lo están preparando',          emoji: '👨‍🍳' },
  { id: 'listo',      label: 'Listo para recoger',           emoji: '📦' },
  { id: 'en_camino',  label: 'Tu repartidor va en camino',   emoji: '🛵' },
  { id: 'entregado',  label: '¡Entregado! Buen provecho',    emoji: '🎉' },
];

const ESTADOS_PAQUETERIA = [
  { id: 'pendiente',  label: 'Pedido recibido',             emoji: '📝' },
  { id: 'confirmado', label: 'Pedido confirmado',            emoji: '✅' },
  { id: 'preparando', label: 'Empacando tu pedido',          emoji: '📦' },
  { id: 'listo',      label: 'Listo para enviar',            emoji: '🏷️' },
  { id: 'en_envio',   label: 'En camino desde México 🚚',   emoji: '🚚' },
  { id: 'entregado',  label: '¡Llegó tu pedido!',            emoji: '🎉' },
];

// Mensajes de notificación para cada cambio de estado
const NOTIF_ESTADO = {
  confirmado: { titulo: '✅ ¡Pedido confirmado!',   cuerpo: 'El negocio aceptó tu pedido y lo está preparando.' },
  preparando: { titulo: '👨‍🍳 Preparando tu pedido', cuerpo: 'Tu pedido está en la cocina. ¡Ya casi!' },
  listo:      { titulo: '📦 ¡Pedido listo!',        cuerpo: 'Tu pedido está listo. El repartidor va a recogerlo.' },
  en_camino:  { titulo: '🛵 ¡Tu repartidor viene!', cuerpo: 'Ya va en camino. Prepárate para recibir tu pedido.' },
  en_envio:   { titulo: '🚚 ¡Tu pedido va en camino!', cuerpo: 'Fue enviado desde México. Te avisamos cuando llegue.' },
  entregado:  { titulo: '🎉 ¡Pedido entregado!',    cuerpo: '¡Buen provecho! No olvides calificarnos.' },
  cancelado:  { titulo: '❌ Pedido cancelado',       cuerpo: 'Tu pedido fue cancelado. Contáctanos si necesitas ayuda.' },
};

const notificarCambioEstado = (nuevoEstado, pedidoId) => {
  const n = NOTIF_ESTADO[nuevoEstado];
  if (!n) return;
  Vibration.vibrate([0, 200, 100, 200]);
  Notifications.scheduleNotificationAsync({
    content: {
      title: n.titulo,
      body: n.cuerpo,
      sound: true,
      channelId: 'pedidos',
      data: { tipo: 'estado_pedido', pedidoId },
    },
    trigger: null,
  }).catch(() => {});
};

export default function SeguimientoScreen({ route, navigation }) {
  const { pedidoId } = route.params;
  const [pedido, setPedido]             = useState(null);
  const [cargando, setCargando]         = useState(true);
  const [estrellas, setEstrellas]       = useState(0);
  const [estrellasRep, setEstrellasRep] = useState(0);
  const [propina, setPropina]           = useState('');
  const [calificando, setCalificando]   = useState(false);
  const estadoAnteriorRef               = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await pedidosAPI.detalle(pedidoId);
      const p = data.data?.pedido;
      if (p) setPedido(p);
    } catch (_) {}
    finally { setCargando(false); }
  }, [pedidoId]);

  useEffect(() => {
    cargar();

    // Polling cada 5s — se detiene cuando el pedido ya terminó
    const intervalo = setInterval(() => {
      setPedido((p) => {
        if (p && (p.estado === 'entregado' || p.estado === 'cancelado')) {
          clearInterval(intervalo);
          return p;
        }
        cargar();
        return p;
      });
    }, 5000);

    // Socket.io para updates instantáneos
    const socket = conectarSocket();
    socket.emit('unirse_pedido', pedidoId);

    const onEstado = (data) => {
      if (data.pedido_id !== pedidoId) return;
      const nuevoEstado = data.estado;
      setPedido((p) => {
        if (p && p.estado !== nuevoEstado) {
          notificarCambioEstado(nuevoEstado, pedidoId);
        }
        return p ? { ...p, estado: nuevoEstado } : p;
      });
    };

    const onPago = () => cargar();

    socket.on('estado_pedido', onEstado);
    socket.on('pago_actualizado', onPago);

    return () => {
      clearInterval(intervalo);
      // Pasar la referencia exacta del handler — evita eliminar listeners de otros componentes
      socket.off('estado_pedido', onEstado);
      socket.off('pago_actualizado', onPago);
    };
  }, [pedidoId, cargar]);

  const calificar = async () => {
    if (!estrellas) return;
    const propinaNum = parseFloat(propina) || 0;
    if (propinaNum > 1000) {
      Alert.alert('Propina inválida', 'La propina máxima es $1,000 MXN.');
      return;
    }
    setCalificando(true);
    try {
      await pedidosAPI.calificar(pedidoId, {
        calificacion_negocio: estrellas,
        calificacion_repartidor: (pedido.repartidor_id && estrellasRep) ? estrellasRep : undefined,
        propina: propinaNum > 0 ? propinaNum : undefined,
      });

      await cargar();
    } catch (_) {} finally {
      setCalificando(false);
    }
  };

  if (cargando || !pedido) {
    return <ActivityIndicator size="large" color={colors.primario} style={{ flex: 1 }} />;
  }

  const esPaqueteria   = pedido.negocio?.tipo_entrega === 'paqueteria';
  const esAhivoy       = pedido.negocio?.categoria === 'ahivoy store';
  const ESTADOS        = esPaqueteria ? ESTADOS_PAQUETERIA : ESTADOS_LOCAL;
  const estadoActual   = ESTADOS.findIndex((e) => e.id === pedido.estado);
  const esRestaurante  = pedido.negocio?.categoria === 'restaurante';
  const mostrarSugerencia = esRestaurante && ['confirmado', 'preparando', 'listo', 'en_camino'].includes(pedido.estado);
  const yaCalificado   = pedido.calificacion_negocio !== null && pedido.calificacion_negocio !== undefined;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView>
        <View style={estilos.header}>
          <Text style={estilos.numero}>Pedido {pedido.numero}</Text>
          <Text style={estilos.total}>${parseFloat(pedido.total).toFixed(2)} MXN</Text>
          {!!pedido.direccion_entrega && (
            <Text style={estilos.direccionEntrega}>📍 {pedido.direccion_entrega}</Text>
          )}
        </View>

        {/* 📦 Vista paquetería */}
        {esPaqueteria && ['en_envio', 'entregado'].includes(pedido.estado) && (
          <View style={estilos.paqueteriaBloque}>
            <Text style={estilos.paqueteriaTitulo}>
              {pedido.estado === 'entregado' ? '✅ Pedido entregado' : '🚚 Tu pedido va en camino'}
            </Text>
            {pedido.numero_guia ? (
              <View style={estilos.guiaChip}>
                <Text style={estilos.guiaLabel}>Número de guía</Text>
                <Text style={estilos.guiaTxt}>{pedido.numero_guia}</Text>
              </View>
            ) : (
              <Text style={estilos.paqueteriaInfo}>
                El equipo de VoyCorriendo coordinará la entrega contigo por WhatsApp.
              </Text>
            )}
            {pedido.negocio?.telefono && pedido.estado !== 'entregado' && (
              <Pressable
                style={estilos.btnWA}
                onPress={() => {
                  const num = `52${pedido.negocio.telefono.replace(/\D/g, '')}`;
                  const msg = encodeURIComponent(`Hola, mi pedido #${pedido.numero} ya fue enviado. ¿Cuándo llega?`);
                  Linking.openURL(`whatsapp://send?phone=${num}&text=${msg}`)
                    .catch(() => Linking.openURL(`https://wa.me/${num}?text=${msg}`));
                }}
              >
                <Text style={estilos.btnWATxt}>💬 Consultar por WhatsApp</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Estado actual chip */}
        {estadoActual >= 0 && pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && (
          <View style={estilos.chipEstadoCard}>
            <Text style={estilos.chipEstadoEmoji}>{ESTADOS[estadoActual]?.emoji}</Text>
            <Text style={estilos.chipEstadoTxt}>{ESTADOS[estadoActual]?.label}</Text>
          </View>
        )}

        {/* Código de entrega — visible solo cuando el repartidor va en camino */}
        {pedido.estado === 'en_camino' && pedido.codigo_entrega && (
          <View style={estilos.codigoCard}>
            <Text style={estilos.codigoLabel}>Código de entrega</Text>
            <Text style={estilos.codigoNum}>{pedido.codigo_entrega}</Text>
            <Text style={estilos.codigoSub}>
              Muestra este código al repartidor cuando llegue para confirmar la entrega.
            </Text>
          </View>
        )}

        {/* Pedido cancelado o rechazado */}
        {(pedido.estado === 'cancelado' || pedido.estado === 'rechazado') && (
          <View style={estilos.chipCanceladoCard}>
            <Text style={estilos.chipCanceladoEmoji}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={estilos.chipCanceladoTxt}>
                {pedido.estado === 'rechazado' ? 'Pedido rechazado por el negocio' : 'Pedido cancelado'}
              </Text>
              {!!pedido.nota_estado && (
                <Text style={estilos.chipCanceladoSub}>{pedido.nota_estado}</Text>
              )}
            </View>
          </View>
        )}

        {/* Botón WhatsApp VoyCorriendo Store */}
        {esAhivoy && !['entregado', 'cancelado'].includes(pedido.estado) && (
          <Pressable
            style={estilos.btnWA}
            onPress={() => {
              const msg = encodeURIComponent(
                `Hola VoyCorriendo Store 🛍️, tengo una pregunta sobre mi pedido #${pedido.numero}.`
              );
              Linking.openURL(`whatsapp://send?phone=${WA_VOYCORRIENDO}&text=${msg}`)
                .catch(() => Linking.openURL(`https://wa.me/${WA_VOYCORRIENDO}?text=${msg}`));
            }}
          >
            <Text style={estilos.btnWATxt}>💬 Contactar VoyCorriendo Store</Text>
          </Pressable>
        )}

        {/* Timeline de estados */}
        <View style={estilos.timeline}>
          {ESTADOS.map((e, i) => (
            <View key={e.id} style={estilos.paso}>
              <View style={[estilos.circulo, i <= estadoActual && estilos.circuloActivo]}>
                <Text style={estilos.circuloEmoji}>{e.emoji}</Text>
              </View>
              <Text style={[estilos.pasoLabel, i === estadoActual && estilos.pasoLabelActivo]}>
                {e.label}
              </Text>
              {i < ESTADOS.length - 1 && (
                <View style={[estilos.linea, i < estadoActual && estilos.lineaActiva]} />
              )}
            </View>
          ))}
        </View>

        {pedido.repartidor_id && (
          <View style={estilos.repartidor}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.repTxt}>🛵 {pedido.repartidor?.usuario?.nombre || 'Tu repartidor'}</Text>
              {pedido.repartidor?.marca_vehiculo && (
                <Text style={estilos.repSub}>
                  {pedido.repartidor.marca_vehiculo}
                  {pedido.repartidor.color_vehiculo ? ` · ${pedido.repartidor.color_vehiculo}` : ''}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => Linking.openURL(`tel:${pedido.repartidor?.usuario?.telefono || ''}`)}
              style={estilos.btnLlamar}
            >
              <Text style={estilos.btnLlamarTxt}>📞 Llamar</Text>
            </Pressable>
          </View>
        )}

        {/* Sugerencia cruzada */}
        {mostrarSugerencia && (
          <Pressable
            style={estilos.sugerencia}
            onPress={() =>
              navigation.navigate('Home', {
                screen: 'Inicio',
                params: { filtroCategoria: 'tienda_conveniencia' },
              })
            }
          >
            <Text style={estilos.sugerenciaEmoji}>🥤</Text>
            <View style={{ flex: 1 }}>
              <Text style={estilos.sugerenciaTitulo}>¿Te falta una bebida?</Text>
              <Text style={estilos.sugerenciaSub}>
                Mientras llega tu comida, pide refrescos, cervezas o aguas frescas →
              </Text>
            </View>
          </Pressable>
        )}

        {/* ⭐ Calificación */}
        {pedido.estado === 'entregado' && !yaCalificado && (
          <View style={estilos.calificacionBloque}>
            <Text style={estilos.calificacionTitulo}>¿Cómo estuvo tu pedido?</Text>

            <Text style={estilos.calificacionLabel}>
              {pedido.negocio?.nombre || 'El negocio'}
            </Text>
            <View style={estilos.estrellasRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setEstrellas(n)} disabled={calificando}>
                  <Text style={[estilos.estrella, n <= estrellas && estilos.estrellaActiva]}>★</Text>
                </Pressable>
              ))}
            </View>

            {!!pedido.repartidor_id && (
              <>
                <Text style={[estilos.calificacionLabel, { marginTop: espacio.md }]}>Tu repartidor</Text>
                <View style={estilos.estrellasRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setEstrellasRep(n)} disabled={calificando}>
                      <Text style={[estilos.estrella, n <= estrellasRep && estilos.estrellaActiva]}>★</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Propina opcional al repartidor */}
                <Text style={[estilos.calificacionLabel, { marginTop: espacio.md }]}>
                  Propina para el repartidor{' '}
                  <Text style={{ fontWeight: '400', color: colors.textoSuave }}>(opcional)</Text>
                </Text>
                <View style={estilos.propinaRow}>
                  {[20, 30, 50].map((amt) => (
                    <Pressable
                      key={amt}
                      style={[estilos.propinaChip, propina === String(amt) && estilos.propinaChipActivo]}
                      onPress={() => setPropina(propina === String(amt) ? '' : String(amt))}
                    >
                      <Text style={[estilos.propinaChipTxt, propina === String(amt) && estilos.propinaChipTxtActivo]}>
                        ${amt}
                      </Text>
                    </Pressable>
                  ))}
                  <TextInput
                    style={estilos.propinaInput}
                    placeholder="Otro"
                    placeholderTextColor={colors.textoSuave}
                    keyboardType="numeric"
                    value={[20, 30, 50].map(String).includes(propina) ? '' : propina}
                    onChangeText={(v) => setPropina(v)}
                    maxLength={5}
                  />
                </View>
              </>
            )}

            {estrellas > 0 && (
              <Pressable style={estilos.btnCalificar} onPress={calificar} disabled={calificando}>
                {calificando
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={estilos.btnCalificarTxt}>
                      {parseFloat(propina) > 0
                        ? `Enviar + propina $${parseFloat(propina).toFixed(0)}`
                        : 'Enviar calificación'}
                    </Text>
                }
              </Pressable>
            )}
          </View>
        )}

        {pedido.estado === 'entregado' && yaCalificado && (
          <View style={[estilos.calificacionBloque, { backgroundColor: '#F0FDF4' }]}>
            <Text style={{ fontSize: 28, textAlign: 'center' }}>{'★'.repeat(pedido.calificacion_negocio)}</Text>
            <Text style={[estilos.calificacionSub, { color: colors.exito, marginTop: espacio.xs }]}>¡Gracias por tu calificación!</Text>
          </View>
        )}

        <View style={{ padding: espacio.lg }}>
          <Boton
            titulo="Ayuda con este pedido"
            variante="secundario"
            onPress={() => Alert.alert('Soporte', 'Escríbenos por WhatsApp o visita la pestaña Ayuda para abrir un ticket.')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  header: { padding: espacio.lg, backgroundColor: colors.superficie, alignItems: 'center' },
  numero: { fontSize: 14, color: colors.textoSuave, fontWeight: '600' },
  total: { fontSize: 28, fontWeight: '800', color: colors.primario, marginTop: espacio.xs },
  direccionEntrega: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center', paddingHorizontal: espacio.md },

  chipEstadoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md, marginTop: espacio.md,
    paddingVertical: espacio.md, borderRadius: radio.md, gap: espacio.sm,
    borderWidth: 1, borderColor: colors.borde,
  },
  chipEstadoEmoji: { fontSize: 28 },
  chipEstadoTxt: { fontSize: 16, fontWeight: '700', color: colors.texto },

  chipCanceladoCard: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    backgroundColor: '#FEF2F2',
    marginHorizontal: espacio.md, marginTop: espacio.md,
    padding: espacio.md, borderRadius: radio.md,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  chipCanceladoEmoji: { fontSize: 28 },
  chipCanceladoTxt: { fontSize: 15, fontWeight: '700', color: '#7F1D1D' },
  chipCanceladoSub: { fontSize: 13, color: '#9B1C1C', marginTop: 2 },

  timeline: { padding: espacio.lg },
  paso: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.md, position: 'relative' },
  circulo: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.borde, alignItems: 'center', justifyContent: 'center', marginRight: espacio.md,
  },
  circuloActivo: { backgroundColor: colors.primario },
  circuloEmoji: { fontSize: 22 },
  pasoLabel: { fontSize: 15, color: colors.textoSuave, flex: 1 },
  pasoLabelActivo: { fontSize: 16, color: colors.texto, fontWeight: '700' },
  linea: {
    position: 'absolute', left: 23, top: 48,
    width: 2, height: espacio.md + 8, backgroundColor: colors.borde,
  },
  lineaActiva: { backgroundColor: colors.primario },

  repartidor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.superficie, padding: espacio.md,
    marginHorizontal: espacio.md, borderRadius: radio.md,
  },
  repTxt: { fontSize: 15, fontWeight: '700', color: colors.texto },
  repSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  btnLlamar: {
    backgroundColor: colors.exito, paddingVertical: espacio.sm,
    paddingHorizontal: espacio.md, borderRadius: radio.full,
  },
  btnLlamarTxt: { color: '#FFF', fontWeight: '700' },

  sugerencia: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF3E6', marginHorizontal: espacio.md, marginTop: espacio.md,
    padding: espacio.md, borderRadius: radio.md, gap: espacio.md,
    borderWidth: 1, borderColor: '#FFD6A5',
  },
  sugerenciaEmoji: { fontSize: 32 },
  sugerenciaTitulo: { fontSize: 15, fontWeight: '800', color: colors.texto },
  sugerenciaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2, lineHeight: 16 },

  paqueteriaBloque: {
    backgroundColor: colors.superficie, marginHorizontal: espacio.md, marginTop: espacio.md,
    borderRadius: radio.md, padding: espacio.md, borderWidth: 1, borderColor: '#FFD6A5',
  },
  paqueteriaTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  paqueteriaInfo: { fontSize: 13, color: colors.textoSuave, lineHeight: 18 },
  guiaChip: { backgroundColor: '#FFF7ED', borderRadius: radio.md, padding: espacio.sm, marginTop: espacio.xs },
  guiaLabel: { fontSize: 11, color: colors.textoSuave, fontWeight: '600', textTransform: 'uppercase' },
  guiaTxt: { fontSize: 15, fontWeight: '800', color: colors.primario, letterSpacing: 1, marginTop: 2 },
  btnWA: {
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: '#25D366', borderRadius: radio.md,
    paddingVertical: espacio.sm, marginTop: espacio.sm, marginHorizontal: espacio.md,
  },
  btnWATxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  calificacionBloque: {
    backgroundColor: colors.superficie, marginHorizontal: espacio.md, marginTop: espacio.md,
    borderRadius: radio.md, padding: espacio.lg, alignItems: 'center',
  },
  calificacionTitulo: { fontSize: 18, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  calificacionLabel: { fontSize: 14, fontWeight: '700', color: colors.textoSuave, marginTop: espacio.xs },
  calificacionSub: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  estrellasRow: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.xs },
  estrella: { fontSize: 40, color: colors.borde },
  estrellaActiva: { color: '#FBBF24' },
  btnCalificar: {
    marginTop: espacio.lg, backgroundColor: colors.primario,
    paddingVertical: espacio.md, paddingHorizontal: espacio.xl,
    borderRadius: radio.md, minWidth: 200, alignItems: 'center',
  },
  btnCalificarTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  codigoCard: {
    backgroundColor: '#FFF3E8',
    borderWidth: 2, borderColor: colors.primario,
    marginHorizontal: espacio.md, marginTop: espacio.md,
    borderRadius: radio.md, padding: espacio.md, alignItems: 'center',
  },
  codigoLabel: { fontSize: 11, fontWeight: '800', color: colors.primario, letterSpacing: 1, textTransform: 'uppercase' },
  codigoNum: { fontSize: 48, fontWeight: '900', color: colors.primario, letterSpacing: 8, marginVertical: espacio.xs },
  codigoSub: { fontSize: 12, color: colors.textoSuave, textAlign: 'center', lineHeight: 16 },

  propinaRow: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, marginTop: espacio.xs, flexWrap: 'wrap' },
  propinaChip: {
    paddingHorizontal: espacio.md, paddingVertical: espacio.sm,
    borderRadius: radio.full, borderWidth: 1.5, borderColor: colors.borde,
    backgroundColor: colors.superficie,
  },
  propinaChipActivo: { borderColor: colors.primario, backgroundColor: '#FFF3E8' },
  propinaChipTxt: { fontSize: 14, fontWeight: '700', color: colors.textoSuave },
  propinaChipTxtActivo: { color: colors.primario },
  propinaInput: {
    borderWidth: 1.5, borderColor: colors.borde,
    borderRadius: radio.md, paddingHorizontal: espacio.md, paddingVertical: espacio.sm,
    fontSize: 14, color: colors.texto, minWidth: 72, textAlign: 'center',
    backgroundColor: colors.superficie,
  },
});
