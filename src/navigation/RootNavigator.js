import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Pantallas Auth
import BienvenidaScreen from '../screens/auth/BienvenidaScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistroScreen from '../screens/auth/RegistroScreen';

// Pantallas Cliente
import InicioClienteScreen from '../screens/cliente/InicioClienteScreen';
import NegocioScreen from '../screens/cliente/NegocioScreen';
import CarritoScreen from '../screens/cliente/CarritoScreen';
import PagoScreen from '../screens/cliente/PagoScreen';
import SeguimientoScreen from '../screens/cliente/SeguimientoScreen';
import MisPedidosScreen from '../screens/cliente/MisPedidosScreen';
import PerfilScreen from '../screens/cliente/PerfilScreen';
import SoporteScreen from '../screens/cliente/SoporteScreen';

// Pantallas Repartidor
import InicioRepartidorScreen    from '../screens/repartidor/InicioRepartidorScreen';
import PedidoActivoScreen        from '../screens/repartidor/PedidoActivoScreen';
import MisEntregasScreen         from '../screens/repartidor/MisEntregasScreen';
import OnboardingRepartidorScreen from '../screens/repartidor/OnboardingRepartidorScreen';
import TierScreen                from '../screens/repartidor/TierScreen';

// Pantallas Negocio (dueño de la tienda/restaurante)
import DashboardNegocioScreen      from '../screens/negocio/DashboardNegocioScreen';
import PedidoDetalleNegocioScreen  from '../screens/negocio/PedidoDetalleNegocioScreen';
import OnboardingNegocioScreen     from '../screens/negocio/OnboardingNegocioScreen';
import TokenesScreen               from '../screens/negocio/TokenesScreen';
import FotosNegocioScreen          from '../screens/negocio/FotosNegocioScreen';
import ProductosNegocioScreen      from '../screens/negocio/ProductosNegocioScreen';

// Pantallas Admin
import AprobacionesScreen from '../screens/admin/AprobacionesScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Stack de autenticación ──────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Bienvenida" component={BienvenidaScreen} />
    <Stack.Screen name="Login"      component={LoginScreen} />
    <Stack.Screen name="Registro"   component={RegistroScreen} />
  </Stack.Navigator>
);

// ─── Tabs del Cliente ────────────────────────────────────
const ClienteTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primario,
        tabBarInactiveTintColor: colors.textoSuave,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: 6 + bottomInset,
          height: 62 + bottomInset,
          backgroundColor: colors.superficie,
          borderTopColor: colors.borde,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        headerStyle: { backgroundColor: colors.oscuro },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '800', letterSpacing: 0.2 },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={InicioClienteScreen}
        options={{
          title: '¿Qué se te antoja?',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MisPedidos"
        component={MisPedidosScreen}
        options={{
          title: 'Mis pedidos',
          tabBarLabel: 'Pedidos',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Soporte"
        component={SoporteScreen}
        options={{
          title: 'Ayuda 24/7',
          tabBarLabel: 'Ayuda',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'help-buoy' : 'help-buoy-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          title: 'Mi perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Stack del Cliente (tabs + detalles) ─────────────────
const ClienteStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.oscuro },
      headerTintColor: '#FFF',
      headerTitleStyle: { fontWeight: '800', letterSpacing: 0.2 },
    }}
  >
    <Stack.Screen name="Home"        component={ClienteTabs}       options={{ headerShown: false }} />
    <Stack.Screen name="Negocio"     component={NegocioScreen}     options={{ title: 'Menú' }} />
    <Stack.Screen name="Carrito"     component={CarritoScreen}     options={{ title: 'Tu carrito' }} />
    <Stack.Screen name="Pago"        component={PagoScreen}        options={{ title: 'Forma de pago' }} />
    <Stack.Screen name="Seguimiento" component={SeguimientoScreen} options={{ title: 'Tu pedido' }} />
    <Stack.Screen
      name="OnboardingRepartidor"
      component={OnboardingRepartidorScreen}
      options={{ title: 'Quiero ser repartidor' }}
    />
    <Stack.Screen
      name="OnboardingNegocio"
      component={OnboardingNegocioScreen}
      options={{ title: 'Registra tu negocio' }}
    />
  </Stack.Navigator>
);

// ─── Tabs del Repartidor ─────────────────────────────────
const RepartidorTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.secundario,
        tabBarInactiveTintColor: colors.textoSuave,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: 6 + bottomInset,
          height: 62 + bottomInset,
          backgroundColor: colors.oscuro,
          borderTopColor: colors.bordeOscuro,
          elevation: 12,
        },
        headerStyle: { backgroundColor: colors.oscuro },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tab.Screen
        name="Pedidos"
        component={InicioRepartidorScreen}
        options={{
          title: 'Pedidos disponibles',
          tabBarLabel: 'Pedidos',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MisEntregas"
        component={MisEntregasScreen}
        options={{
          title: 'Mis entregas',
          tabBarLabel: 'Entregas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'cash' : 'cash-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// ─── Stack del Repartidor ────────────────────────────────
const RepartidorStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.oscuro },
      headerTintColor: '#FFF',
      headerTitleStyle: { fontWeight: '800' },
    }}
  >
    <Stack.Screen name="InicioRep"    component={RepartidorTabs}        options={{ headerShown: false }} />
    <Stack.Screen name="PedidoActivo" component={PedidoActivoScreen}    options={{ title: 'Pedido en curso' }} />
    <Stack.Screen name="Tier"         component={TierScreen}            options={{ title: 'Tipo de cobro' }} />
    <Stack.Screen
      name="OnboardingRepartidor"
      component={OnboardingRepartidorScreen}
      options={{ title: 'Completa tu registro' }}
    />
    <Stack.Screen name="Perfil"       component={PerfilScreen}          options={{ title: 'Mi perfil' }} />
    {/* Alias "Inicio" para compatibilidad con navigation.replace('Inicio') en PedidoActivoScreen */}
    <Stack.Screen name="Inicio"       component={RepartidorTabs}        options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ─── Stack del dueño del Negocio ─────────────────────────
const NegocioStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.oscuro },
      headerTintColor: '#FFF',
      headerTitleStyle: { fontWeight: '800' },
    }}
  >
    <Stack.Screen name="DashboardNegocio"     component={DashboardNegocioScreen}     options={{ title: 'Mis pedidos' }} />
    <Stack.Screen name="PedidoDetalleNegocio" component={PedidoDetalleNegocioScreen}  options={{ title: 'Detalle del pedido' }} />
    <Stack.Screen name="Tokens"               component={TokenesScreen}               options={{ title: 'Tokens' }} />
    <Stack.Screen name="FotosNegocio"         component={FotosNegocioScreen}          options={{ title: 'Fotos del negocio' }} />
    <Stack.Screen name="ProductosNegocio"     component={ProductosNegocioScreen}      options={{ title: 'Mis productos' }} />
    <Stack.Screen name="Perfil"               component={PerfilScreen}                options={{ title: 'Mi perfil' }} />
    <Stack.Screen name="OnboardingNegocio"    component={OnboardingNegocioScreen}     options={{ title: 'Completa tu negocio' }} />
  </Stack.Navigator>
);

// ─── Stack Admin ─────────────────────────────────────────
const AdminStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.oscuro },
      headerTintColor: '#FFF',
      headerTitleStyle: { fontWeight: '800' },
    }}
  >
    <Stack.Screen
      name="Aprobaciones"
      component={AprobacionesScreen}
      options={{ title: 'Panel de administración' }}
    />
  </Stack.Navigator>
);

// ─── Root ────────────────────────────────────────────────
export default function RootNavigator() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.oscuro }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  if (!usuario) return <AuthStack />;

  const modo = usuario.modo_activo || usuario.rol || 'cliente';
  if (modo === 'admin')       return <AdminStack />;
  if (modo === 'repartidor')  return <RepartidorStack />;
  if (modo === 'negocio')     return <NegocioStack />;
  return <ClienteStack />;
}
