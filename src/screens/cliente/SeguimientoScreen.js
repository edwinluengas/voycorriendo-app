import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Pressable, Linking, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { pedidosAPI } from '../../api/client';
import { conectarSocket } from '../../api/socket';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

const ESTADOS = [
  { id: 'pendiente',   label: 'Recibimos tu pedido',     emoji: '📝' },
  { id: 'confirmado',  label: 'El negocio lo aceptó',    emoji: '✅' },
  { id: 'preparando',  label: 'Lo están preparando',     emoji: '👨‍🍳' },
  { id: 'listo',       label: 'Listo para recoger',      emoji: '📦' },
  { id: 'en_camino',   label: 'Tu repartidor va en camino', emoji: '🛵' },
  { id: 'entregado',   label: '¡Entregado! Buen provecho', emoji: '🎉' },
];

// Centro por defecto: Puerto Escondido, Oaxaca (si no hay coords aún)
const CENTRO_DEFAULT = { latitude: 15.8631, longitude: -97.0676 };

const toNum = (v) => (v == null ? null : Number(v));

export default function SeguimientoScreen({ route, navigation }) {
  const { pedidoId } = route.params;
  const [pedido, setPedido]     = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ubicacionRep, setUbicacionRep] = useState(null); // { lat, lng } live
  const mapRef = useRef(null);

  const cargar = async () => {
    try {
      const { data } = await pedidosAPI.detalle(pedidoId);
      setPedido(data.data?.pedido);
    } catch (_) {/* ignorar */}
    finally { setCargando(false); }
  };

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

    // Socket.io para updates instantáneos (complementa el polling)
    const socket = conectarSocket();
    socket.emit('unirse_pedido', pedidoId);
    socket.on('estado_pedido', (data) => {
      if (data.pedido_id === pedidoId) setPedido((p) => ({ ...p, estado: data.estado }));
    });
    socket.on('pago_actualizado', () => cargar());
    socket.on('ubicacion_repartidor', (data) => {
      if (data?.lat != null && data?.lng != null) {
        setUbicacionRep({ lat: Number(data.lat), lng: Number(data.lng) });
      }
    });

    return () => {
      clearInterval(intervalo);
      socket.off('estado_pedido');
      socket.off('pago_actualizado');
      socket.off('ubicacion_repartidor');
    };
  }, [pedidoId]);

  // Cuando cambie la ubicación o cargue el pedido, encuadrar el mapa
  useEffect(() => {
    if (!mapRef.current || !pedido) return;
    const puntos = [];
    const negLat = toNum(pedido.negocio?.latitud);
    const negLng = toNum(pedido.negocio?.longitud);
    const entLat = toNum(pedido.latitud_entrega);
    const entLng = toNum(pedido.longitud_entrega);
    if (negLat && negLng) puntos.push({ latitude: negLat, longitude: negLng });
    if (entLat && entLng) puntos.push({ latitude: entLat, longitude: entLng });
    if (ubicacionRep) puntos.push({ latitude: ubicacionRep.lat, longitude: ubicacionRep.lng });
    if (puntos.length >= 2) {
      mapRef.current.fitToCoordinates(puntos, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [pedido, ubicacionRep]);

  if (cargando || !pedido) {
    return <ActivityIndicator size="large" color={colors.primario} style={{ flex: 1 }} />;
  }

  const estadoActual = ESTADOS.findIndex((e) => e.id === pedido.estado);
  const esRestaurante = pedido.negocio?.categoria === 'restaurante';
  const mostrarSugerencia = esRestaurante && ['confirmado', 'preparando', 'listo', 'en_camino'].includes(pedido.estado);

  // Coordenadas
  const negLat = toNum(pedido.negocio?.latitud);
  const negLng = toNum(pedido.negocio?.longitud);
  const entLat = toNum(pedido.latitud_entrega);
  const entLng = toNum(pedido.longitud_entrega);
  const repLat = ubicacionRep?.lat ?? toNum(pedido.repartidor?.latitud);
  const repLng = ubicacionRep?.lng ?? toNum(pedido.repartidor?.longitud);

  const tieneCoords = negLat && negLng && entLat && entLng;
  const mostrarMapa = tieneCoords && ['confirmado', 'preparando', 'listo', 'en_camino', 'entregado'].includes(pedido.estado);

  const regionInicial = {
    latitude:  negLat || CENTRO_DEFAULT.latitude,
    longitude: negLng || CENTRO_DEFAULT.longitude,
    latitudeDelta:  0.02,
    longitudeDelta: 0.02,
  };

  // Traza una línea negocio → repartidor (si va en camino) o negocio → destino
  const trazoCoords = [];
  if (negLat && negLng) trazoCoords.push({ latitude: negLat, longitude: negLng });
  if (repLat && repLng && pedido.estado === 'en_camino') {
    trazoCoords.push({ latitude: repLat, longitude: repLng });
  }
  if (entLat && entLng) trazoCoords.push({ latitude: entLat, longitude: entLng });

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

        {/* 🗺️ Mapa en vivo */}
        {mostrarMapa && (
          <View style={estilos.mapaContenedor}>
            <MapView
              ref={mapRef}
              style={estilos.mapa}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={regionInicial}
              showsUserLocation={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
            >
              {/* Negocio (origen) */}
              {negLat && negLng && (
                <Marker
                  coordinate={{ latitude: negLat, longitude: negLng }}
                  title={pedido.negocio?.nombre || 'Negocio'}
                  description="Punto de recogida"
                  pinColor="#FF6B00"
                >
                  <View style={estilos.marcadorNegocio}>
                    <Text style={estilos.marcadorEmoji}>🏪</Text>
                  </View>
                </Marker>
              )}

              {/* Destino (cliente) */}
              {entLat && entLng && (
                <Marker
                  coordinate={{ latitude: entLat, longitude: entLng }}
                  title="Tu dirección"
                  description={pedido.direccion_entrega}
                >
                  <View style={estilos.marcadorDestino}>
                    <Text style={estilos.marcadorEmoji}>🏠</Text>
                  </View>
                </Marker>
              )}

              {/* Repartidor en vivo */}
              {repLat && repLng && pedido.estado === 'en_camino' && (
                <Marker
                  coordinate={{ latitude: repLat, longitude: repLng }}
                  title={pedido.repartidor?.usuario?.nombre || 'Tu repartidor'}
                  description="Va en camino 🛵"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={estilos.marcadorRepartidor}>
                    <Text style={estilos.marcadorEmoji}>🛵</Text>
                  </View>
                </Marker>
              )}

              {/* Trazo de ruta */}
              {trazoCoords.length >= 2 && (
                <Polyline
                  coordinates={trazoCoords}
                  strokeColor={colors.primario}
                  strokeWidth={4}
                  lineDashPattern={[8, 6]}
                />
              )}
            </MapView>

            {/* Chip de estado sobre el mapa */}
            <View style={estilos.chipEstado}>
              <Text style={estilos.chipEstadoEmoji}>
                {ESTADOS[estadoActual]?.emoji || '🛵'}
              </Text>
              <Text style={estilos.chipEstadoTxt}>
                {ESTADOS[estadoActual]?.label || 'En curso'}
              </Text>
            </View>
          </View>
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

        {/* Sugerencia cruzada: ¿te falta una bebida? */}
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
                Mientras llega tu comida, pide refrescos, cervezas o aguas frescas de Abarrotes La Esquina →
              </Text>
            </View>
          </Pressable>
        )}

        <View style={{ padding: espacio.lg }}>
          <Boton
            titulo="Ayuda con este pedido"
            variante="secundario"
            onPress={() => Alert.alert('Soporte', 'Llama al 800-VOYCORRIENDO o abre un ticket desde la pestaña Ayuda.')}
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

  // 🗺️ Mapa
  mapaContenedor: {
    height: 280,
    marginHorizontal: espacio.md,
    marginTop: espacio.md,
    borderRadius: radio.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  mapa: { ...StyleSheet.absoluteFillObject },
  marcadorNegocio: {
    backgroundColor: '#FF6B00',
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
  },
  marcadorDestino: {
    backgroundColor: '#2E7D32',
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
  },
  marcadorRepartidor: {
    backgroundColor: '#1976D2',
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
  },
  marcadorEmoji: { fontSize: 20 },
  chipEstado: {
    position: 'absolute',
    top: espacio.sm,
    left: espacio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 6,
    paddingHorizontal: espacio.sm,
    borderRadius: radio.full,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chipEstadoEmoji: { fontSize: 16, marginRight: 6 },
  chipEstadoTxt: { fontSize: 13, fontWeight: '700', color: colors.texto },

  timeline: { padding: espacio.lg },
  paso: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.md, position: 'relative' },
  circulo: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.borde,
    alignItems: 'center', justifyContent: 'center',
    marginRight: espacio.md,
  },
  circuloActivo: { backgroundColor: colors.primario },
  circuloEmoji: { fontSize: 22 },
  pasoLabel: { fontSize: 15, color: colors.textoSuave, flex: 1 },
  pasoLabelActivo: { fontSize: 16, color: colors.texto, fontWeight: '700' },
  linea: {
    position: 'absolute', left: 23, top: 48,
    width: 2, height: espacio.md + 8,
    backgroundColor: colors.borde,
  },
  lineaActiva: { backgroundColor: colors.primario },
  repartidor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.superficie,
    padding: espacio.md,
    marginHorizontal: espacio.md,
    borderRadius: radio.md,
  },
  repTxt: { fontSize: 15, fontWeight: '700', color: colors.texto },
  repSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  btnLlamar: { backgroundColor: colors.exito, paddingVertical: espacio.sm, paddingHorizontal: espacio.md, borderRadius: radio.full },
  btnLlamarTxt: { color: '#FFF', fontWeight: '700' },

  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    marginHorizontal: espacio.md,
    marginTop: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    gap: espacio.md,
    borderWidth: 1,
    borderColor: '#FFD6A5',
  },
  sugerenciaEmoji: { fontSize: 32 },
  sugerenciaTitulo: { fontSize: 15, fontWeight: '800', color: colors.texto },
  sugerenciaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2, lineHeight: 16 },
});
