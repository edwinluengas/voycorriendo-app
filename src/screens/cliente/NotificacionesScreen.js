import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { usuariosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

export default function NotificacionesScreen() {
  const [permisoOS, setPermisoOS]       = useState(null);
  const [prefs, setPrefs]               = useState({ notif_pedidos: true, notif_marketing: false });
  const [cargando, setCargando]         = useState(true);
  const [guardando, setGuardando]       = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermisoOS(status);
      try {
        const { data } = await usuariosAPI.getNotificaciones();
        setPrefs({
          notif_pedidos:   data.data?.notif_pedidos   ?? true,
          notif_marketing: data.data?.notif_marketing ?? false,
        });
      } catch (_) {}
      finally { setCargando(false); }
    })();
  }, []);

  const cambiar = async (campo, valor) => {
    const nuevas = { ...prefs, [campo]: valor };
    setPrefs(nuevas);
    setGuardando(true);
    try {
      await usuariosAPI.setNotificaciones({ [campo]: valor });
    } catch (_) {
      setPrefs(prefs);
      Alert.alert('Error', 'No se pudo guardar la preferencia.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <View style={s.centrado}><ActivityIndicator color={colors.primario} size="large" /></View>;
  }

  const permisoOK = permisoOS === 'granted';

  return (
    <SafeAreaView style={s.contenedor} edges={['bottom']}>
      <View style={{ padding: espacio.lg }}>

        {!permisoOK && (
          <View style={s.avisoOS}>
            <Text style={s.avisoOSTit}>Las notificaciones están desactivadas en el sistema</Text>
            <Text style={s.avisoOSSub}>
              Para recibir alertas de tus pedidos, actívalas en Configuración de tu celular.
            </Text>
            <Text
              style={s.avisoOSLink}
              onPress={() => Linking.openSettings()}
            >
              Abrir configuración →
            </Text>
          </View>
        )}

        <View style={s.seccion}>
          <Text style={s.seccionTit}>Pedidos</Text>

          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.filaTit}>Estado de mi pedido</Text>
              <Text style={s.filaSub}>Confirmación, repartidor en camino, entregado</Text>
            </View>
            <Switch
              value={prefs.notif_pedidos}
              onValueChange={v => cambiar('notif_pedidos', v)}
              trackColor={{ false: '#CCC', true: colors.primario }}
              thumbColor="#FFF"
              disabled={guardando || !permisoOK}
            />
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.seccionTit}>Promociones</Text>

          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.filaTit}>Ofertas y descuentos</Text>
              <Text style={s.filaSub}>Novedades, promos especiales y noticias de VoyCorriendo</Text>
            </View>
            <Switch
              value={prefs.notif_marketing}
              onValueChange={v => cambiar('notif_marketing', v)}
              trackColor={{ false: '#CCC', true: colors.primario }}
              thumbColor="#FFF"
              disabled={guardando || !permisoOK}
            />
          </View>
        </View>

        <Text style={s.nota}>
          Las notificaciones de seguridad (códigos de verificación) siempre se envían sin importar estas preferencias.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  avisoOS: {
    backgroundColor: '#FEF3C7',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.lg,
  },
  avisoOSTit:  { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  avisoOSSub:  { fontSize: 13, color: '#92400E', lineHeight: 18 },
  avisoOSLink: { fontSize: 13, color: colors.primario, fontWeight: '700', marginTop: espacio.sm },

  seccion:    { backgroundColor: colors.superficie, borderRadius: radio.md, marginBottom: espacio.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.borde },
  seccionTit: { fontSize: 12, fontWeight: '800', color: colors.textoSuave, textTransform: 'uppercase', padding: espacio.md, paddingBottom: 0 },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.md,
    gap: espacio.md,
  },
  filaTit: { fontSize: 15, fontWeight: '700', color: colors.texto },
  filaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2, lineHeight: 16 },

  nota: { fontSize: 12, color: colors.textoSuave, lineHeight: 17, marginTop: espacio.sm, textAlign: 'center', paddingHorizontal: espacio.md },
});
