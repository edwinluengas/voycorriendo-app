/**
 * VoyCorriendo — App móvil
 * Puerto Escondido, Oaxaca
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export const navigationRef = createNavigationContainerRef();

// Muestra notificaciones aunque la app esté en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!navigationRef.isReady() || !data?.tipo) return;

      if (data.tipo === 'estado_pedido' && data.pedidoId) {
        navigationRef.navigate('Seguimiento', { pedidoId: data.pedidoId });
      } else if (data.tipo === 'nuevo_pedido') {
        navigationRef.navigate('DashboardNegocio');
      } else if (data.tipo === 'pedido_disponible') {
        navigationRef.navigate('InicioRep');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="light" backgroundColor="#0F0F0F" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
