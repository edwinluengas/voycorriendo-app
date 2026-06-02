import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, espacio, radio } from '../../theme/colors';

const WHATSAPP = '529541234567';
const EMAIL    = 'voycorriendoadmin@gmail.com';

export default function SoporteScreen({ navigation }) {
  const whatsapp = () => Linking.openURL(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola VoyCorriendo, necesito ayuda con un pedido')}`);
  const correo   = () => Linking.openURL(`mailto:${EMAIL}?subject=Soporte%20VoyCorriendo`);

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <Text style={estilos.hero}>👋</Text>
        <Text style={estilos.titulo}>Estamos aquí para ayudarte</Text>
        <Text style={estilos.subtitulo}>
          Cualquier problema con tu pedido, pago o repartidor — escríbenos de inmediato.
        </Text>

        <Opcion icono="💬" titulo="WhatsApp" desc="Chat rápido — respuesta en minutos" onPress={whatsapp} color="#25D366" />
        <Opcion icono="📧" titulo="Correo electrónico" desc={EMAIL} onPress={correo} color={colors.primario} />

        <Text style={estilos.seccion}>Preguntas frecuentes</Text>

        <Faq
          pregunta="¿Puedo cancelar un pedido?"
          respuesta="Sí, mientras el negocio aún no lo haya confirmado. Una vez que empezó la preparación, escríbenos por WhatsApp."
        />
        <Faq
          pregunta="¿Cuál es el límite para pagar en efectivo?"
          respuesta="El máximo para pagar en efectivo es $500 MXN. Si tu pedido supera ese monto, puedes pagar con tarjeta o Mercado Pago."
        />
        <Faq
          pregunta="¿Cuánto tarda mi pedido?"
          respuesta="La mayoría de pedidos llegan entre 20 y 45 minutos, dependiendo del negocio y de dónde estés en Puerto Escondido."
        />
        <Faq
          pregunta="¿Cómo me vuelvo repartidor?"
          respuesta="Crea una cuenta, ve a tu Perfil y activa el modo Repartidor. Sube tu INE, licencia y datos bancarios. Un operador valida tu perfil en 24-48 horas."
        />
        <Faq
          pregunta="¿Por qué me piden mi INE?"
          respuesta="Para productos con restricción de edad (alcohol, cigarros) la ley exige verificación de identidad. Tu INE solo se usa para ese fin."
        />
        <Faq
          pregunta="¿Qué es la Transferencia bancaria?"
          respuesta="La transferencia SPEI está disponible únicamente para compras en la Tienda Oficial VoyCorriendo Store. Para restaurantes y tiendas locales usa efectivo, tarjeta o Mercado Pago."
        />

        <Pressable
          style={estilos.politicaBtn}
          onPress={() => navigation?.navigate?.('PoliticaPrivacidad')}
        >
          <Text style={estilos.politicaBtnTxt}>📄 Política de privacidad y términos de uso</Text>
        </Pressable>

        <Text style={estilos.contactoFinal}>
          ¿No encontraste tu respuesta? Escríbenos:{'\n'}
          <Text style={{ color: colors.primario, fontWeight: '700' }}>{EMAIL}</Text>
        </Text>
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
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto, textAlign: 'center', marginTop: espacio.sm },
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
  faq: { backgroundColor: colors.superficie, padding: espacio.md, borderRadius: radio.sm, marginBottom: espacio.xs },
  faqP: { fontSize: 14, fontWeight: '700', color: colors.texto, marginBottom: espacio.xs },
  faqR: { fontSize: 13, color: colors.textoSuave, lineHeight: 19 },
  politicaBtn: {
    marginTop: espacio.lg, padding: espacio.md,
    backgroundColor: '#EFF6FF', borderRadius: radio.md,
    borderWidth: 1, borderColor: '#3B82F6', alignItems: 'center',
  },
  politicaBtnTxt: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  contactoFinal: { marginTop: espacio.lg, fontSize: 13, color: colors.textoSuave, textAlign: 'center', lineHeight: 20 },
});
