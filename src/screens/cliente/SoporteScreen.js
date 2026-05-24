import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, espacio, radio } from '../../theme/colors';

const TELEFONO = '5555555555';
const WHATSAPP = '525555555555';
const EMAIL    = 'ayuda@voycorriendo.mx';

export default function SoporteScreen() {
  const llamar    = () => Linking.openURL(`tel:${TELEFONO}`);
  const whatsapp  = () => Linking.openURL(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, necesito ayuda con un pedido')}`);
  const correo    = () => Linking.openURL(`mailto:${EMAIL}`);

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <Text style={estilos.hero}>👋</Text>
        <Text style={estilos.titulo}>Estamos aquí 24/7</Text>
        <Text style={estilos.subtitulo}>
          Cualquier problema con tu pedido, pago o repartidor — contáctanos de inmediato.
        </Text>

        <Opcion
          icono="📞"
          titulo="Llamar a soporte"
          desc="Respuesta inmediata"
          onPress={llamar}
          color={colors.exito}
        />
        <Opcion
          icono="💬"
          titulo="WhatsApp"
          desc="Chat 24 horas"
          onPress={whatsapp}
          color="#25D366"
        />
        <Opcion
          icono="📧"
          titulo="Correo"
          desc={EMAIL}
          onPress={correo}
          color={colors.primario}
        />

        <Text style={estilos.seccion}>Preguntas frecuentes</Text>
        <Faq
          pregunta="¿Puedo cancelar un pedido?"
          respuesta="Sí, mientras el negocio aún no lo haya confirmado. Si ya empezó la preparación, llámanos y vemos qué podemos hacer."
        />
        <Faq
          pregunta="¿Por qué mi pago en efectivo fue rechazado?"
          respuesta="Tenemos un límite de $1,000 MXN para pagos en efectivo. Si tu pedido es mayor, usa tarjeta, transferencia o Mercado Pago."
        />
        <Faq
          pregunta="¿Cuánto tarda mi pedido?"
          respuesta="La mayoría de pedidos llegan entre 20 y 45 minutos, dependiendo del negocio y de dónde estés en Puerto Escondido."
        />
        <Faq
          pregunta="¿Cómo me vuelvo repartidor?"
          respuesta="Crea una cuenta como repartidor, sube INE, licencia y datos bancarios, y un operador validará tu perfil en 24 a 48 horas."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const Opcion = ({ icono, titulo, desc, onPress, color }) => (
  <Pressable style={[estilos.opcion, { borderLeftColor: color }]} onPress={onPress}>
    <Text style={estilos.opcionIcono}>{icono}</Text>
    <View style={{ flex: 1, marginLeft: espacio.md }}>
      <Text style={estilos.opcionTit}>{titulo}</Text>
      <Text style={estilos.opcionDesc}>{desc}</Text>
    </View>
    <Text style={estilos.opcionFlecha}>›</Text>
  </Pressable>
);

const Faq = ({ pregunta, respuesta }) => (
  <View style={estilos.faq}>
    <Text style={estilos.faqP}>❓ {pregunta}</Text>
    <Text style={estilos.faqR}>{respuesta}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },
  hero: { fontSize: 64, textAlign: 'center' },
  titulo: { fontSize: 26, fontWeight: '800', color: colors.texto, textAlign: 'center', marginTop: espacio.sm },
  subtitulo: { fontSize: 14, color: colors.textoSuave, textAlign: 'center', marginBottom: espacio.lg, lineHeight: 20 },
  opcion: {
    flexDirection: 'row', alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    borderLeftWidth: 4,
    marginBottom: espacio.sm,
  },
  opcionIcono: { fontSize: 32 },
  opcionTit: { fontSize: 16, fontWeight: '700', color: colors.texto },
  opcionDesc: { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  opcionFlecha: { fontSize: 24, color: colors.textoSuave },
  seccion: { fontSize: 18, fontWeight: '700', color: colors.texto, marginTop: espacio.xl, marginBottom: espacio.sm },
  faq: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.sm,
    marginBottom: espacio.xs,
  },
  faqP: { fontSize: 14, fontWeight: '700', color: colors.texto, marginBottom: espacio.xs },
  faqR: { fontSize: 13, color: colors.textoSuave, lineHeight: 19 },
});
