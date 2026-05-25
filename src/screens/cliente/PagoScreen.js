import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import { pedidosAPI, pagosAPI } from '../../api/client';
import { getCarrito, vaciarCarrito } from './NegocioScreen';
import { colors, espacio, radio } from '../../theme/colors';

// Centro de Puerto Escondido como fallback si no hay GPS
const CENTRO_PE = { latitude: 15.8647, longitude: -97.0732 };

const FEE_ENVIO = { standard: 35, express: 60 };
const TOKENS_POR_PESO = 10;

const METODOS = [
  { id: 'efectivo',     nombre: 'Efectivo',     emoji: '💵', desc: 'Pagas cuando llegue el pedido (solo hasta $500)' },
  { id: 'tarjeta',      nombre: 'Tarjeta',      emoji: '💳', desc: 'Débito o crédito vía Mercado Pago' },
  { id: 'mercado_pago', nombre: 'Mercado Pago', emoji: '📱', desc: 'Desde tu cuenta Mercado Pago' },
  { id: 'transferencia',nombre: 'Transferencia',emoji: '🏦', desc: 'SPEI a nuestra cuenta bancaria' },
];

export default function PagoScreen({ route, navigation }) {
  const carrito   = getCarrito();
  const tipoEnvio = route.params?.tipo_envio || 'standard';
  const subtotal  = carrito.items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0);
  const feeEnvio  = FEE_ENVIO[tipoEnvio] || 35;
  const tokens    = Math.floor(subtotal / TOKENS_POR_PESO);

  const requiereINE = carrito.items.some((it) => it.requiere_id);

  const [cotizando, setCotizando]       = useState(true);
  const [cobertura, setCobertura]       = useState({ fuera_de_cobertura: false, aviso: null, distancia_km: null });
  const [ubicacion, setUbicacion]       = useState(null);
  const [costoEnvioReal, setCostoEnvio] = useState(null);

  // Pin en el mapa para la dirección de entrega
  const [pinCoords, setPinCoords]         = useState(null); // { latitude, longitude }
  const [geocodificando, setGeocodificando] = useState(false);
  const mapRef = useRef(null);

  const costoEnvio = costoEnvioReal !== null ? costoEnvioReal : feeEnvio;
  const total = subtotal + costoEnvio;

  const [metodo, setMetodo]     = useState(total > 1000 ? 'tarjeta' : 'efectivo');
  const [direccion, setDir]     = useState('');
  const [notas, setNotas]       = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ineFoto, setIneFoto]   = useState(null);

  // Pedir ubicación, colocar pin y cotizar al entrar
  useEffect(() => {
    (async () => {
      try {
        let coords = null;
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUbicacion(coords);
          const pin = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setPinCoords(pin);
          // Reverse geocode para prellenar la dirección
          const geo = await Location.reverseGeocodeAsync(pin);
          if (geo?.[0]) {
            const g = geo[0];
            const partes = [g.street, g.streetNumber, g.district || g.subregion].filter(Boolean);
            if (partes.length > 0) setDir(partes.join(' '));
          }
        } else {
          // Sin GPS: pin en el centro de Puerto Escondido
          setPinCoords(CENTRO_PE);
        }
        if (!carrito.negocio?.id) { setCotizando(false); return; }
        const { data } = await pedidosAPI.cotizar(
          carrito.negocio.id,
          coords?.lat,
          coords?.lng,
        );
        if (data?.data) {
          if (data.data.costo_envio != null) setCostoEnvio(Number(data.data.costo_envio));
          setCobertura({
            fuera_de_cobertura: data.data.fuera_de_cobertura || false,
            aviso: data.data.aviso || null,
            distancia_km: data.data.distancia_km || null,
          });
        }
      } catch (e) {
        console.log('Cotización falló:', e?.mensajeAmigable || e?.message);
        setPinCoords(CENTRO_PE);
      } finally {
        setCotizando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando el usuario mueve el pin: reverse geocode y re-cotizar
  const onPinDragEnd = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinCoords({ latitude, longitude });
    setUbicacion({ lat: latitude, lng: longitude });
    setGeocodificando(true);
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo?.[0]) {
        const g = geo[0];
        const partes = [g.street, g.streetNumber, g.district || g.subregion].filter(Boolean);
        if (partes.length > 0) setDir(partes.join(' '));
      }
      // Re-cotizar con nueva ubicación
      if (carrito.negocio?.id) {
        const { data } = await pedidosAPI.cotizar(carrito.negocio.id, latitude, longitude);
        if (data?.data) {
          if (data.data.costo_envio != null) setCostoEnvio(Number(data.data.costo_envio));
          setCobertura({
            fuera_de_cobertura: data.data.fuera_de_cobertura || false,
            aviso: data.data.aviso || null,
            distancia_km: data.data.distancia_km || null,
          });
        }
      }
    } catch (_) {}
    setGeocodificando(false);
  };

  const metodosDisponibles = METODOS.filter((m) => !(m.id === 'efectivo' && total > 500));
  const { fuera_de_cobertura, aviso, distancia_km } = cobertura;

  // ── Tomar / elegir foto del INE ──
  const tomarFotoINE = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar la foto de tu INE.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.[0]) {
        setIneFoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
      }
    } catch (e) {
      Alert.alert('Error', 'No pudimos abrir la cámara.');
    }
  };

  const elegirDeGaleria = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.[0]) {
        setIneFoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
      }
    } catch (e) {
      Alert.alert('Error', 'No pudimos abrir la galería.');
    }
  };

  const confirmar = async () => {
    if (!direccion) {
      Alert.alert('Dirección', 'Por favor escribe dónde quieres que te entreguemos.');
      return;
    }
    const carrito = getCarrito();
    if (!carrito.negocio || carrito.items.length === 0) {
      Alert.alert('Carrito vacío', 'Regresa y arma tu pedido.');
      return;
    }
    if (requiereINE && !ineFoto) {
      Alert.alert(
        'Validación de edad',
        'Tu pedido incluye productos con restricción de edad (alcohol o cigarros). Por favor sube una foto de tu INE para poder entregar.'
      );
      return;
    }
    if (fuera_de_cobertura) {
      Alert.alert('Fuera de cobertura', aviso || 'Tu dirección está fuera de nuestra zona de entrega.');
      return;
    }

    try {
      setEnviando(true);
      // Armar URL de la foto del INE (data URI base64 si la tomamos)
      let ine_foto_url = null;
      if (requiereINE && ineFoto) {
        ine_foto_url = ineFoto.base64
          ? `data:image/jpeg;base64,${ineFoto.base64}`
          : ineFoto.uri;
      }

      // 1. Crear el pedido en el backend
      const { data } = await pedidosAPI.crear({
        negocio_id: carrito.negocio.id,
        items: carrito.items.map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          opcion_elegida: it.opcion_elegida || null,
          notas: it.notas || null,
        })),
        direccion_entrega: direccion,
        latitud_entrega:  pinCoords?.latitude  || ubicacion?.lat  || null,
        longitud_entrega: pinCoords?.longitude || ubicacion?.lng || null,
        notas_entrega: notas,
        metodo_pago: metodo,
        tipo_envio: tipoEnvio,
        ine_foto_url,
      });
      const pedido = data.data?.pedido;

      // 2. Si no es efectivo, abrir pasarela de Mercado Pago
      if (metodo === 'tarjeta' || metodo === 'mercado_pago') {
        const resPref = await pagosAPI.preferencia(pedido.id);
        const url = resPref.data.data.init_point || resPref.data.data.sandbox_init_point;
        await WebBrowser.openBrowserAsync(url);
      } else if (metodo === 'transferencia') {
        Alert.alert(
          'Datos bancarios',
          'Transfiere a:\n\nBanco: BBVA\nCLABE: 012XXXXXXXXXXXXX\nBeneficiario: VoyCorriendo SA de CV\n\nDespués sube tu comprobante en "Mis pedidos".'
        );
      }

      // 3. Limpiar carrito y redirigir al seguimiento
      vaciarCarrito();
      navigation.replace('Seguimiento', { pedidoId: pedido.id });
    } catch (e) {
      Alert.alert('No pudimos crear tu pedido', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        {/* Resumen del pedido */}
        {carrito.items.length > 0 && (
          <View style={estilos.resumenPedido}>
            <Text style={estilos.resumenTitulo}>📋 Tu pedido en {carrito.negocio?.nombre}</Text>
            {carrito.items.map((it) => (
              <View key={it._key || it.producto_id}>
                <View style={estilos.resumenLinea}>
                  <Text style={estilos.resumenItem}>
                    {it.cantidad}× {it.nombre}
                    {it.requiere_id && <Text style={estilos.resumenEdad}>  🔞</Text>}
                  </Text>
                  <Text style={estilos.resumenPrecio}>
                    ${(it.precio_unitario * it.cantidad).toFixed(2)}
                  </Text>
                </View>
                {!!it.opcion_elegida && (
                  <Text style={estilos.resumenExtra}>  🏷️ {it.opcion_elegida}</Text>
                )}
                {!!it.notas && (
                  <Text style={estilos.resumenExtra}>  📝 {it.notas}</Text>
                )}
              </View>
            ))}
            <View style={estilos.resumenSeparador} />
            <View style={estilos.resumenLinea}>
              <Text style={estilos.resumenSub}>Subtotal</Text>
              <Text style={estilos.resumenSub}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={estilos.resumenLinea}>
              <Text style={estilos.resumenSub}>
                Envío {cotizando ? '(calculando…)' : tipoEnvio === 'express' ? 'Express' : 'Estándar'}
              </Text>
              <Text style={estilos.resumenSub}>${costoEnvio.toFixed(2)}</Text>
            </View>
            {tokens > 0 && (
              <Text style={estilos.tokensInfo}>
                🪙 Ganarás {tokens} VoyTokens · {tokens >= 35 ? '¡Envío gratis disponible!' : `${35 - tokens} más para envío gratis`}
              </Text>
            )}
            {distancia_km != null && (
              <Text style={estilos.tarifaInfo}>
                📍 ~{distancia_km.toFixed(1)} km del negocio
              </Text>
            )}
            {fuera_de_cobertura && (
              <View style={estilos.fueraCobertura}>
                <Text style={estilos.fueraCoberturaTxt}>
                  ⚠️ {aviso || 'Esta dirección está fuera de nuestra zona de entrega.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Validación de edad (INE) ── */}
        {requiereINE && (
          <View style={estilos.ineBox}>
            <Text style={estilos.ineTitulo}>🔞 Validación de edad</Text>
            <Text style={estilos.ineDescripcion}>
              Tu pedido incluye productos con restricción de edad. Por ley, necesitamos una foto de tu INE
              para poder entregarlos. El repartidor la verificará al llegar.
            </Text>

            {ineFoto ? (
              <View style={estilos.inePreview}>
                <Image source={{ uri: ineFoto.uri }} style={estilos.ineImagen} />
                <View style={{ flex: 1 }}>
                  <Text style={estilos.ineOk}>✅ INE cargada</Text>
                  <Pressable onPress={() => setIneFoto(null)}>
                    <Text style={estilos.ineLink}>Cambiar foto</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={estilos.ineBotones}>
                <Pressable style={estilos.ineBtn} onPress={tomarFotoINE}>
                  <Text style={estilos.ineBtnEmoji}>📷</Text>
                  <Text style={estilos.ineBtnTxt}>Tomar foto</Text>
                </Pressable>
                <Pressable style={estilos.ineBtn} onPress={elegirDeGaleria}>
                  <Text style={estilos.ineBtnEmoji}>🖼️</Text>
                  <Text style={estilos.ineBtnTxt}>Desde galería</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <Text style={estilos.seccion}>¿Dónde te lo llevamos?</Text>

        {/* Mapa para seleccionar pin de entrega */}
        <View style={estilos.mapaContenedor}>
          {pinCoords ? (
            <MapView
              ref={mapRef}
              style={estilos.mapa}
              initialRegion={{
                latitude: pinCoords.latitude,
                longitude: pinCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={pinCoords}
                draggable
                onDragEnd={onPinDragEnd}
                title="Tu entrega aquí"
                pinColor={colors.primario}
              />
            </MapView>
          ) : (
            <View style={[estilos.mapa, estilos.mapaCargando]}>
              <ActivityIndicator color={colors.primario} />
              <Text style={estilos.mapaCargandoTxt}>Obteniendo ubicación…</Text>
            </View>
          )}
          <View style={estilos.mapaHint}>
            <Text style={estilos.mapaHintTxt}>
              📍 Arrastra el pin para ajustar tu punto de entrega
            </Text>
            {geocodificando && <ActivityIndicator size="small" color={colors.primario} style={{ marginLeft: 8 }} />}
          </View>
        </View>

        <Campo
          placeholder="Ej. Hotel Olas Altas, detrás de la farmacia…"
          multiline
          value={direccion}
          onChangeText={setDir}
        />
        <Campo
          placeholder="Notas para el repartidor (opcional)"
          multiline
          value={notas}
          onChangeText={setNotas}
        />

        <Text style={estilos.seccion}>¿Cómo quieres pagar?</Text>
        {metodosDisponibles.map((m) => (
          <Pressable
            key={m.id}
            style={[estilos.metodo, metodo === m.id && estilos.metodoActivo]}
            onPress={() => setMetodo(m.id)}
          >
            <Text style={estilos.metodoEmoji}>{m.emoji}</Text>
            <View style={{ flex: 1, marginLeft: espacio.md }}>
              <Text style={estilos.metodoNombre}>{m.nombre}</Text>
              <Text style={estilos.metodoDesc}>{m.desc}</Text>
            </View>
            <View style={[estilos.radio, metodo === m.id && estilos.radioActivo]} />
          </Pressable>
        ))}

        {total > 500 && (
          <Text style={estilos.avisoLimite}>
            💡 Tu pedido es de ${total.toFixed(2)} MXN. El efectivo solo está disponible para pedidos
            de $500 o menos.
          </Text>
        )}

        <View style={estilos.totalBox}>
          <Text style={estilos.totalLabel}>Total a pagar</Text>
          <Text style={estilos.totalValor}>${total.toFixed(2)} MXN</Text>
        </View>

        <Boton
          titulo={
            fuera_de_cobertura
              ? '🚫 Fuera de cobertura'
              : requiereINE && !ineFoto
                ? '📷 Sube tu INE para continuar'
                : cotizando
                  ? 'Verificando cobertura…'
                  : 'Confirmar pedido'
          }
          onPress={confirmar}
          cargando={enviando}
          deshabilitado={(requiereINE && !ineFoto) || fuera_de_cobertura || cotizando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },
  seccion: { fontSize: 18, fontWeight: '700', color: colors.texto, marginTop: espacio.md, marginBottom: espacio.sm },

  // Mapa selector de dirección
  mapaContenedor: {
    borderRadius: radio.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borde,
    marginBottom: espacio.sm,
  },
  mapa: {
    width: '100%',
    height: 220,
  },
  mapaCargando: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapaCargandoTxt: { fontSize: 13, color: colors.textoSuave, marginTop: 4 },
  mapaHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.superficie,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
  },
  mapaHintTxt: { fontSize: 12, color: colors.textoSuave, flex: 1 },

  // Resumen del pedido
  resumenPedido: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.md,
    borderWidth: 1, borderColor: colors.borde,
  },
  resumenTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  resumenLinea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  resumenItem: { fontSize: 14, color: colors.texto, flex: 1, marginRight: espacio.sm },
  resumenPrecio: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  resumenSeparador: { height: 1, backgroundColor: colors.borde, marginVertical: espacio.sm },
  resumenSub: { fontSize: 13, color: colors.textoSuave, fontWeight: '600' },
  resumenEdad: { fontSize: 12, color: '#9B1C1C', fontWeight: '800' },
  resumenExtra: { fontSize: 12, color: colors.secundario, marginLeft: 16, marginBottom: 2 },
  tarifaInfo:  { fontSize: 11, color: colors.textoSuave, marginTop: 2, fontStyle: 'italic' },
  tokensInfo:  { fontSize: 11, color: '#92400E', marginTop: 4, fontWeight: '600', backgroundColor: '#FFFBEB', padding: 6, borderRadius: 6 },
  fueraCobertura: {
    backgroundColor: '#FEF2F2',
    padding: espacio.sm, borderRadius: radio.sm,
    marginTop: espacio.sm,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  fueraCoberturaTxt: { fontSize: 12, color: '#7F1D1D', lineHeight: 16 },

  // Validación de edad (INE)
  ineBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.md,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  ineTitulo: { fontSize: 16, fontWeight: '800', color: '#7F1D1D', marginBottom: 4 },
  ineDescripcion: { fontSize: 13, color: '#7F1D1D', lineHeight: 18, marginBottom: espacio.md },
  ineBotones: { flexDirection: 'row', gap: espacio.sm },
  ineBtn: {
    flex: 1,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    paddingVertical: espacio.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
  },
  ineBtnEmoji: { fontSize: 28 },
  ineBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.texto, marginTop: 4 },
  inePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: colors.superficie,
    padding: espacio.sm,
    borderRadius: radio.md,
  },
  ineImagen: {
    width: 72,
    height: 48,
    borderRadius: radio.sm,
    backgroundColor: colors.borde,
  },
  ineOk: { fontSize: 14, fontWeight: '800', color: colors.exito },
  ineLink: { fontSize: 13, color: colors.primario, fontWeight: '600', marginTop: 4 },

  metodo: {
    flexDirection: 'row', alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    borderWidth: 1.5, borderColor: colors.borde,
    marginBottom: espacio.sm,
  },
  metodoActivo: { borderColor: colors.primario, backgroundColor: '#FFF3E8' },
  metodoEmoji: { fontSize: 28 },
  metodoNombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  metodoDesc: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.borde,
  },
  radioActivo: { borderColor: colors.primario, backgroundColor: colors.primario },
  avisoLimite: {
    backgroundColor: '#FFF9E6',
    padding: espacio.md, borderRadius: radio.sm,
    color: colors.texto, fontSize: 13, marginTop: espacio.md, lineHeight: 18,
  },
  totalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    marginVertical: espacio.lg,
  },
  totalLabel: { fontSize: 16, color: colors.textoSuave },
  totalValor: { fontSize: 22, fontWeight: '800', color: colors.primario },
});
