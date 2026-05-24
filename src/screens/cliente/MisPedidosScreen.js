import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { pedidosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const ESTADO_COLOR = {
  pendiente: colors.advertencia,
  confirmado: colors.secundario,
  preparando: colors.secundario,
  listo: colors.secundario,
  en_camino: colors.primario,
  entregado: colors.exito,
  cancelado: colors.error,
};

const ESTADO_TXT = {
  pendiente: 'Esperando',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  listo: 'Listo',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
};

export default function MisPedidosScreen({ navigation }) {
  const [pedidos, setPedidos]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);

  const cargar = async () => {
    try {
      const { data } = await pedidosAPI.misPedidos();
      setPedidos(data.data?.pedidos || []);
    } catch (_) {/* */}
    finally { setCargando(false); setRefrescar(false); }
  };

  useFocusEffect(useCallback(() => { cargar(); }, []));

  if (cargando) return <ActivityIndicator size="large" color={colors.primario} style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargar(); }} />}
        contentContainerStyle={pedidos.length === 0 ? estilos.vacio : { padding: espacio.md }}
        ListEmptyComponent={
          <View style={estilos.vacioContenido}>
            <Text style={{ fontSize: 60 }}>📭</Text>
            <Text style={estilos.vacioTxt}>Aún no has hecho pedidos</Text>
            <Text style={estilos.vacioSub}>Cuando hagas tu primer pedido aparecerá aquí.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={estilos.tarjeta} onPress={() => navigation.navigate('Seguimiento', { pedidoId: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.numero}>{item.numero}</Text>
              <Text style={estilos.fecha}>{new Date(item.creado_en).toLocaleString('es-MX')}</Text>
              <Text style={estilos.total}>${parseFloat(item.total).toFixed(2)} MXN</Text>
            </View>
            <View style={[estilos.estado, { backgroundColor: ESTADO_COLOR[item.estado] || colors.textoSuave }]}>
              <Text style={estilos.estadoTxt}>{ESTADO_TXT[item.estado] || item.estado}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  vacioContenido: { alignItems: 'center' },
  vacioTxt: { fontSize: 18, fontWeight: '600', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    marginBottom: espacio.sm,
  },
  numero: { fontSize: 15, fontWeight: '700', color: colors.texto },
  fecha: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  total: { fontSize: 16, fontWeight: '700', color: colors.primario, marginTop: espacio.xs },
  estado: { paddingVertical: espacio.xs, paddingHorizontal: espacio.md, borderRadius: radio.full },
  estadoTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
