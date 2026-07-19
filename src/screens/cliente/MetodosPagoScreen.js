import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usuariosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const METODOS = [
  { id: 'efectivo',    icono: '💵', titulo: 'Efectivo',     desc: 'Paga al repartidor al recibir tu pedido. Máx. $500.' },
  { id: 'tarjeta',     icono: '💳', titulo: 'Tarjeta',      desc: 'Débito o crédito — procesado por Mercado Pago.' },
  { id: 'mercado_pago',icono: '💙', titulo: 'Mercado Pago', desc: 'Saldo en tu cuenta de Mercado Pago.' },
];

export default function MetodosPagoScreen() {
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando]         = useState(true);
  const [guardando, setGuardando]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usuariosAPI.getMetodoPagoDefault();
        setSeleccionado(data.data?.metodo_pago_default || null);
      } catch (_) {}
      finally { setCargando(false); }
    })();
  }, []);

  const guardar = async (metodo) => {
    setGuardando(true);
    try {
      await usuariosAPI.setMetodoPagoDefault(metodo);
      setSeleccionado(metodo);
    } catch (_) {
      Alert.alert('Error', 'No se pudo guardar la preferencia.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <View style={s.centrado}><ActivityIndicator color={colors.primario} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.contenedor} edges={['bottom']}>
      <View style={s.scroll}>
        <Text style={s.subtitulo}>
          Elige tu método preferido. Siempre puedes cambiarlo al hacer un pedido.
        </Text>

        {METODOS.map(m => {
          const activo = seleccionado === m.id;
          return (
            <Pressable
              key={m.id}
              style={[s.card, activo && s.cardActiva]}
              onPress={() => guardar(m.id)}
              disabled={guardando}
            >
              <View style={[s.cardIcono, { backgroundColor: activo ? colors.primario + '20' : colors.fondo }]}>
                <Text style={{ fontSize: 26 }}>{m.icono}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTit, activo && { color: colors.primario }]}>{m.titulo}</Text>
                <Text style={s.cardDesc}>{m.desc}</Text>
              </View>
              <View style={[s.radio, activo && s.radioActivo]}>
                {activo && <View style={s.radioInner} />}
              </View>
            </Pressable>
          );
        })}

        <View style={s.aviso}>
          <Text style={s.avisoTxt}>
            🔒 Los pagos con tarjeta son procesados de forma segura por Mercado Pago.
            VoyCorriendo nunca almacena los datos de tu tarjeta.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: espacio.lg },
  subtitulo:  { fontSize: 14, color: colors.textoSuave, marginBottom: espacio.lg, lineHeight: 20 },

  card: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  cardActiva:  { borderColor: colors.primario, backgroundColor: '#FFF4EB' },
  cardIcono:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: espacio.md },
  cardTit:     { fontSize: 16, fontWeight: '800', color: colors.texto },
  cardDesc:    { fontSize: 13, color: colors.textoSuave, marginTop: 2 },

  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borde, alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: colors.primario },
  radioInner:  { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primario },

  aviso:    { backgroundColor: '#F0FDF4', padding: espacio.md, borderRadius: radio.md, marginTop: espacio.md },
  avisoTxt: { fontSize: 13, color: '#166534', lineHeight: 19 },
});
