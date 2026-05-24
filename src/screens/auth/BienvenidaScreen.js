import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Boton from '../../components/Boton';
import { colors, espacio } from '../../theme/colors';

export default function BienvenidaScreen({ navigation }) {
  return (
    <SafeAreaView style={estilos.contenedor}>
      <View style={estilos.hero}>
        <Text style={estilos.emoji}>🛵</Text>
        <Text style={estilos.titulo}>VoyCorriendo</Text>
        <Text style={estilos.subtitulo}>Puerto Escondido, Oaxaca</Text>
        <Text style={estilos.descripcion}>
          Pide comida, medicinas y despensa directo a tu puerta.{'\n'}
          Rápido, seguro y a un click.
        </Text>
      </View>

      <View style={estilos.acciones}>
        <Boton titulo="Iniciar sesión" onPress={() => navigation.navigate('Login')} />
        <View style={{ height: espacio.md }} />
        <Boton
          titulo="Crear una cuenta"
          variante="secundario"
          onPress={() => navigation.navigate('Registro')}
        />
        <Text style={estilos.pieDePagina}>
          Al continuar aceptas nuestros Términos y el Aviso de Privacidad.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo, paddingHorizontal: espacio.lg },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 96, marginBottom: espacio.md },
  titulo: { fontSize: 42, fontWeight: '800', color: colors.primario, letterSpacing: 0.5 },
  subtitulo: { fontSize: 16, color: colors.secundario, fontWeight: '600', marginTop: espacio.xs },
  descripcion: { fontSize: 16, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.lg, lineHeight: 24 },
  acciones: { paddingBottom: espacio.xl },
  pieDePagina: { fontSize: 12, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.md },
});
