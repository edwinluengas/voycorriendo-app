/**
 * Cliente API para VoyCorriendo
 * Se conecta al backend Express. Lee la URL de app.json → extra.apiUrl.
 * Adjunta automáticamente el JWT guardado en SecureStore.
 */
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'https://voycorriendo-backend-production.up.railway.app';
const API_URL = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
// Log para diagnostico - nos dice a que URL se esta conectando la app
console.log('🌐 [VoyCorriendo] API_URL configurada:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

// Log de cada request saliente
api.interceptors.request.use((config) => {
  console.log(`📤 [VoyCorriendo] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
}, (error) => {
  console.log('❌ [VoyCorriendo] Error en request:', error.message);
  return Promise.reject(error);
});

// Interceptor: agrega token JWT si existe
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Callback registrado por AuthContext para manejar cierre de sesión automático en 401
let _onUnauthorized = null;
export const setUnauthorizedCallback = (fn) => { _onUnauthorized = fn; };

// Interceptor: manejo de errores en español (con logs detallados)
api.interceptors.response.use(
  (resp) => {
    console.log(`✅ [VoyCorriendo] ${resp.status} ${resp.config.url}`);
    return resp;
  },
  (error) => {
    // Log detallado para diagnosticar problemas de red
    console.log('❌ [VoyCorriendo] RESPONSE ERROR:');
    console.log('   code:', error.code);
    console.log('   message:', error.message);
    console.log('   status:', error.response?.status);
    console.log('   data:', JSON.stringify(error.response?.data));
    console.log('   url:', error.config?.url);

    // JWT expirado o inválido → cerrar sesión automáticamente
    if (error.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }

    // El usuario debe VER el motivo real. Antes, cualquier respuesta sin
    // campo `mensaje` (por ejemplo las validaciones de express-validator, que
    // llegan como { ok:false, errores:[{msg}] }) caía en el genérico "no
    // pudimos conectarnos al servidor" — y parecía un problema de internet
    // cuando en realidad era un dato mal escrito en el formulario.
    const datos = error.response?.data;
    const detalleValidacion = Array.isArray(datos?.errores) && datos.errores.length
      ? datos.errores.map((e) => e.msg || e.mensaje || e.message).filter(Boolean).join('\n• ')
      : null;

    let mensaje;
    if (datos?.mensaje) {
      mensaje = datos.mensaje;
    } else if (detalleValidacion) {
      mensaje = datos.errores.length > 1 ? `• ${detalleValidacion}` : detalleValidacion;
    } else if (error.response) {
      // Hubo respuesta del servidor pero sin cuerpo entendible: se informa el
      // código real en vez de culpar a la conexión.
      mensaje = error.response.status >= 500
        ? `El servidor tuvo un problema (error ${error.response.status}). Intenta de nuevo en un momento.`
        : `El servidor rechazó la solicitud (error ${error.response.status}).`;
    } else if (error.code === 'ECONNABORTED') {
      mensaje = 'La conexión tardó demasiado. Revisa tu internet e intenta de nuevo.';
    } else {
      mensaje = `No pudimos conectarnos al servidor (${error.code || error.message || 'sin respuesta'}). Revisa tu internet.`;
    }

    return Promise.reject({
      ...error,
      mensajeAmigable: mensaje,
      campoError: datos?.campo || null,
      codigoError: datos?.codigo || null,
    });
  }
);

// ─── Endpoints helpers ────────────────────────────────────────

export const authAPI = {
  registro: (data) => api.post('/auth/registro', data),
  login:    (data) => api.post('/auth/login', data),
  yo:       ()     => api.get('/auth/perfil'),
  // Recuperación de contraseña: pide código por SMS o correo, y luego lo canjea
  // por una contraseña nueva (el backend devuelve token, se entra directo).
  recuperarPassword:   (data) => api.post('/auth/recuperar-password', data),
  restablecerPassword: (data) => api.post('/auth/restablecer-password', data),
};

export const negociosAPI = {
  listar:     ()      => api.get('/negocios'),
  detalle:    (id)    => api.get(`/negocios/${id}`),
  productos:  async (id) => {
    const resp = await api.get(`/negocios/${id}`);
    const productos = resp.data?.data?.negocio?.productos || [];
    return { data: { data: { productos } } };
  },
  buscar:     (texto) => api.get(`/negocios?buscar=${encodeURIComponent(texto)}`),
  actualizarProducto: (negocioId, productoId, data) =>
    api.put(`/negocios/${negocioId}/productos/${productoId}`, data),
};

export const pedidosAPI = {
  crear:       (data)        => api.post('/pedidos', data),
  misPedidos:  ()            => api.get('/pedidos'),
  detalle:     (id)          => api.get(`/pedidos/${id}`),
  // Cotiza costo de envío y zona antes de crear el pedido
  cotizar:     (negocio_id, lat, lng, tipo_envio = 'standard') =>
    api.get('/pedidos/cotizar', { params: { negocio_id, lat, lng, tipo_envio } }),
  // Cancelar = transición de estado a 'cancelado' (solo el cliente puede hacerla mientras el pedido esté pendiente)
  cancelar:    (id, motivo)  => api.patch(`/pedidos/${id}/estado`, { estado: 'cancelado', nota: motivo }),
  calificar:   (id, data)    => api.post(`/pedidos/${id}/calificar`, data),
  // Sube la foto del INE a Supabase Storage y devuelve la URL pública
  subirFotoINE: (base64, mime) => api.post('/pedidos/ine-foto', { base64, mime }),
  // Actualización genérica de estado (usada por negocio y repartidor)
  actualizarEstado: (id, estado, nota, extra = {}) =>
    api.patch(`/pedidos/${id}/estado`, { estado, nota, ...extra }),
};

// Endpoints para el dueño de un negocio (rol === 'negocio')
export const negocioDashboardAPI = {
  // ?estado=pendiente,confirmado,preparando,listo,en_camino,entregado,cancelado,rechazado
  misPedidos: (estado) =>
    api.get('/pedidos/negocio/mis-pedidos', { params: estado ? { estado } : {} }),
};

// Onboarding y operacion del negocio (modo dueno de tienda/restaurante)
export const negocioOnboardingAPI = {
  // ── Wizard ──
  activarModo:       ()                    => api.post('/negocios/activar'),
  miNegocio:         ()                    => api.get('/negocios/mi-negocio'),
  actualizarPerfil:  (data)                => api.patch('/negocios/mi-negocio', data),
  subirDocumento:    (tipo, base64, mime)  =>
    api.post('/negocios/documento', { tipo, base64, mime }),
  enviarARevision:   ()                    => api.post('/negocios/enviar-a-revision'),
  // ── Abrir/cerrar negocio (estilo Go Online) ──
  cambiarApertura:   (abierto)             => api.patch('/negocios/apertura', { abierto }),
  // ── Gestión de productos ──
  misProductos:      ()                    => api.get('/negocios/mi-negocio/productos'),
  crearProducto:     (data)                => api.post('/negocios/mi-negocio/productos', data),
  actualizarProducto: (id, data)           => api.patch(`/negocios/mi-negocio/productos/${id}`, data),
  eliminarProducto:  (id)                  => api.delete(`/negocios/mi-negocio/productos/${id}`),
  subirFotoProducto: (id, base64, mime)    => api.post(`/negocios/mi-negocio/productos/${id}/foto`, { base64, mime }),
  ganancias:         ()                    => api.get('/negocios/mi-negocio/ganancias'),
  pagarDeuda:        (referencia_spei, monto) => api.post('/negocios/mi-negocio/pagar-deuda', { referencia_spei, monto }),
  retiroDiario:      ()                    => api.post('/negocios/mi-negocio/retiro-diario'),
};

export const pagosAPI = {
  preferencia:     (pedido_id)                         => api.post('/pagos/preferencia', { pedido_id }),
  efectivo:        (pedido_id, monto_recibido)         => api.post('/pagos/efectivo', { pedido_id, monto_recibido }),
  transferencia:   (pedido_id, referencia, comprobante)=> api.post('/pagos/transferencia', { pedido_id, referencia, comprobante_url: comprobante }),
  tarjeta:         (payload)                           => api.post('/pagos/tarjeta', payload),
};

export const tarjetasAPI = {
  listar:   ()       => api.get('/tarjetas'),
  agregar:  (token)  => api.post('/tarjetas', { token }),
  eliminar: (id)      => api.delete(`/tarjetas/${id}`),
};

// Multi-rol (estilo Uber/Rappi): consultar y cambiar modo activo
export const usuariosAPI = {
  misRoles:              ()           => api.get('/usuarios/mis-roles'),
  cambiarModo:           (modo)       => api.post('/usuarios/cambiar-modo', { modo }),
  guardarPushToken:      (token)      => api.patch('/usuarios/push-token', { token }),
  misDirecciones:        ()           => api.get('/usuarios/mis-direcciones'),
  agregarDireccion:      (data)       => api.post('/usuarios/mis-direcciones', data),
  eliminarDireccion:     (id)         => api.delete(`/usuarios/mis-direcciones/${id}`),
  misCalificaciones:     ()           => api.get('/usuarios/mis-calificaciones'),
  getMetodoPagoDefault:  ()           => api.get('/usuarios/metodo-pago-default'),
  setMetodoPagoDefault:  (metodo)     => api.patch('/usuarios/metodo-pago-default', { metodo }),
  getNotificaciones:     ()           => api.get('/usuarios/notificaciones'),
  setNotificaciones:     (prefs)      => api.patch('/usuarios/notificaciones', prefs),
};

export const repartidoresAPI = {
  activarModo:       ()                   => api.post('/repartidores/activar'),
  actualizarPerfil:  (data)               => api.patch('/repartidores/perfil', data),
  miPerfil:          ()                   => api.get('/repartidores/mi-perfil'),
  subirFoto:         (tipo, base64, mime) => api.post('/repartidores/foto', { tipo, base64, mime }),
  enviarARevision:   ()                   => api.post('/repartidores/enviar-a-revision'),
  conectarse:        (conectado, lat, lng) =>
    api.patch('/repartidores/conectarse', { conectado, latitud: lat, longitud: lng }),
  ubicacion:         (lat, lng)           =>
    api.patch('/repartidores/conectarse', { conectado: true, latitud: lat, longitud: lng }),
  pedidosDisponibles: ()                   => api.get('/repartidores/pedidos-disponibles'),
  aceptarPedido:      (pedido_id)          => api.post('/repartidores/aceptar-pedido', { pedido_id }),
  marcarRecogido:     (pedido_id)          => api.patch(`/repartidores/pedidos/${pedido_id}/recogido`),
  actualizarEstado:   (pedido_id, estado, extra = {}) => api.patch(`/pedidos/${pedido_id}/estado`, { estado, ...extra }),
  disponibilidad:     (disponible, lat, lng) =>
    api.patch('/repartidores/disponibilidad', { disponible, latitud: lat, longitud: lng }),
  misEntregas:        ()                   => api.get('/repartidores/mis-entregas'),
  miRuta:             ()                   => api.get('/repartidores/mi-ruta'),
  crearPerfil:        (data)               => api.post('/repartidores/perfil', data),
  ganancias:          ()                   => api.get('/repartidores/ganancias'),
  solicitarDeposito:  ()                   => api.post('/repartidores/solicitar-deposito'),
  retiroDiario:       ()                   => api.post('/repartidores/retiro-diario'),
};

export const adminAPI = {
  dashboard:          ()                    => api.get('/admin/dashboard'),
  obtenerNegocio:     (id)                  => api.get(`/admin/negocios/${id}`),
  aprobarNegocio:     (id)                  => api.patch(`/admin/negocios/${id}/aprobar`),
  rechazarNegocio:    (id, motivo)          => api.patch(`/admin/negocios/${id}/rechazar`, { motivo }),
  obtenerRepartidor:  (id)                  => api.get(`/admin/repartidores/${id}`),
  aprobarRepartidor:  (id)                  => api.patch(`/admin/repartidores/${id}/aprobar`),
  rechazarRepartidor: (id, motivo)          => api.patch(`/admin/repartidores/${id}/rechazar`, { motivo }),
  revenue:            (periodo = 'semana')  => api.get('/admin/revenue', { params: { periodo } }),
  usuarios:           (buscar)              => api.get('/admin/usuarios', { params: buscar ? { buscar } : {} }),
};

export const telegramAPI = {
  vincularLink: () => api.get('/telegram/vincular-link'),
};

export default api;
