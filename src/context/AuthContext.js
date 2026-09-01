import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { authAPI, usuariosAPI, negocioOnboardingAPI, setUnauthorizedCallback } from '../api/client';
import { conectarSocket, desconectarSocket } from '../api/socket';
import { vaciarCarrito } from '../screens/cliente/NegocioScreen';

const AuthContext = createContext(null);

// Canales de Android — uno por tipo de notificación.
//
// PALETA: el acento NO repite el naranja de la app a propósito. En la barra
// de estado y en la bandeja, la notificación compite con el fondo del
// sistema —blanco en tema claro, casi negro en oscuro— y el naranja de
// marca se pierde contra ambos. Cada canal usa un color que además SIGNIFICA
// algo, así el color trabaja en vez de decorar:
//
//   verde  #00B341 → algo avanza (tu pedido se movió)
//   azul   #0B84FF → hay trabajo para ti (pedido disponible, asignación)
//   ámbar  #FFB020 → aviso que puede esperar
//   rojo   #E5484D → algo se rompió y hay que actuar
//
// La luz del LED, el color del icono pequeño y el tinte de la tarjeta salen
// de aquí, así que el mismo código de color se repite en los tres lugares
// donde el usuario lo puede ver.
const CANALES_ANDROID = [
  {
    id: 'pedidos',
    name: 'Mi pedido',
    description: 'Avisos de tu pedido: confirmado, en preparación, en camino y entregado.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#00B341',
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'repartidor',
    name: 'Trabajo disponible',
    description: 'Pedidos que puedes tomar y avisos de tus entregas en curso.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#0B84FF',
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'alertas',
    name: 'Requiere tu atención',
    description: 'Pagos rechazados, pedidos con problema y avisos de tu cuenta.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 200, 100, 200, 100, 200],
    lightColor: '#E5484D',
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'general',
    name: 'VoyCorriendo',
    description: 'Novedades y mensajes de la plataforma.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#FFB020',
    sound: 'default',
    showBadge: false,
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

  // `lada` = código de país sin '+' (default México). Los usuarios extranjeros
  // que viven/vacacionan en Puerto eligen el suyo en la pantalla de login.
  //
  // Las cuentas ADMIN llevan segundo factor obligatorio: el backend responde
  // `requiere_2fa` en vez de un token, y la pantalla debe pedir el código
  // que llegó por Telegram/SMS/correo y llamar a `completarSegundoFactor`.
  const iniciarSesion = async (telefono, password, lada = '52') => {
    const { data } = await authAPI.login({ telefono, password, lada });
    if (data?.requiere_2fa) {
      return { requiere2FA: true, canales: data.canales || [], vigenciaMin: data.vigencia_min };
    }
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    registrarPushToken();
    conectarSocket(token);   // reconectar con el nuevo JWT
    return user;
  };

  // Segundo paso del login de administrador. Se manda otra vez la contraseña
  // a propósito: si alguien alcanzara a ver el código (notificación en la
  // pantalla bloqueada, Telegram abierto en otra máquina), por sí solo no
  // le sirve de nada.
  const completarSegundoFactor = async (telefono, password, codigo, lada = '52') => {
    const { data } = await authAPI.loginSegundoFactor({ telefono, password, codigo, lada });
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    registrarPushToken();
    conectarSocket(token);
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

  // Tras restablecer la contraseña el backend devuelve un token nuevo — se
  // entra directo sin pedirle al usuario que escriba la contraseña otra vez.
  const entrarConToken = async (token, user) => {
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    registrarPushToken();
    conectarSocket(token);
    return user;
  };

  const cerrarSesion = async () => {
    desconectarSocket();
    vaciarCarrito();
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
      iniciarSesion, completarSegundoFactor, registrarse, cerrarSesion, entrarConToken,
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
