import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import FormularioTarjeta, { tarjetaCompleta } from '../../components/FormularioTarjeta';
import { pedidosAPI, pagosAPI, tarjetasAPI } from '../../api/client';
import { tokenizarTarjetaNueva, tokenizarTarjetaGuardada, mpConfigurado } from '../../api/mercadoPago';
import { getCarrito, vaciarCarrito } from './NegocioScreen';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';
import { FEE_ENVIO, PEDIDO_MINIMO, LIMITE_EFECTIVO } from '../../config/businessRules';

const METODOS_BASE = [
  { id: 'efectivo', nombre: 'Efectivo', emoji: '💵', desc: `Pagas al repartidor · máx. $${LIMITE_EFECTIVO} en productos + envío` },
  { id: 'tarjeta',  nombre: 'Tarjeta',  emoji: '💳', desc: 'Débito o crédito, directo en la app — sin cuenta de Mercado Pago' },
];
const METODO_TRANSFERENCIA = {
  id: 'transferencia',
  nombre: 'Transferencia SPEI',
  emoji: '🏦',
  desc: 'Exclusivo Voy Store® · Transferencia bancaria SPEI',
  esExclusivo: true,
};

export default function PagoScreen({ route, navigation }) {
  const { usuario } = useAuth();
  const carrito   = getCarrito();
  const tipoEnvio = route.params?.tipo_envio || 'standard';
  const subtotal  = carrito.items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0);
  const feeEnvio  = FEE_ENVIO[tipoEnvio] || 35;

  const requiereINE = carrito.items.some((it) => it.requiere_id);

  const [cotizando, setCotizando]       = useState(true);
  const [cobertura, setCobertura]       = useState({ fuera_de_cobertura: false, aviso: null, distancia_km: null });
  const [ubicacion, setUbicacion]       = useState(null);
  const [costoEnvioReal, setCostoEnvio] = useState(null);
  const [detectandoUbicacion, setDetectandoUbicacion] = useState(false);
  const [pagaCon, setPagaCon]           = useState('');

  const costoEnvio = costoEnvioReal !== null ? costoEnvioReal : feeEnvio;
  const total      = subtotal + costoEnvio;

  const [metodo, setMetodo]     = useState(subtotal > LIMITE_EFECTIVO ? 'tarjeta' : 'efectivo');
  const [direccion, setDir]     = useState('');
  const [notas, setNotas]       = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ineFoto, setIneFoto]   = useState(null);
  const [ineFotoUrl, setIneFotoUrl] = useState(null);
  const [subiendoIne, setSubiendoIne] = useState(false);

  // ── Pago con tarjeta nativo ──
  const [tarjetas, setTarjetas]           = useState([]);
  const [cargandoTarjetas, setCargandoTarjetas] = useState(false);
  const [tarjetaElegida, setTarjetaElegida] = useState(null); // id de TarjetaGuardada, o 'nueva'
  const [cvvGuardada, setCvvGuardada]     = useState('');
  const [datosTarjetaNueva, setDatosTarjetaNueva] = useState({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
  const [metodoDetectado, setMetodoDetectado] = useState(null);
  const [guardarTarjetaNueva, setGuardarTarjetaNueva] = useState(true);

  const detectarUbicacion = async () => {
    setDetectandoUbicacion(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setDetectandoUbicacion(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUbicacion(coords);
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo?.[0]) {
        const g = geo[0];
        const partes = [g.street, g.streetNumber, g.district || g.subregion].filter(Boolean);
        if (partes.length > 0) setDir(partes.join(' '));
      }
      if (carrito.negocio?.id) {
        const { data } = await pedidosAPI.cotizar(carrito.negocio.id, coords.lat, coords.lng, tipoEnvio);
        if (data?.data) {
          if (data.data.costo_envio != null) setCostoEnvio(Number(data.data.costo_envio));
          setCobertura({
            fuera_de_cobertura: data.data.fuera_de_cobertura || false,
            aviso: data.data.aviso || null,
            distancia_km: data.data.distancia_km || null,
          });
        }
      }
    } catch (e) {
      console.log('Ubicación/cotización falló:', e?.message);
    } finally {
      setDetectandoUbicacion(false);
      setCotizando(false);
    }
  };

  // Auto-detectar ubicación y cotizar al entrar
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUbicacion(coords);
          const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (geo?.[0]) {
            const g = geo[0];
            const partes = [g.street, g.streetNumber, g.district || g.subregion].filter(Boolean);
            if (partes.length > 0) setDir(partes.join(' '));
          }
          if (carrito.negocio?.id) {
            const { data } = await pedidosAPI.cotizar(carrito.negocio.id, coords.lat, coords.lng, tipoEnvio);
            if (data?.data) {
              if (data.data.costo_envio != null) setCostoEnvio(Number(data.data.costo_envio));
              setCobertura({
                fuera_de_cobertura: data.data.fuera_de_cobertura || false,
                aviso: data.data.aviso || null,
                distancia_km: data.data.distancia_km || null,
              });
            }
          }
        } else if (carrito.negocio?.id) {
          const { data } = await pedidosAPI.cotizar(carrito.negocio.id, null, null, tipoEnvio);
          if (data?.data?.costo_envio != null) setCostoEnvio(Number(data.data.costo_envio));
        }
      } catch (e) {
        console.log('Cotización falló:', e?.mensajeAmigable || e?.message);
      } finally {
        setCotizando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga tarjetas guardadas la primera vez que el cliente elige "tarjeta"
  useEffect(() => {
    if (metodo !== 'tarjeta' || tarjetas.length > 0 || cargandoTarjetas) return;
    setCargandoTarjetas(true);
    tarjetasAPI.listar()
      .then(({ data }) => {
        const lista = data.data?.tarjetas || [];
        setTarjetas(lista);
        setTarjetaElegida(lista.length > 0 ? (lista.find((t) => t.predeterminada)?.id || lista[0].id) : 'nueva');
      })
      .catch(() => setTarjetaElegida('nueva'))
      .finally(() => setCargandoTarjetas(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodo]);

  const esAhivoyStore = carrito.negocio?.categoria === 'ahivoy store';
  const METODOS = esAhivoyStore ? [...METODOS_BASE, METODO_TRANSFERENCIA] : METODOS_BASE;
  const metodosDisponibles = METODOS.filter((m) => !(m.id === 'efectivo' && subtotal > LIMITE_EFECTIVO));
  const { fuera_de_cobertura, aviso, distancia_km } = cobertura;

  // ── Sube la foto del INE a Supabase Storage y guarda la URL pública ──
  const subirIne = async (asset) => {
    setIneFoto({ uri: asset.uri, base64: asset.base64 });
    setIneFotoUrl(null);
    setSubiendoIne(true);
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const { data } = await pedidosAPI.subirFotoINE(asset.base64, mime);
      const url = data?.data?.url;
      if (!url) throw new Error('Sin URL');
      setIneFotoUrl(url);
    } catch (e) {
      Alert.alert('No se pudo subir tu INE', e?.mensajeAmigable || 'Intenta tomar la foto de nuevo.');
      setIneFoto(null);
      setIneFotoUrl(null);
    } finally {
      setSubiendoIne(false);
    }
  };

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
        await subirIne(res.assets[0]);
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
        await subirIne(res.assets[0]);
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
    if (!carrito.negocio || carrito.items.length === 0) {
      Alert.alert('Carrito vacío', 'Regresa y arma tu pedido.');
      return;
    }
    if (requiereINE && subiendoIne) {
      Alert.alert('Subiendo INE', 'Espera a que termine de subir tu INE antes de confirmar.');
      return;
    }
    if (requiereINE && !ineFotoUrl) {
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
    if (metodo === 'tarjeta') {
      if (!mpConfigurado()) {
        Alert.alert('No disponible', 'El pago con tarjeta aún no está configurado. Elige otro método.');
        return;
      }
      if (tarjetaElegida === 'nueva' || !tarjetaElegida) {
        if (!tarjetaCompleta(datosTarjetaNueva)) {
          Alert.alert('Datos de tarjeta incompletos', 'Revisa el número, nombre, vencimiento y CVV.');
          return;
        }
      } else if (cvvGuardada.length < 3) {
        Alert.alert('Falta el CVV', 'Ingresa el CVV de tu tarjeta guardada para continuar.');
        return;
      }
    }

    try {
      setEnviando(true);
      // URL pública del INE ya subido a Supabase Storage
      const ine_foto_url = requiereINE ? ineFotoUrl : null;

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
        latitud_entrega:  ubicacion?.lat  || null,
        longitud_entrega: ubicacion?.lng  || null,
        notas_entrega: notas,
        metodo_pago: metodo,
        tipo_envio: tipoEnvio,
        ine_foto_url,
        paga_con: metodo === 'efectivo' && pagaCon ? Number(pagaCon) : null,
      });
      const pedido = data.data?.pedido;

      // 2. Tarjeta: tokeniza y cobra directo en la app (sin salir a Mercado Pago)
      if (metodo === 'tarjeta') {
        try {
          let token, payment_method_id, issuer_id;
          if (tarjetaElegida !== 'nueva') {
            const tarjeta = tarjetas.find((t) => t.id === tarjetaElegida);
            token = await tokenizarTarjetaGuardada({ mp_card_id: tarjeta.mp_card_id, cvv: cvvGuardada });
            payment_method_id = tarjeta.payment_method_id;
            issuer_id = tarjeta.issuer_id;
          } else {
            payment_method_id = metodoDetectado?.payment_method_id;
            issuer_id = metodoDetectado?.issuer_id;
            if (!payment_method_id) throw new Error('No pudimos identificar el banco de tu tarjeta.');

            if (guardarTarjetaNueva) {
              // El token de MP es de un solo uso: para guardar Y pagar con
              // una tarjeta nueva primero se guarda (consume ese token) y
              // luego se genera uno nuevo desde la tarjeta ya guardada para
              // el cobro — nunca se reusa el mismo token dos veces.
              const tokenParaGuardar = await tokenizarTarjetaNueva(datosTarjetaNueva);
              const resGuardar = await tarjetasAPI.agregar(tokenParaGuardar);
              const tarjetaGuardada = resGuardar.data.data.tarjeta;
              token = await tokenizarTarjetaGuardada({ mp_card_id: tarjetaGuardada.mp_card_id, cvv: datosTarjetaNueva.cvv });
            } else {
              token = await tokenizarTarjetaNueva(datosTarjetaNueva);
            }
          }

          const resPago = await pagosAPI.tarjeta({
            pedido_id: pedido.id,
            token,
            payment_method_id,
            issuer_id,
            installments: 1,
          });

          const status = resPago.data?.data?.status;
          if (status === 'rejected') {
            Alert.alert('Pago rechazado', resPago.data?.mensaje || 'Tu banco rechazó el pago. Intenta con otra tarjeta desde "Mis pedidos".');
          } else if (status === 'in_process' || status === 'pending') {
            Alert.alert('Pago en proceso', 'Tu pago está siendo verificado. Te avisaremos en cuanto se confirme.');
          }
        } catch (payErr) {
          const detalleError = payErr?.response?.data?.mensaje || payErr?.mensajeAmigable || payErr?.message || 'Error desconocido';
          Alert.alert(
            '⚠️ Pedido creado — pago pendiente',
            `Tu pedido fue registrado pero el cobro falló.\n\nDetalle: ${detalleError}\n\nPuedes reintentar el pago desde "Mis pedidos".`
          );
        }
      } else if (metodo === 'transferencia') {
        Alert.alert(
          'Datos bancarios',
          'Transfiere a:\n\nBanco: Banamex (Citibanamex)\nCLABE: 002180902500967465\nBeneficiario: Edwin Melton Rojas Luengas\n\nDespués sube tu comprobante en "Mis pedidos".'
        );
      }

      // 3. Limpiar carrito y redirigir al seguimiento
      vaciarCarrito();
      navigation.replace('Seguimiento', { pedidoId: pedido.id });
    } catch (e) {
      Alert.alert('Error al crear pedido', e?.mensajeAmigable || 'No pudimos registrar tu pedido. Intenta de nuevo.');
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
                  {subiendoIne ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
                      <ActivityIndicator size="small" color={colors.primario} />
                      <Text style={estilos.ineSubiendo}>Subiendo…</Text>
                    </View>
                  ) : ineFotoUrl ? (
                    <Text style={estilos.ineOk}>✅ INE cargada</Text>
                  ) : (
                    <Text style={estilos.ineSubiendo}>Sin subir</Text>
                  )}
                  {!subiendoIne && (
                    <Pressable onPress={() => { setIneFoto(null); setIneFotoUrl(null); }}>
                      <Text style={estilos.ineLink}>Cambiar foto</Text>
                    </Pressable>
                  )}
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

        {/* Ubicación GPS */}
        <Pressable
          style={[estilos.ubicacionBtn, detectandoUbicacion && estilos.ubicacionBtnCargando]}
          onPress={detectarUbicacion}
          disabled={detectandoUbicacion}
        >
          {detectandoUbicacion
            ? <ActivityIndicator size="small" color={colors.primario} />
            : <Text style={estilos.ubicacionBtnTxt}>
                {ubicacion ? '📍 Ubicación detectada · Actualizar' : '📍 Detectar mi ubicación'}
              </Text>
          }
        </Pressable>

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
            style={[estilos.metodo, metodo === m.id && estilos.metodoActivo, m.esExclusivo && estilos.metodoStore]}
            onPress={() => setMetodo(m.id)}
          >
            <Text style={estilos.metodoEmoji}>{m.emoji}</Text>
            <View style={{ flex: 1, marginLeft: espacio.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs, flexWrap: 'wrap' }}>
                <Text style={estilos.metodoNombre}>{m.nombre}</Text>
                {m.esExclusivo && (
                  <View style={estilos.metodoBadgeStore}>
                    <Text style={estilos.metodoBadgeStoreTxt}>🛒 STORE</Text>
                  </View>
                )}
              </View>
              <Text style={estilos.metodoDesc}>{m.desc}</Text>
            </View>
            <View style={[estilos.radio, metodo === m.id && estilos.radioActivo]} />
          </Pressable>
        ))}

        {/* Aviso límite efectivo */}
        {metodo === 'efectivo' && subtotal > LIMITE_EFECTIVO && (
          <View style={estilos.avisoEfectivo}>
            <Text style={estilos.avisoEfectivoTxt}>
              ⚠️ Tus productos suman ${subtotal.toFixed(0)} MXN. El efectivo solo aplica hasta ${LIMITE_EFECTIVO} en productos (+ el fee de envío encima). Elige tarjeta.
            </Text>
          </View>
        )}

        {/* Campo "¿Con cuánto pagas?" — solo para efectivo */}
        {metodo === 'efectivo' && (
          <View style={estilos.pagaConBox}>
            <Text style={estilos.pagaConLabel}>¿Con cuánto vas a pagar?</Text>
            <Text style={estilos.pagaConSub}>
              El repartidor sabrá cuánto cambio preparar. Opcional.
            </Text>
            <Campo
              placeholder={`Ej. $${Math.ceil(total / 50) * 50} MXN`}
              keyboardType="numeric"
              value={pagaCon}
              onChangeText={setPagaCon}
              maxLength={6}
            />
          </View>
        )}

        {/* Selección de tarjeta / captura de tarjeta nueva */}
        {metodo === 'tarjeta' && (
          <View style={estilos.tarjetaBox}>
            {cargandoTarjetas ? (
              <ActivityIndicator color={colors.primario} style={{ marginVertical: espacio.sm }} />
            ) : (
              <>
                {tarjetas.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[estilos.tarjetaOpcion, tarjetaElegida === t.id && estilos.tarjetaOpcionActiva]}
                    onPress={() => setTarjetaElegida(t.id)}
                  >
                    <Text style={{ fontSize: 20 }}>💳</Text>
                    <Text style={estilos.tarjetaOpcionTxt}>
                      {(t.marca || 'Tarjeta').toUpperCase()} •••• {t.ultimos_4}
                    </Text>
                    <View style={[estilos.radio, tarjetaElegida === t.id && estilos.radioActivo]} />
                  </Pressable>
                ))}
                <Pressable
                  style={[estilos.tarjetaOpcion, tarjetaElegida === 'nueva' && estilos.tarjetaOpcionActiva]}
                  onPress={() => setTarjetaElegida('nueva')}
                >
                  <Text style={{ fontSize: 20 }}>➕</Text>
                  <Text style={estilos.tarjetaOpcionTxt}>Usar otra tarjeta</Text>
                  <View style={[estilos.radio, tarjetaElegida === 'nueva' && estilos.radioActivo]} />
                </Pressable>

                {tarjetaElegida === 'nueva' ? (
                  <View style={{ marginTop: espacio.sm }}>
                    <FormularioTarjeta
                      datos={datosTarjetaNueva}
                      setDatos={setDatosTarjetaNueva}
                      metodoDetectado={metodoDetectado}
                      setMetodoDetectado={setMetodoDetectado}
                    />
                    <Pressable
                      style={estilos.checkboxRow}
                      onPress={() => setGuardarTarjetaNueva((v) => !v)}
                    >
                      <View style={[estilos.checkbox, guardarTarjetaNueva && estilos.checkboxActivo]}>
                        {guardarTarjetaNueva && <Text style={estilos.checkboxCheck}>✓</Text>}
                      </View>
                      <Text style={estilos.checkboxTxt}>Guardar esta tarjeta para mis próximos pedidos</Text>
                    </Pressable>
                  </View>
                ) : tarjetaElegida ? (
                  <Campo
                    etiqueta="CVV de tu tarjeta"
                    placeholder="123"
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    value={cvvGuardada}
                    onChangeText={setCvvGuardada}
                    style={{ marginTop: espacio.sm }}
                  />
                ) : null}
              </>
            )}
          </View>
        )}

        {/* Aviso explicativo: SPEI solo en la tienda */}
        {!esAhivoyStore && (
          <View style={estilos.avisoStore}>
            <Text style={estilos.avisoStoreEmoji}>🏦</Text>
            <View style={{ flex: 1 }}>
              <Text style={estilos.avisoStoreTitulo}>Transferencia SPEI no disponible</Text>
              <Text style={estilos.avisoStoreDesc}>
                La transferencia bancaria solo está habilitada para compras en la{' '}
                <Text style={{ fontWeight: '800', color: colors.primario }}>Voy Store®</Text>.
              </Text>
            </View>
          </View>
        )}

        {subtotal > LIMITE_EFECTIVO && (
          <Text style={estilos.avisoLimite}>
            💡 Productos: ${subtotal.toFixed(2)} MXN. Efectivo disponible solo si los productos son ≤${LIMITE_EFECTIVO} (el fee de envío va encima de ese límite).
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
              : requiereINE && subiendoIne
                ? '⬆️ Subiendo INE…'
                : requiereINE && !ineFotoUrl
                  ? '📷 Sube tu INE para continuar'
                  : cotizando
                    ? 'Verificando cobertura…'
                    : 'Confirmar pedido'
          }
          onPress={confirmar}
          cargando={enviando}
          deshabilitado={(requiereINE && !ineFotoUrl) || subiendoIne || fuera_de_cobertura || cotizando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },
  seccion: { fontSize: 18, fontWeight: '700', color: colors.texto, marginTop: espacio.md, marginBottom: espacio.sm },

  // Botón detectar ubicación
  ubicacionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.md,
    borderRadius: radio.md,
    borderWidth: 1.5,
    borderColor: colors.primario,
    backgroundColor: '#FFF3E8',
    marginBottom: espacio.sm,
    minHeight: 48,
  },
  ubicacionBtnCargando: { opacity: 0.6 },
  ubicacionBtnTxt: { fontSize: 14, fontWeight: '700', color: colors.primario },

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
  ineSubiendo: { fontSize: 14, fontWeight: '700', color: colors.primario },
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
  metodoStore: { borderStyle: 'dashed', borderColor: colors.acento },
  metodoEmoji: { fontSize: 28 },
  metodoNombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  metodoDesc: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  metodoBadgeStore: {
    backgroundColor: colors.oscuro, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: radio.full,
  },
  metodoBadgeStoreTxt: { color: colors.acento, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  // Aviso SPEI no disponible (restaurantes/tienditas)
  avisoStore: {
    flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm,
    backgroundColor: '#1A1A1A',
    borderRadius: radio.md, padding: espacio.md,
    marginBottom: espacio.md,
    borderWidth: 1, borderColor: '#2C2C2E',
  },
  avisoStoreEmoji: { fontSize: 22 },
  avisoStoreTitulo: { fontSize: 13, fontWeight: '800', color: '#E0E0E0', marginBottom: 3 },
  avisoStoreDesc: { fontSize: 12, color: '#9E9E9E', lineHeight: 16 },
  avisoEfectivo: {
    backgroundColor: '#FEF2F2', borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  avisoEfectivoTxt: { fontSize: 13, color: '#991B1B', lineHeight: 18 },

  pagaConBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pagaConLabel: { fontSize: 14, fontWeight: '700', color: '#14532D', marginBottom: 2 },
  pagaConSub:   { fontSize: 12, color: '#166534', marginBottom: espacio.sm },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.borde,
  },
  radioActivo: { borderColor: colors.primario, backgroundColor: colors.primario },

  tarjetaBox: {
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm, borderWidth: 1, borderColor: colors.borde,
  },
  tarjetaOpcion: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingVertical: espacio.sm, borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  tarjetaOpcionActiva: {},
  tarjetaOpcionTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.texto },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, marginTop: espacio.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.borde,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActivo: { backgroundColor: colors.primario, borderColor: colors.primario },
  checkboxCheck: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  checkboxTxt: { flex: 1, fontSize: 13, color: colors.texto },
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
