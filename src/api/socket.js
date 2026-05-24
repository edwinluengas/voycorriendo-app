/**
 * Cliente Socket.io para tracking de pedidos en tiempo real
 */
import { io } from 'socket.io-client';
import Constants from 'expo-constants';

const SOCKET_URL = Constants.expoConfig?.extra?.socketUrl || 'https://voycorriendo-backend-production.up.railway.app';

let socket = null;

export const conectarSocket = () => {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  });
  socket.on('connect',    () => console.log('🟢 Socket conectado'));
  socket.on('disconnect', () => console.log('🔴 Socket desconectado'));
  return socket;
};

export const desconectarSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
