import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, espacio, radio } from '../../theme/colors';
import { LIMITE_EFECTIVO } from '../../config/businessRules';

const EMAIL = 'voycorriendoadmin@gmail.com';

export default function PoliticaPrivacidadScreen() {
  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        <Text style={estilos.titulo}>Política de Privacidad y Términos de Uso</Text>
        <Text style={estilos.fecha}>Última actualización: Junio 2026</Text>

        <Seccion titulo="1. Quiénes somos">
          VoyCorriendo es un servicio de entregas a domicilio con sede en Puerto Escondido,
          Oaxaca, México. Operamos como intermediario entre negocios locales, repartidores y
          clientes finales. Contacto oficial:{' '}
          <Text style={estilos.enlace} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>{EMAIL}</Text>
        </Seccion>

        <Seccion titulo="2. Datos que recopilamos">
          {`• Nombre y número de teléfono (con su país)\n• Correo electrónico — obligatorio, es con lo que recuperas tu contraseña\n• Ubicación GPS durante pedidos a domicilio\n• Fotos de INE para verificación de edad\n• Token de dispositivo para notificaciones push\n• Historial de pedidos y calificaciones`}
        </Seccion>

        <Seccion titulo="3. Uso de los datos">
          {`Tus datos se usan exclusivamente para:\n\n• Procesar y entregar pedidos\n• Enviar notificaciones del estado de tu pedido\n• Verificar la identidad de repartidores y negocios\n• Mejorar la experiencia de la app\n\nNo vendemos ni compartimos tus datos con terceros, salvo a Mercado Pago para procesar pagos.`}
        </Seccion>

        <View style={estilos.seccionDestacada}>
          <Text style={estilos.seccionTituloDestacado}>4. Métodos de pago y límites</Text>
          <Text style={estilos.itemDestacado}>
            💵 Efectivo — <Text style={estilos.negrita}>máximo ${LIMITE_EFECTIVO} MXN en productos</Text> (el envío se suma encima). Pagas al recibir tu pedido.
          </Text>
          <Text style={estilos.itemDestacado}>
            💳 Tarjeta de débito/crédito — <Text style={estilos.negrita}>temporalmente no disponible</Text>, se habilita muy pronto
          </Text>
          <View style={estilos.avisoEfectivo}>
            <Text style={estilos.avisoTxt}>
              💵 Por ahora aceptamos solo efectivo al entregar, hasta ${LIMITE_EFECTIVO} pesos en productos
            </Text>
          </View>
        </View>

        <Seccion titulo="5. Verificación de edad">
          Algunos productos (bebidas alcohólicas, tabaco) requieren fotografía de INE al
          momento de la entrega. Esta imagen se elimina automáticamente 30 días después de
          creado el pedido. También puedes solicitar su eliminación antes escribiendo a
          nuestro correo de contacto.
        </Seccion>

        <Seccion titulo="6. Ubicación">
          Solicitamos tu ubicación para calcular costos de envío, asignar repartidores cercanos
          y rastrear pedidos en tiempo real. Puedes revocar este permiso desde la configuración
          de tu dispositivo.
        </Seccion>

        <Seccion titulo="7. Eliminación de datos">
          Puedes solicitar la eliminación de tu cuenta escribiendo a{' '}
          <Text style={estilos.enlace} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>{EMAIL}</Text>.
          Procesamos solicitudes en máximo 15 días hábiles.
        </Seccion>

        <Seccion titulo="8. Seguridad">
          {`• Contraseñas encriptadas con bcrypt\n• Comunicaciones HTTPS\n• Tokens en Secure Store del dispositivo\n• Sin acceso a datos bancarios (Mercado Pago los gestiona directamente)`}
        </Seccion>

        <View style={estilos.footer}>
          <Text style={estilos.footerTxt}>
            Al usar VoyCorriendo aceptas estos términos.{'\n'}
            Contacto: <Text style={{ fontWeight: '700', color: colors.primario }}>{EMAIL}</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Seccion({ titulo, children }) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>{titulo}</Text>
      <Text style={estilos.cuerpo}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg, paddingBottom: espacio.xl * 2 },
  titulo: { fontSize: 21, fontWeight: '800', color: colors.texto, textAlign: 'center', marginBottom: espacio.xs },
  fecha: { fontSize: 12, color: colors.textoSuave, textAlign: 'center', marginBottom: espacio.lg },
  seccion: {
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm,
    borderLeftWidth: 3, borderLeftColor: colors.primario,
  },
  seccionTitulo: { fontSize: 14, fontWeight: '800', color: colors.texto, marginBottom: 6 },
  cuerpo: { fontSize: 13, color: colors.textoSuave, lineHeight: 20 },
  seccionDestacada: {
    backgroundColor: '#FFF3E8', borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm,
    borderLeftWidth: 3, borderLeftColor: colors.primario,
    borderWidth: 1, borderColor: '#FFD4A8',
  },
  seccionTituloDestacado: { fontSize: 14, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  itemDestacado: { fontSize: 13, color: colors.textoSuave, lineHeight: 22 },
  negrita: { fontWeight: '800', color: colors.texto },
  avisoEfectivo: {
    marginTop: espacio.sm, padding: espacio.sm,
    backgroundColor: colors.primario, borderRadius: radio.sm,
    alignItems: 'center',
  },
  avisoTxt: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  enlace: { color: colors.primario, fontWeight: '700', textDecorationLine: 'underline' },
  footer: {
    marginTop: espacio.lg, padding: espacio.md,
    backgroundColor: colors.superficie, borderRadius: radio.md,
    borderWidth: 1, borderColor: colors.borde, alignItems: 'center',
  },
  footerTxt: { fontSize: 13, color: colors.textoSuave, lineHeight: 20, textAlign: 'center' },
});
