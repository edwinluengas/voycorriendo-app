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
// de la industria). Necesario para crear el pago: si el payment_method_id
// no coincide con la tarjeta real, MP rechaza el cobro.
//
// CRÍTICO (verificado en vivo contra api.mercadopago.com, 2026-07-22): el
// parámetro del filtro es `bins` (PLURAL). Con `bin` (singular) el endpoint
// lo IGNORA en silencio y devuelve el catálogo completo de métodos de pago
// paginado, cuyo primer elemento es American Express — por eso cualquier
// tarjeta se "detectaba" como Amex. `status=active`, `marketplace=NONE` y
// `limit=1` son los mismos parámetros que manda el SDK JS oficial de MP y
// garantizan un único resultado exacto (distingue crédito/débito:
// master vs debmaster, visa vs debvisa).
export const buscarMetodoPago = async (bin) => {
  if (bin.length !== 6) throw new Error('El BIN debe ser de exactamente 6 dígitos.');
  asegurarPublicKey();
  const { data } = await mp.get('/v1/payment_methods/search', {
    params: { bins: bin, public_key: MP_PUBLIC_KEY, status: 'active', marketplace: 'NONE', limit: 1 },
  });
  const resultado = data?.results?.[0];
  if (!resultado) return null;
  return {
    payment_method_id: resultado.id,
    issuer_id: resultado.issuer?.id ? String(resultado.issuer.id) : (resultado.issuer_id || null),
    nombre: resultado.name,
    logo: resultado.secure_thumbnail || resultado.thumbnail,
    // Longitud de CVV según MP para esta tarjeta (3, o 4 en Amex).
    cvv_length: resultado.settings?.[0]?.security_code?.length || null,
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

export const mpConfigurado = () => !!MP_PUBLIC_KEY;
