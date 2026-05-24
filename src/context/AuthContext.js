/**
 * Contexto de autenticación - guarda el usuario, su JWT y su MODO activo
 *
 * Multi-rol (estilo Uber/Rappi): un mismo usuario puede ser cliente,
 * repartidor y/o dueño de negocio. El campo `usuario.modo_activo` define
 * que tabs ve la app en este momento.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI, usuariosAPI } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [roles, setRoles] = useState(null);     // {cliente:{}, repartidor:{}, negocio:{}}
  const [cargando, setCargando] = useState(true);

  // Carga inicial: verifica si hay sesion guardada
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        if (token) {
          const { data } = await authAPI.yo();
          const user = data.data?.usuario || data.usuario || null;
          setUsuario(user);
          if (user) await cargarRoles();
        }
      } catch (_) {
        await SecureStore.deleteItemAsync('jwt');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Trae los roles del usuario desde el backend
  const cargarRoles = useCallback(async () => {
    try {
      const { data } = await usuariosAPI.misRoles();
      setRoles(data.data?.roles || null);
      // Sincroniza modo_activo del backend con el state local
      const modo = data.data?.modo_activo;
      if (modo) {
        setUsuario(u => (u ? { ...u, modo_activo: modo } : u));
      }
      return data.data;
    } catch (e) {
      console.log('No se pudieron cargar los roles:', e?.mensajeAmigable);
      return null;
    }
  }, []);

  const iniciarSesion = async (telefono, password) => {
    const { data } = await authAPI.login({ telefono, password });
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    return user;
  };

  const registrarse = async (datos) => {
    const { data } = await authAPI.registro(datos);
    const { token, usuario: user } = data.data || data;
    await SecureStore.setItemAsync('jwt', token);
    setUsuario(user);
    await cargarRoles();
    return user;
  };

  const cerrarSesion = async () => {
    await SecureStore.deleteItemAsync('jwt');
    setUsuario(null);
    setRoles(null);
  };

  // Cambia el modo activo (cliente/repartidor/negocio)
  // El backend valida que el usuario tenga ese rol aprobado.
  const cambiarModo = async (modo) => {
    const { data } = await usuariosAPI.cambiarModo(modo);
    const nuevoModo = data.data?.modo_activo || modo;
    setUsuario(u => (u ? { ...u, modo_activo: nuevoModo } : u));
    return nuevoModo;
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      roles,
      cargando,
      iniciarSesion,
      registrarse,
      cerrarSesion,
      cambiarModo,
      cargarRoles,
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
