/**
 * VoyCorriendo — App móvil
 * Puerto Escondido, Oaxaca
 */
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { PlazaProvider } from './src/context/PlazaContext';
import RootNavigator from './src/navigation/RootNavigator';

export const navigationRef = createNavigationContainerRef();

// Muestra notificaciones aunque la app esté en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function navegarADestino(data) {
  if (!navigationRef.isReady() || !data?.tipo) return;
  if (data.tipo === 'estado_pedido' && data.pedidoId) {
    navigationRef.navigate('Seguimiento', { pedidoId: data.pedidoId });
  } else if (data.tipo === 'nuevo_pedido') {
    navigationRef.navigate('DashboardNegocio');
  } else if (data.tipo === 'pedido_disponible') {
    navigationRef.navigate('InicioRep');
  }
}

export default function App() {
  useEffect(() => {
    // 1. Notificación recibida en FOREGROUND → alerta in-app + opción de navegar
    const subRecibida = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (!data?.tipo) return;

      if (data.tipo === 'nuevo_pedido') {
        Alert.alert(
          '🆕 ¡Nuevo pedido!',
          'Tienes un nuevo pedido esperando confirmación.',
          [
            { text: 'Ver ahora', onPress: () => navegarADestino(data) },
            { text: 'Luego', style: 'cancel' },
          ],
        );
      } else if (data.tipo === 'pedido_disponible') {
        Alert.alert(
          '🛵 ¡Pedido disponible!',
          'Hay un pedido cerca de ti. ¡Tómalo antes que alguien más!',
          [
            { text: 'Ver ahora', onPress: () => navegarADestino(data) },
            { text: 'Luego', style: 'cancel' },
          ],
        );
      }
    });

    // 2. Usuario TOCA la notificación → navegar directamente
    const subTap = Notifications.addNotificationResponseReceivedListener((response) => {
      navegarADestino(response.notification.request.content.data);
    });

    return () => {
      subRecibida.remove();
      subTap.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlazaProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <RootNavigator />
          </NavigationContainer>
        </PlazaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
