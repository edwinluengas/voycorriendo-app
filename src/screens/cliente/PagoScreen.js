import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import FormularioTarjeta, { tarjetaCompleta, cvvEsperadoPorMarca } from '../../components/FormularioTarjeta';
import { pedidosAPI, pagosAPI, tarjetasAPI } from '../../api/client';
import { tokenizarTarjetaNueva, buscarMetodoPago, mpConfigurado } from '../../api/mercadoPago';
import { getCarrito, vaciarCarrito } from './NegocioScreen';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';
import { FEE_ENVIO, PEDIDO_MINIMO, LIMITE_EFECTIVO } from '../../config/businessRules';

const METODOS_BASE = [
  { id: 'efectivo', nombre: 'Efectivo', emoji: '💵', desc: `Pagas al repartidor · máx. $${LIMITE_EFECTIVO} en productos + envío` },
  { id: 'tarjeta',  nombre: 'Tarjeta',  emoji: '💳', desc: '🔒 Débito o crédito — pago 100% seguro' },
];
const METODO_TRANSFERENCIA = {
  id: 'transferencia',
  nombre: 'Transferencia SPEI',
  emoji: '🏦',
  desc: 'Exclusivo Voy Store® · Transferencia bancaria SPEI',
  esExclusivo: true,
};

export default function PagoScreen({ route, navigation }) {
  const { usuario, refrescarUsuario } = useAuth();
  // El saldo de crédito puede haberlo otorgado un admin en cualquier
  // momento de la sesión — refrescar al entrar a pagar para no mostrar un
  // saldo desactualizado (el objeto `usuario` del contexto solo se llena
  // una vez, al hacer login).
  useFocusEffect(useCallback(() => { refrescarUsuario(); }, [refrescarUsuario]));
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

  const [metodo, setMetodo]     = useState(subtotal > LIMITE_EFECTIVO ? 'tarjeta' : 'efectivo');
  // Propina en el CHECKOUT (solo tarjeta): se cobra dentro del mismo cargo
  // a la tarjeta. En efectivo se da en mano al entregar.
  const [propinaSel, setPropinaSel] = useState(0);
  const propina    = metodo === 'tarjeta' ? propinaSel : 0;
  const costoEnvio = costoEnvioReal !== null ? costoEnvioReal : feeEnvio;
  const total      = subtotal + costoEnvio + propina;
  // Crédito de plataforma: complementa CUALQUIER método de pago — si no
  // alcanza a cubrir todo el pedido, el resto se completa con tarjeta o en
  // efectivo al entregar (el backend es la autoridad real del monto
  // consumido, evita condiciones de carrera; esto es solo para mostrarle
  // al cliente cuánto le va a quedar por pagar antes de confirmar).
  const [usarCredito, setUsarCredito] = useState(true);
  const creditoDisponible = parseFloat(usuario?.credito_disponible || 0);
  const creditoAplicable  = usarCredito ? Math.min(creditoDisponible, total) : 0;
  const totalNeto = Math.round((total - creditoAplicable) * 100) / 100;
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
  // Recuerda la última tarjeta GUARDADA seleccionada — para poder
  // "deseleccionar" (deshacer) si el usuario toca "Usar otra tarjeta" por
  // error y quiere regresar a la que ya tenía elegida, sin fricción.
  const tarjetaGuardadaAnteriorRef = useRef(null);
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

  // Carga tarjetas guardadas cada vez que la pantalla toma foco con "tarjeta"
  // elegida — así refleja altas/bajas hechas en Métodos de pago sin perder
  // la selección actual si esa tarjeta sigue existiendo.
  useFocusEffect(
    useCallback(() => {
      if (metodo !== 'tarjeta') return;
      setCargandoTarjetas(true);
      tarjetasAPI.listar()
        .then(({ data }) => {
          const lista = data.data?.tarjetas || [];
          setTarjetas(lista);
          setTarjetaElegida((actual) => {
            if (actual && actual !== 'nueva' && lista.some((t) => t.id === actual)) return actual;
            const porDefecto = lista.length > 0 ? (lista.find((t) => t.predeterminada)?.id || lista[0].id) : 'nueva';
            // Guarda la selección por defecto como "anterior" — así, si el
            // usuario nunca tocó explícitamente una tarjeta guardada y toca
            // "Usar otra tarjeta" por error, deseleccionar la regresa aquí.
            if (porDefecto !== 'nueva') tarjetaGuardadaAnteriorRef.current = porDefecto;
            return porDefecto;
          });
        })
        .catch(() => setTarjetaElegida('nueva'))
        .finally(() => setCargandoTarjetas(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metodo])
  );

  const eliminarTarjetaGuardada = (t) => {
    Alert.alert('Eliminar tarjeta', `¿Quitar la tarjeta terminada en ${t.ultimos_4}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await tarjetasAPI.eliminar(t.id);
            setTarjetas((prev) => prev.filter((x) => x.id !== t.id));
            setTarjetaElegida((actual) => (actual === t.id ? 'nueva' : actual));
          } catch (e) {
            Alert.alert('Error', e?.mensajeAmigable || 'No se pudo eliminar la tarjeta.');
          }
        },
      },
    ]);
  };

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
    // Resultado de la detección de banco/marca, resuelto ANTES de crear el
    // pedido y usado directo en el cobro (no se lee del estado de React
    // dentro de confirmar(): setMetodoDetectado es asíncrono y el closure
    // vería el valor viejo).
    let metodoResuelto = metodoDetectado;
    // El crédito cubre el pedido ENTERO — no hace falta tarjeta para nada,
    // el backend ya lo marcará 'capturado' desde crearPedido.
    const cubiertoConCredito = metodo === 'tarjeta' && totalNeto <= 0;
    if (metodo === 'tarjeta' && !cubiertoConCredito) {
      if (!mpConfigurado()) {
        Alert.alert('No disponible', 'El pago con tarjeta aún no está configurado. Elige otro método.');
        return;
      }
      if (tarjetaElegida === 'nueva' || !tarjetaElegida) {
        if (!tarjetaCompleta(datosTarjetaNueva)) {
          Alert.alert('Datos de tarjeta incompletos', 'Revisa el número, nombre, vencimiento y CVV.');
          return;
        }
        if (!metodoResuelto?.payment_method_id) {
          // La detección automática por BIN pudo no haber corrido todavía o
          // haber fallado por red — se reintenta aquí mismo en vez de dejar
          // al usuario bloqueado esperando algo que ya no va a ocurrir.
          const binActual = datosTarjetaNueva.numero.replace(/\s+/g, '').slice(0, 6);
          if (binActual.length === 6) {
            try {
              metodoResuelto = await buscarMetodoPago(binActual);
            } catch (_) {
              metodoResuelto = null;
            }
          }
          if (!metodoResuelto?.payment_method_id) {
            Alert.alert('No identificamos tu banco', 'Revisa que el número de tarjeta esté completo y correcto, y que tengas conexión a internet. Luego vuelve a intentar.');
            return;
          }
          setMetodoDetectado(metodoResuelto);
        }
      } else {
        const tarjetaSel = tarjetas.find((t) => t.id === tarjetaElegida);
        if (!tarjetaSel) {
          Alert.alert('Tarjeta no disponible', 'Esa tarjeta ya no está disponible. Elige otra o agrega una nueva.');
          return;
        }
        // Amex usa CVV de 4 dígitos; el resto, de 3. Si no conocemos la
        // marca (tarjetas guardadas antes de que existiera la columna),
        // se acepta 3 o 4 y decide Mercado Pago.
        const lenEsperada = tarjetaSel.payment_method_id ? cvvEsperadoPorMarca(tarjetaSel.payment_method_id) : null;
        const cvvOk = lenEsperada ? cvvGuardada.length === lenEsperada : (cvvGuardada.length >= 3 && cvvGuardada.length <= 4);
        if (!cvvOk) {
          Alert.alert('CVV incorrecto', lenEsperada
            ? `El CVV de esta tarjeta es de ${lenEsperada} dígitos.`
            : 'Ingresa el CVV de tu tarjeta guardada para continuar.');
          return;
        }
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
        propina: propina > 0 ? propina : undefined,
        paga_con: metodo === 'efectivo' && pagaCon ? Number(pagaCon) : null,
        usar_credito: usarCredito ? true : undefined,
      });
      const pedido = data.data?.pedido;

      // 2. Tarjeta: tokeniza y cobra directo en la app (sin salir a Mercado Pago)
      // — salvo que el crédito ya haya cubierto el pedido COMPLETO: el
      // backend lo marca 'capturado' desde crearPedido y aquí no hay nada
      // que cobrar a ningún medio de pago.
      let pagoRechazado = false;
      if (metodo === 'tarjeta' && pedido?.pago_estado !== 'capturado') {
        try {
          let datosPago;
          if (tarjetaElegida !== 'nueva') {
            const tarjeta = tarjetas.find((t) => t.id === tarjetaElegida);
            if (!tarjeta) throw new Error('Esa tarjeta ya no está disponible. Elige otra desde "Métodos de pago".');
            // La re-tokenización de una tarjeta guardada requiere el access
            // token (secreto) de MP — se hace en el backend. Aquí solo
            // mandamos el id de la tarjeta guardada + CVV (nunca se guarda).
            datosPago = { tarjeta_id: tarjeta.id, cvv: cvvGuardada };
          } else {
            // metodoResuelto se garantizó arriba, ANTES de crear el pedido —
            // este guard solo queda como red de seguridad.
            const payment_method_id = metodoResuelto?.payment_method_id;
            const issuer_id = metodoResuelto?.issuer_id;
            if (!payment_method_id) throw new Error('No identificamos tu banco. Revisa el número de tarjeta e intenta de nuevo.');

            if (guardarTarjetaNueva) {
              // El token de MP es de un solo uso: para guardar Y pagar con
              // una tarjeta nueva primero se guarda (consume ese token) y
              // luego el backend genera uno nuevo desde la tarjeta ya
              // guardada para el cobro — nunca se reusa el mismo token dos veces.
              const tokenParaGuardar = await tokenizarTarjetaNueva(datosTarjetaNueva);
              const resGuardar = await tarjetasAPI.agregar(tokenParaGuardar);
              const tarjetaGuardada = resGuardar.data.data.tarjeta;
              datosPago = { tarjeta_id: tarjetaGuardada.id, cvv: datosTarjetaNueva.cvv, payment_method_id, issuer_id };
            } else {
              const token = await tokenizarTarjetaNueva(datosTarjetaNueva);
              datosPago = { token, payment_method_id, issuer_id };
            }
          }

          const resPago = await pagosAPI.tarjeta({
            pedido_id: pedido.id,
            ...datosPago,
            installments: 1,
          });

          const status = resPago.data?.data?.status;
          if (status === 'rejected') {
            pagoRechazado = true;
            Alert.alert('Pago rechazado', resPago.data?.mensaje || 'Tu banco rechazó el pago. Verifica los datos de tu tarjeta o intenta con otra.');
          } else if (status === 'in_process' || status === 'pending') {
            Alert.alert('Pago en proceso', 'Tu pago está siendo verificado. Te avisaremos en cuanto se confirme.');
          }
        } catch (payErr) {
          // El pago no se pudo intentar siquiera (tarjeta inválida, tokenización
          // falló, red, etc.) — el pedido YA se creó pero nunca llega al negocio
          // sin pago capturado (pedidosDelNegocio lo filtra). No lo mandamos a
          // Seguimiento como si fuera normal: se queda aquí para reintentar.
          pagoRechazado = true;
          const detalleError = payErr?.response?.data?.mensaje || payErr?.mensajeAmigable || payErr?.message || 'Error desconocido';
          Alert.alert('No se pudo cobrar tu tarjeta', `Detalle: ${detalleError}\n\nVerifica los datos o intenta con otra tarjeta.`);
        }
        if (pagoRechazado) return; // no vaciar carrito ni navegar — el pedido no avanza sin pago
      } else if (metodo === 'transferencia') {
        Alert.alert(
          'Datos bancarios',
          'Transfiere a:\n\nBanco: Banamex (Citibanamex)\nCLABE: 002180902500967465\nBeneficiario: Edwin Melton Rojas Luengas\n\nDespués sube tu comprobante en "Mis pedidos".'
        );
      }

      // 3. Limpiar carrito y redirigir al seguimiento
      // El crédito ahora aplica a CUALQUIER método de pago (tarjeta o
      // efectivo) — refrescar el saldo mostrado sin importar cuál se usó.
      if (usarCredito) refrescarUsuario();
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

        {/* Campo "¿Con cuánto pagas?" — solo para efectivo, y solo si queda
            algo por cobrar en mano (si el crédito cubrió todo, no hay nada
            que pagar al entregar). */}
        {metodo === 'efectivo' && totalNeto > 0 && (
          <View style={estilos.pagaConBox}>
            <Text style={estilos.pagaConLabel}>¿Con cuánto vas a pagar?</Text>
            <Text style={estilos.pagaConSub}>
              El repartidor sabrá cuánto cambio preparar. Opcional.
              {creditoAplicable > 0 ? ` Ya se descontó tu crédito — solo pagas $${totalNeto.toFixed(2)}.` : ''}
            </Text>
            <Campo
              placeholder={`Ej. $${Math.ceil(totalNeto / 50) * 50} MXN`}
              keyboardType="numeric"
              value={pagaCon}
              onChangeText={setPagaCon}
              maxLength={6}
            />
          </View>
        )}
        {metodo === 'efectivo' && totalNeto <= 0 && (
          <View style={estilos.pagaConBox}>
            <Text style={estilos.pagaConLabel}>🎁 Tu crédito cubre este pedido completo</Text>
            <Text style={estilos.pagaConSub}>No le debes pagar nada en efectivo al repartidor.</Text>
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
                  <View key={t.id} style={[estilos.tarjetaOpcion, tarjetaElegida === t.id && estilos.tarjetaOpcionActiva]}>
                    <Pressable
                      style={estilos.tarjetaOpcionToca}
                      onPress={() => {
                        tarjetaGuardadaAnteriorRef.current = t.id;
                        setTarjetaElegida(t.id);
                        // Limpia el formulario de tarjeta nueva — si el
                        // usuario había tecleado algo por error y cambia de
                        // opinión, no debe reaparecer la próxima vez que
                        // toque "Usar otra tarjeta".
                        setDatosTarjetaNueva({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
                        setMetodoDetectado(null);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>💳</Text>
                      <Text style={estilos.tarjetaOpcionTxt}>
                        {(t.marca || 'Tarjeta').toUpperCase()} •••• {t.ultimos_4}
                      </Text>
                      <View style={[estilos.radio, tarjetaElegida === t.id && estilos.radioActivo]} />
                    </Pressable>
                    <Pressable onPress={() => eliminarTarjetaGuardada(t)} hitSlop={10} style={estilos.tarjetaEliminarBtn}>
                      <Text style={estilos.tarjetaEliminarTxt}>Eliminar</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  style={[estilos.tarjetaOpcion, tarjetaElegida === 'nueva' && estilos.tarjetaOpcionActiva]}
                  onPress={() => {
                    if (tarjetaElegida === 'nueva') {
                      // Ya estaba en "nueva" (la tocó por error) — DESELECCIONAR:
                      // regresa a la tarjeta guardada que tenía elegida antes,
                      // sin fricción. Si nunca había una (p. ej. no tiene
                      // tarjetas guardadas), no hay a dónde volver — se queda
                      // en "nueva" pero al menos limpia el formulario.
                      setDatosTarjetaNueva({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
                      setMetodoDetectado(null);
                      if (tarjetaGuardadaAnteriorRef.current && tarjetas.some((t) => t.id === tarjetaGuardadaAnteriorRef.current)) {
                        setTarjetaElegida(tarjetaGuardadaAnteriorRef.current);
                      }
                    } else {
                      tarjetaGuardadaAnteriorRef.current = tarjetaElegida;
                      setTarjetaElegida('nueva');
                    }
                  }}
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
                    placeholder={cvvEsperadoPorMarca(tarjetas.find((t) => t.id === tarjetaElegida)?.payment_method_id) === 4 ? '1234' : '123'}
                    keyboardType="numeric"
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

        {/* Propina al repartidor — solo tarjeta: va dentro del mismo cargo */}
        {metodo === 'tarjeta' && (
          <View style={estilos.propinaBox}>
            <Text style={estilos.propinaLabel}>
              💛 Propina para el repartidor <Text style={{ fontWeight: '400', color: colors.textoSuave }}>(opcional, se cobra con tu tarjeta)</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: espacio.xs, marginTop: espacio.xs }}>
              {[0, 10, 20, 30].map((amt) => (
                <Pressable
                  key={amt}
                  style={[estilos.propinaChip, propinaSel === amt && estilos.propinaChipActivo]}
                  onPress={() => setPropinaSel(amt)}
                >
                  <Text style={[estilos.propinaChipTxt, propinaSel === amt && estilos.propinaChipTxtActivo]}>
                    {amt === 0 ? 'Sin propina' : `$${amt}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Crédito de plataforma — CUALQUIER método de pago. Otorgado por
            un admin (manual o como compensación por un pedido no
            entregado), usable en cualquier tienda. Si no alcanza a cubrir
            todo, el resto se completa con tarjeta o en efectivo. */}
        {creditoDisponible > 0 && (
          <Pressable style={estilos.creditoBox} onPress={() => setUsarCredito((v) => !v)}>
            <View style={[estilos.creditoCheckbox, usarCredito && estilos.creditoCheckboxActivo]}>
              {usarCredito && <Text style={estilos.creditoCheckboxCheck}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={estilos.creditoLabel}>🎁 Usar mi crédito disponible</Text>
              <Text style={estilos.creditoSub}>
                Tienes ${creditoDisponible.toFixed(2)} MXN de crédito
                {usarCredito && creditoAplicable > 0 && creditoAplicable < total
                  ? ` — completa el resto ${metodo === 'tarjeta' ? 'con tu tarjeta' : 'en efectivo al entregar'}`
                  : ''}
              </Text>
            </View>
            {usarCredito && creditoAplicable > 0 && (
              <Text style={estilos.creditoMonto}>-${creditoAplicable.toFixed(2)}</Text>
            )}
          </Pressable>
        )}

        <View style={estilos.totalBox}>
          <View>
            <Text style={estilos.totalLabel}>Total a pagar</Text>
            {creditoAplicable > 0 && (
              <Text style={estilos.totalTachado}>${total.toFixed(2)} MXN</Text>
            )}
          </View>
          <Text style={estilos.totalValor}>${totalNeto.toFixed(2)} MXN</Text>
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
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: espacio.sm, borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  tarjetaOpcionActiva: {},
  tarjetaOpcionToca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  tarjetaEliminarBtn: { paddingHorizontal: espacio.sm, paddingVertical: espacio.xs },
  tarjetaEliminarTxt: { fontSize: 12, color: colors.error, fontWeight: '700' },
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
  propinaBox: {
    marginHorizontal: espacio.md, marginBottom: espacio.sm,
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: colors.borde,
  },
  propinaLabel: { fontSize: 13, fontWeight: '800', color: colors.texto },
  propinaChip: {
    paddingHorizontal: espacio.sm, paddingVertical: espacio.xs,
    borderRadius: radio.md, borderWidth: 1.5, borderColor: colors.borde,
    backgroundColor: colors.fondo,
  },
  propinaChipActivo: { borderColor: colors.primario, backgroundColor: '#FFF3E8' },
  propinaChipTxt: { fontSize: 13, fontWeight: '700', color: colors.textoSuave },
  propinaChipTxtActivo: { color: colors.primario },

  creditoBox: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    marginHorizontal: espacio.md, marginBottom: espacio.sm,
    backgroundColor: '#F0FDF4', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#BBF7D0',
  },
  creditoCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.secundario,
    alignItems: 'center', justifyContent: 'center',
  },
  creditoCheckboxActivo: { backgroundColor: colors.secundario },
  creditoCheckboxCheck: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  creditoLabel: { fontSize: 13, fontWeight: '800', color: colors.texto },
  creditoSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  creditoMonto: { fontSize: 15, fontWeight: '800', color: colors.secundario },
  totalTachado: { fontSize: 13, color: colors.textoSuave, textDecorationLine: 'line-through' },

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
