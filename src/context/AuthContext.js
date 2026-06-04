import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { authAPI, usuariosAPI, negocioOnboardingAPI, setUnauthorizedCallback } from '../api/client';
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
  const [negocioId, setNegocioId] = useState(null);

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

  // Registra el callback de 401 para cierre de sesión automático cuando el JWT expira
  useEffect(() => {
    setUnauthorizedCallback(async () => {
      desconectarSocket();
      await SecureStore.deleteItemAsync('jwt').catch(() => {});
      setUsuario(null);
      setRoles(null);
    });
    return () => setUnauthorizedCallback(null);
  }, []);

  // Carga el ID del negocio cuando el usuario está en modo negocio
  useEffect(() => {
    if (!usuario?.id || usuario?.modo_activo !== 'negocio') {
      setNegocioId(null);
      return;
    }
    negocioOnboardingAPI.miNegocio()
      .then(({ data }) => {
        const neg = data?.data?.negocio;
        if (neg?.id && neg?.verificacion_estado === 'aprobado') {
          setNegocioId(neg.id);
        } else {
          setNegocioId(null);
        }
      })
      .catch(() => setNegocioId(null));
  }, [usuario?.id, usuario?.modo_activo]);

  // Listener global persistente: notifica nuevo_pedido al negocio aunque navegue entre pantallas
  useEffect(() => {
    if (!negocioId) return;
    const socket = conectarSocket();
    const unirse = () => socket.emit('unirse_negocio', negocioId);
    if (socket.connected) unirse();
    socket.on('connect', unirse);

    const onNuevo = () => {
      Vibration.vibrate([0, 400, 200, 400]);
      Notifications.scheduleNotificationAsync({
        content: {
          title: '🆕 ¡Nuevo pedido!',
          body: 'Tienes un pedido esperando confirmación. Ábrelo ahora.',
          sound: true,
          channelId: 'pedidos',
          data: { tipo: 'nuevo_pedido' },
        },
        trigger: null,
      }).catch(() => {});
    };

    socket.on('nuevo_pedido', onNuevo);
    return () => {
      socket.off('connect', unirse);
      socket.off('nuevo_pedido', onNuevo);
    };
  }, [negocioId]);

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
      } catch (e) {
        // Solo borramos el token si el servidor rechazó el JWT (401/403)
        // Errores de red (timeout, sin conexión) mantienen la sesión guardada
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          await SecureStore.deleteItemAsync('jwt').catch(() => {});
        }
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
