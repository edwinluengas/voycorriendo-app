import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { authAPI, usuariosAPI } from '../api/client';
import { conectarSocket, desconectarSocket } from '../api/socket';

const AuthContext = createContext(null);

// Canales de Android — uno por tipo de notificación
const CANALES_ANDROID = [
  {
    id: 'pedidos',
    name: 'Pedidos',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#FF5C00',
    sound: 'default',
  },
  {
    id: 'repartidor',
    name: 'Repartidor',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#00B341',
    sound: 'default',
  },
  {
    id: 'general',
    name: 'VoyCorriendo',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF5C00',
    sound: 'default',
  },
];

const configurarCanalesAndroid = async () => {
  if (Platform.OS !== 'android') return;
  for (const canal of CANALES_ANDROID) {
    await Notifications.setNotificationChannelAsync(canal.id, canal).catch(() => {});
  }
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [roles, setRoles]     = useState(null);
  const [cargando, setCargando] = useState(true);

  const registrarPushToken = useCallback(async () => {
    try {
      await configurarCanalesAndroid();
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : {}
      );
      if (pushToken) await usuariosAPI.guardarPushToken(pushToken);
    } catch (e) {
      console.log('[Push] No se pudo registrar token:', e?.message);
    }
  }, []);

  // Carga inicial — verifica JWT guardado
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        if (token) {
          const { data } = await authAPI.yo();
          const user = data.data?.usuario || data.usuario || null;
          setUsuario(user);
          if (user) {
            await cargarRoles();
            registrarPushToken();
            conectarSocket(token);
          }
        }
      } catch (_) {
        await SecureStore.deleteItemAsync('jwt');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const cargarRoles = useCallback(async () => {
    try {
      const { data } = await usuariosAPI.misRoles();
      setRoles(data.data?.roles || null);
      const modo = data.data?.modo_activo;
      if (modo) setUsuario(u => (u ? { ...u, modo_activo: modo } : u));
      return data.data;
    } catch (e) {
      console.log('[Auth] No se pudieron cargar roles:', e?.mensajeAmigable);
      return null;
    }
  }, []);

  const iniciarSesion = async (telefono, password) => {
    const { data } = await authAPI.login({ telefono, password });
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    registrarPushToken();
    conectarSocket(token);   // reconectar con el nuevo JWT
    return user;
  };

  const registrarse = async (datos) => {
    const { data } = await authAPI.registro(datos);
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    registrarPushToken();
    conectarSocket(token);
    return user;
  };

  const cerrarSesion = async () => {
    desconectarSocket();
    await SecureStore.deleteItemAsync('jwt');
    setUsuario(null);
    setRoles(null);
  };

  const refrescarUsuario = useCallback(async () => {
    try {
      const { data } = await authAPI.yo();
      const user = data.data?.usuario || data.usuario || null;
      if (user) setUsuario(user);
    } catch (_) {}
  }, []);

  const cambiarModo = async (modo) => {
    const { data } = await usuariosAPI.cambiarModo(modo);
    const nuevoModo = data.data?.modo_activo || modo;
    setUsuario(u => (u ? { ...u, modo_activo: nuevoModo } : u));
    return nuevoModo;
  };

  return (
    <AuthContext.Provider value={{
      usuario, roles, cargando,
      iniciarSesion, registrarse, cerrarSesion,
      cambiarModo, cargarRoles, refrescarUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
