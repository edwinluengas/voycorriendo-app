/**
 * Eliminar la cuenta.
 *
 * Google Play lo exige desde 2024 para toda app con registro, y es el
 * derecho de Cancelación de la LFPDPPP. La pantalla se toma el trabajo de
 * decir la verdad completa ANTES de pedir la contraseña: qué se borra, qué
 * se conserva y por qué, y qué lo impide hoy. Un botón de "eliminar" que
 * falla después de escribir la contraseña —o que borra más (o menos) de lo
 * que la persona creía— es peor que no tenerlo.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usuariosAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors, espacio, radio } from '../../theme/colors';

export default function EliminarCuentaScreen({ navigation }) {
  const { cerrarSesion } = useAuth();
  const [info, setInfo]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [password, setPassword] = useState('');
  const [borrando, setBorrando] = useState(false);

  useFocusEffect(useCallback(() => {
    let vivo = true;
    setCargando(true);
    usuariosAPI.estadoEliminacion()
      .then(({ data }) => { if (vivo) setInfo(data.data); })
      .catch((e) => {
        if (vivo) Alert.alert('No pudimos consultar tu cuenta', e?.mensajeAmigable || 'Intenta de nuevo.');
      })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []));

  const confirmar = () => {
    if (!password.trim()) {
      return Alert.alert('Falta tu contraseña', 'Escríbela para confirmar que eres tú.');
    }
    // Dos confirmaciones a propósito: es irreversible.
    Alert.alert(
      '¿Eliminar tu cuenta?',
      'Esto no se puede deshacer. Perderás el acceso a tu historial y tendrás que registrarte de nuevo si quieres volver.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, eliminar', style: 'destructive', onPress: ejecutar },
      ],
    );
  };

  const ejecutar = async () => {
    setBorrando(true);
    try {
      const { data } = await usuariosAPI.eliminarMiCuenta(password);
      // La sesión ya no vale del lado del servidor; se cierra aquí también
      // para que la app no quede con un token muerto en la mano.
      Alert.alert('Cuenta eliminada', data?.mensaje || 'Tu cuenta fue eliminada.', [
        { text: 'Entendido', onPress: () => cerrarSesion() },
      ]);
    } catch (e) {
      if (e?.codigoError === 'CUENTA_CON_PENDIENTES') {
        Alert.alert('Todavía no se puede', e.mensajeAmigable);
        // Se recarga: los impedimentos pudieron cambiar mientras estaba aquí.
        usuariosAPI.estadoEliminacion().then(({ data }) => setInfo(data.data)).catch(() => {});
      } else {
        Alert.alert('No se pudo eliminar', e?.mensajeAmigable || 'Intenta de nuevo.');
      }
    } finally {
      setBorrando(false);
    }
  };

  if (cargando) {
    return (
      <SafeAreaView style={[estilos.contenedor, estilos.centrado]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primario} />
      </SafeAreaView>
    );
  }

  const bloqueada = info && !info.puede;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="always">
        <Text style={estilos.titulo}>Eliminar mi cuenta</Text>
        <Text style={estilos.intro}>
          Puedes cerrar tu cuenta cuando quieras. Es definitivo: no hay forma de
          recuperarla después.
        </Text>

        {bloqueada && (
          <View style={estilos.bloqueo}>
            <Text style={estilos.bloqueoTit}>Todavía no se puede</Text>
            {info.impedimentos.map((t, i) => (
              <Text key={i} style={estilos.bloqueoTxt}>• {t}</Text>
            ))}
            <Text style={estilos.bloqueoPie}>
              En cuanto se resuelva, vuelve aquí y podrás cerrarla.
            </Text>
          </View>
        )}

        <Text style={estilos.seccion}>Qué se borra</Text>
        {(info?.se_borra || []).map((t, i) => (
          <Text key={i} style={estilos.item}>• {t}</Text>
        ))}

        <Text style={estilos.seccion}>Qué se conserva, y por qué</Text>
        {(info?.se_conserva || []).map((t, i) => (
          <Text key={i} style={estilos.itemSuave}>{t}</Text>
        ))}

        <Text style={estilos.seccion}>Confirma que eres tú</Text>
        <TextInput
          style={estilos.input}
          placeholder="Tu contraseña"
          placeholderTextColor={colors.textoSuave}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!bloqueada && !borrando}
        />

        <Pressable
          style={[estilos.btnEliminar, (bloqueada || borrando) && estilos.btnApagado]}
          onPress={confirmar}
          disabled={bloqueada || borrando}
        >
          {borrando
            ? <ActivityIndicator color="#FFF" />
            : <Text style={estilos.btnEliminarTxt}>Eliminar mi cuenta</Text>}
        </Pressable>

        <Pressable style={estilos.btnCancelar} onPress={() => navigation.goBack()} disabled={borrando}>
          <Text style={estilos.btnCancelarTxt}>Mejor no, regresar</Text>
        </Pressable>

        <Text style={estilos.pie}>
          ¿Dudas? Escríbenos a voycorriendoadmin@gmail.com
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: espacio.lg, paddingBottom: espacio.xxl },
  titulo: { fontSize: 24, fontWeight: '900', color: colors.texto },
  intro: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, lineHeight: 20 },

  bloqueo: {
    marginTop: espacio.lg, padding: espacio.md,
    borderRadius: radio.md, backgroundColor: '#FFF7ED',
    borderWidth: 1, borderColor: '#FDBA74',
  },
  bloqueoTit: { fontSize: 15, fontWeight: '800', color: '#9A3412', marginBottom: espacio.xs },
  bloqueoTxt: { fontSize: 13, color: '#9A3412', lineHeight: 20 },
  bloqueoPie: { fontSize: 12, color: '#9A3412', marginTop: espacio.sm, fontStyle: 'italic' },

  seccion: { fontSize: 16, fontWeight: '800', color: colors.texto, marginTop: espacio.lg, marginBottom: espacio.xs },
  item: { fontSize: 14, color: colors.texto, lineHeight: 22 },
  itemSuave: { fontSize: 13, color: colors.textoSuave, lineHeight: 20 },

  input: {
    backgroundColor: colors.superficie,
    borderWidth: 1, borderColor: colors.borde, borderRadius: radio.md,
    paddingHorizontal: espacio.md, paddingVertical: espacio.md,
    fontSize: 16, color: colors.texto,
  },

  btnEliminar: {
    marginTop: espacio.lg, paddingVertical: espacio.md,
    borderRadius: radio.md, backgroundColor: colors.error, alignItems: 'center',
  },
  btnApagado: { backgroundColor: colors.bordeOscuro },
  btnEliminarTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },

  btnCancelar: { marginTop: espacio.md, paddingVertical: espacio.md, alignItems: 'center' },
  btnCancelarTxt: { color: colors.primario, fontWeight: '700', fontSize: 15 },

  pie: { marginTop: espacio.lg, fontSize: 12, color: colors.textoSuave, textAlign: 'center' },
});
