/**
 * Tokenización de tarjeta directo con Mercado Pago (Checkout API).
 *
 * IMPORTANTE: esto NO usa el cliente `api` de client.js — esas llamadas van
 * derecho a api.mercadopago.com con la PUBLIC key (nunca la access token
 * secreta) y jamás deben llevar el header Authorization con el JWT de
 * VoyCorriendo. El número de tarjeta y el CVV solo viajan a Mercado Pago,
 * nunca a nuestro backend — ahí solo llega el token ya generado.
 */
import axios from 'axios';
import Constants from 'expo-constants';

const MP_PUBLIC_KEY = Constants.expoConfig?.extra?.mpPublicKey || '';
const MP_BASE = 'https://api.mercadopago.com';

const mp = axios.create({ baseURL: MP_BASE, timeout: 15000 });

const asegurarPublicKey = () => {
  if (!MP_PUBLIC_KEY) {
    throw new Error('MP_PUBLIC_KEY_FALTANTE');
  }
};

// ─── Identifica el banco/marca y el payment_method_id a partir del BIN
// (EXACTAMENTE los primeros 6 dígitos de la tarjeta — el estándar IIN/BIN
// de la industria; mandar 7-8 dígitos puede devolver un banco/marca
// incorrecto de Mercado Pago). Necesario para crear el pago: si el
// payment_method_id no coincide con la tarjeta real, MP rechaza el cobro.
export const buscarMetodoPago = async (bin) => {
  if (bin.length !== 6) throw new Error('El BIN debe ser de exactamente 6 dígitos.');
  asegurarPublicKey();
  const { data } = await mp.get('/v1/payment_methods/search', {
    params: { bin, public_key: MP_PUBLIC_KEY },
  });
  const resultado = data?.results?.[0];
  if (!resultado) return null;
  return {
    payment_method_id: resultado.id,
    issuer_id: resultado.issuer?.id || resultado.issuer_id || null,
    nombre: resultado.name,
    logo: resultado.secure_thumbnail || resultado.thumbnail,
  };
};

// ─── Tokeniza una tarjeta nueva capturada en el formulario ─────
export const tokenizarTarjetaNueva = async ({ numero, nombre, mes, anio, cvv }) => {
  asegurarPublicKey();
  const { data } = await mp.post('/v1/card_tokens', {
    card_number: numero.replace(/\s+/g, ''),
    cardholder: { name: nombre },
    expiration_month: Number(mes),
    expiration_year: Number(anio.length === 2 ? `20${anio}` : anio),
    security_code: cvv,
  }, { params: { public_key: MP_PUBLIC_KEY } });
  return data.id;
};

// ─── Tokeniza un pago con una tarjeta YA guardada, pidiendo solo el CVV ──
export const tokenizarTarjetaGuardada = async ({ mp_card_id, cvv }) => {
  asegurarPublicKey();
  const { data } = await mp.post('/v1/card_tokens', {
    card_id: mp_card_id,
    security_code: cvv,
  }, { params: { public_key: MP_PUBLIC_KEY } });
  return data.id;
};

export const mpConfigurado = () => !!MP_PUBLIC_KEY;
