import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { pedidosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const ESTADO_INFO = {
  pendiente:  { label: 'Esperando',  color: colors.advertencia, fondo: '#FFF9E6' },
  confirmado: { label: 'Confirmado', color: colors.secundario,  fondo: '#E7F7EE' },
  preparando: { label: 'Preparando', color: colors.secundario,  fondo: '#E7F7EE' },
  listo:      { label: 'Listo',      color: colors.secundario,  fondo: '#E7F7EE' },
  en_camino:  { label: 'En camino',  color: colors.primario,    fondo: '#FFF3E8' },
  en_envio:   { label: 'Enviado',    color: colors.primario,    fondo: '#FFF3E8' },
  entregado:  { label: 'Entregado',  color: colors.exito,       fondo: '#ECFDF5' },
  cancelado:  { label: 'Cancelado',  color: colors.error,       fondo: '#FEF2F2' },
  rechazado:  { label: 'Rechazado',  color: colors.error,       fondo: '#FEF2F2' },
};

const formatFecha = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
};

export default function MisPedidosScreen({ navigation }) {
  const [pedidos, setPedidos]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);

  const cargar = async (esRefresco = false) => {
    try {
      const { data } = await pedidosAPI.misPedidos();
      setPedidos(data.data?.pedidos || []);
    } catch (e) {
      if (esRefresco) {
        Alert.alert('Sin conexión', 'No pudimos actualizar tus pedidos. Revisa tu internet.');
      }
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  };

  useFocusEffect(useCallback(() => { cargar(false); }, []));

  if (cargando) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescar(true); cargar(true); }}
            tintColor={colors.primario}
            colors={[colors.primario]}
          />
        }
        contentContainerStyle={pedidos.length === 0 ? estilos.vacioCont : estilos.lista}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={estilos.vacio}>
            <Text style={estilos.vacioEmoji}>📭</Text>
            <Text style={estilos.vacioTxt}>Aún no has hecho pedidos</Text>
            <Text style={estilos.vacioSub}>Cuando hagas tu primer pedido aparecerá aquí.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const info = ESTADO_INFO[item.estado] || { label: item.estado, color: colors.textoSuave, fondo: colors.fondo };
          return (
            <Pressable
              style={({ pressed }) => [estilos.tarjeta, pressed && estilos.tarjetaPresionada]}
              onPress={() => navigation.navigate('Seguimiento', { pedidoId: item.id })}
            >
              {/* Franja izquierda de estado */}
              <View style={[estilos.franja, { backgroundColor: info.color }]} />

              <View style={estilos.cuerpo}>
                <View style={estilos.encabezado}>
                  <Text style={estilos.numero}>{item.numero}</Text>
                  <View style={[estilos.pill, { backgroundColor: info.fondo }]}>
                    <Text style={[estilos.pillTxt, { color: info.color }]}>{info.label}</Text>
                  </View>
                </View>

                <View style={estilos.meta}>
                  {item.negocio?.nombre && (
                    <Text style={estilos.negocio} numberOfLines={1}>🏪 {item.negocio.nombre}</Text>
                  )}
                  <Text style={estilos.fecha}>{formatFecha(item.creado_en)}</Text>
                </View>

                <View style={estilos.pie}>
                  <Text style={estilos.total}>${parseFloat(item.total).toFixed(2)} MXN</Text>
                  <Text style={estilos.chevron}>›</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: espacio.md, paddingBottom: espacio.xl },
  vacioCont: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  vacio: { alignItems: 'center' },
  vacioEmoji: { fontSize: 64, marginBottom: espacio.md },
  vacioTxt: { fontSize: 20, fontWeight: '800', color: colors.texto, textAlign: 'center' },
  vacioSub: {
    fontSize: 14, color: colors.textoSuave,
    marginTop: espacio.xs, textAlign: 'center', lineHeight: 20,
  },

  tarjeta: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    marginBottom: espacio.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tarjetaPresionada: { opacity: 0.85 },
  franja: { width: 5 },
  cuerpo: { flex: 1, padding: espacio.md },

  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.xs },
  numero: { fontSize: 16, fontWeight: '800', color: colors.texto, letterSpacing: 0.2 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radio.full,
  },
  pillTxt: { fontSize: 12, fontWeight: '700' },

  meta: { marginBottom: espacio.sm },
  negocio: { fontSize: 13, color: colors.textoSuave, marginBottom: 2 },
  fecha: { fontSize: 12, color: colors.textoSuave },

  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, fontWeight: '900', color: colors.primario },
  chevron: { fontSize: 22, color: colors.textoSuave },
});
