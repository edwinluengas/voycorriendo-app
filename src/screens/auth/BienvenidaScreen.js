import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, espacio, radio } from '../../theme/colors';

const { height } = Dimensions.get('window');

export default function BienvenidaScreen({ navigation }) {
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
      <View style={estilos.fondoDecoración} />
      <View style={estilos.fondoDecoración2} />

      <Animated.View style={[estilos.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={estilos.logoCirculo}>
          <Text style={estilos.logoEmoji}>🛵</Text>
        </View>

        <Text style={estilos.marca}>VoyCorriendo</Text>
        <Text style={estilos.ciudad}>Puerto Escondido · Oaxaca</Text>

        <View style={estilos.divisor} />

        <Text style={estilos.tagline}>
          Comida, medicinas y despensa{'\n'}directo a tu puerta.
        </Text>
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

        <Text style={estilos.legal}>
          Al continuar aceptas nuestros Términos y el Aviso de Privacidad.
        </Text>
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
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoEmoji: { fontSize: 58 },

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
