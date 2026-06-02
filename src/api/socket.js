import { io } from 'socket.io-client';
import Constants from 'expo-constants';

const SOCKET_URL =
  Constants.expoConfig?.extra?.socketUrl ||
  'https://voycorriendo-backend-production.up.railway.app';

let socket = null;

// Conecta (o reconecta) enviando el JWT al backend.
// El backend lo valida en el middleware de Socket.io.
export const conectarSocket = (token) => {
  // Si ya hay un socket autenticado con el mismo token, reutilizarlo
  if (socket?.connected && !token) return socket;

  // Si llega un token nuevo (login/switch), desconectar el anterior
  if (socket && token) {
    socket.disconnect();
    socket = null;
  }

  const opts = {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  };

  if (token) opts.auth = { token };

  socket = io(SOCKET_URL, opts);
  socket.on('connect',    () => console.log('[Socket] Conectado:', socket.id));
  socket.on('disconnect', (r) => console.log('[Socket] Desconectado:', r));
  socket.on('connect_error', (e) => console.log('[Socket] Error de conexión:', e?.message));
  return socket;
};

export const desconectarSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
