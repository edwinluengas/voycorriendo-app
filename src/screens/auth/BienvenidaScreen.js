import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, espacio, radio } from '../../theme/colors';
import usePlaza from '../../hooks/usePlaza';

const { height } = Dimensions.get('window');

export default function BienvenidaScreen({ navigation }) {
  // Sin sesion todavia: se muestra la plaza por defecto del backend.
  const plaza = usePlaza(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={estilos.contenedor}>
      {/* Mancha de color naranja decorativa */}
      <View style={estilos.fondoDecoración} pointerEvents="none" />
      <View style={estilos.fondoDecoración2} pointerEvents="none" />

      <Animated.View style={[estilos.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo VoyCorriendo — V blanca + punto naranja */}
        <View style={estilos.logoCirculo}>
          <Text style={estilos.logoV}>V</Text>
          <View style={estilos.logoDot} />
        </View>

        <Text style={estilos.marca}>VoyCorriendo</Text>
        <Text style={estilos.ciudad}>{plaza.nombre ? `${plaza.nombre} · ${plaza.estado}` : 'Oaxaca'}</Text>

        <View style={estilos.divisor} />

        <Text style={estilos.tagline}>
          Comida, medicinas y despensa{'\n'}directo a tu puerta.
        </Text>

        {/* Badges de confianza */}
        <View style={estilos.badges}>
          <View style={estilos.badge}><Text style={estilos.badgeTxt}>⚡ Rápido</Text></View>
          <View style={estilos.badge}><Text style={estilos.badgeTxt}>🔒 Seguro</Text></View>
          <View style={estilos.badge}><Text style={estilos.badgeTxt}>💳 Varios pagos</Text></View>
        </View>
      </Animated.View>

      <Animated.View style={[estilos.acciones, { opacity: fadeAnim }]}>
        <Pressable
          style={estilos.btnPrimario}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={estilos.btnPrimarioTxt}>Iniciar sesión</Text>
        </Pressable>

        <Pressable
          style={estilos.btnSecundario}
          onPress={() => navigation.navigate('Registro')}
        >
          <Text style={estilos.btnSecundarioTxt}>Crear una cuenta</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('PoliticaPrivacidad')}>
          <Text style={estilos.legal}>
            Al continuar aceptas nuestros{' '}
            <Text style={{ color: colors.primario, fontWeight: '700' }}>
              Términos y Aviso de Privacidad
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: espacio.lg,
  },

  fondoDecoración: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primario,
    opacity: 0.08,
  },
  fondoDecoración2: {
    position: 'absolute',
    bottom: 40,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primario,
    opacity: 0.05,
  },

  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoCirculo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.lg,
    shadowColor: colors.primario,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  logoV: {
    fontSize: 66,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 72,
    marginRight: 10,
  },
  logoDot: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  badges: {
    flexDirection: 'row',
    gap: espacio.sm,
    marginTop: espacio.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: '#FFF5EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radio.full,
    borderWidth: 1,
    borderColor: '#FFD4A8',
  },
  badgeTxt: {
    fontSize: 12,
    color: colors.primario,
    fontWeight: '700',
  },

  marca: {
    fontSize: 38,
    fontWeight: '900',
    color: colors.texto,
    letterSpacing: -0.5,
  },
  ciudad: {
    fontSize: 13,
    color: colors.primario,
    fontWeight: '700',
    marginTop: espacio.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  divisor: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primario,
    marginVertical: espacio.lg,
  },
  tagline: {
    fontSize: 17,
    color: colors.textoSuave,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },

  acciones: {
    paddingBottom: espacio.xl,
  },
  btnPrimario: {
    backgroundColor: colors.primario,
    borderRadius: radio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primario,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnPrimarioTxt: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnSecundario: {
    marginTop: espacio.sm,
    borderRadius: radio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borde,
    backgroundColor: colors.superficie,
  },
  btnSecundarioTxt: {
    color: colors.texto,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  legal: {
    fontSize: 11,
    color: colors.textoSuave,
    textAlign: 'center',
    marginTop: espacio.md,
    lineHeight: 16,
  },
});
