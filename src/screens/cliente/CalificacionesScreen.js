import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usuariosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const Estrellas = ({ n }) => (
  <Text style={{ fontSize: 14 }}>
    {'★'.repeat(n || 0)}{'☆'.repeat(5 - (n || 0))}
  </Text>
);

export default function CalificacionesScreen() {
  const [lista, setLista]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usuariosAPI.misCalificaciones();
        setLista(data.data?.calificaciones || []);
      } catch (_) {}
      finally { setCargando(false); }
    })();
  }, []);

  const promedio = lista.length
    ? (lista.reduce((s, c) => s + (c.calificacion_negocio || 0), 0) / lista.length).toFixed(1)
    : null;

  if (cargando) {
    return <View style={s.centrado}><ActivityIndicator color={colors.primario} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.contenedor} edges={['bottom']}>
      {lista.length > 0 && (
        <View style={s.resumen}>
          <Text style={s.resumenNum}>{promedio}</Text>
          <Text style={s.resumenTxt}>promedio de tus calificaciones</Text>
          <Text style={s.resumenCount}>{lista.length} pedido{lista.length !== 1 ? 's' : ''} calificado{lista.length !== 1 ? 's' : ''}</Text>
        </View>
      )}
      <FlatList
        data={lista}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: espacio.lg, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={s.vacio}>
            <Text style={s.vacioEmoji}>⭐</Text>
            <Text style={s.vacioTxt}>Sin calificaciones aún</Text>
            <Text style={s.vacioSub}>Haz un pedido y califica tu experiencia al recibirlo</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardNum}>Pedido {item.numero}</Text>
              <Text style={s.cardFecha}>
                {new Date(item.creado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={s.cardNegocio}>{item.negocio?.nombre || 'Negocio'}</Text>

            <View style={s.calRow}>
              <View style={s.calItem}>
                <Text style={s.calLabel}>Negocio</Text>
                <Estrellas n={item.calificacion_negocio} />
              </View>
              {item.calificacion_repartidor != null && (
                <View style={s.calItem}>
                  <Text style={s.calLabel}>Repartidor</Text>
                  <Estrellas n={item.calificacion_repartidor} />
                </View>
              )}
              {item.propina > 0 && (
                <View style={s.calItem}>
                  <Text style={s.calLabel}>Propina</Text>
                  <Text style={s.propina}>${parseFloat(item.propina).toFixed(0)}</Text>
                </View>
              )}
            </View>
            {!!item.comentario && (
              <Text style={s.comentario}>"{item.comentario}"</Text>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  resumen: {
    backgroundColor: colors.primario,
    padding: espacio.lg,
    alignItems: 'center',
  },
  resumenNum:   { fontSize: 48, fontWeight: '900', color: '#FFF' },
  resumenTxt:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  resumenCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  vacio:     { alignItems: 'center', paddingTop: 80 },
  vacioEmoji:{ fontSize: 56, marginBottom: espacio.md },
  vacioTxt:  { fontSize: 17, fontWeight: '700', color: colors.texto, marginBottom: espacio.xs },
  vacioSub:  { fontSize: 14, color: colors.textoSuave, textAlign: 'center', paddingHorizontal: espacio.xl },

  card: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderWidth: 1, borderColor: colors.borde,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  cardNum:    { fontSize: 13, fontWeight: '700', color: colors.primario },
  cardFecha:  { fontSize: 12, color: colors.textoSuave },
  cardNegocio:{ fontSize: 15, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },

  calRow:  { flexDirection: 'row', gap: espacio.lg, marginBottom: espacio.xs },
  calItem: {},
  calLabel:{ fontSize: 11, color: colors.textoSuave, marginBottom: 2 },
  propina: { fontSize: 14, fontWeight: '700', color: colors.exito },

  comentario: { fontSize: 13, color: colors.textoSuave, fontStyle: 'italic', marginTop: espacio.xs, lineHeight: 18 },
});
