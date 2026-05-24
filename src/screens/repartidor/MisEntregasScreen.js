import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { repartidoresAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const METODO_TXT = {
  efectivo:      '💵',
  tarjeta:       '💳',
  transferencia: '🏦',
  mercado_pago:  '💙',
};

const esHoy = (fechaStr) => {
  if (!fechaStr) return false;
  const d = new Date(fechaStr);
  const hoy = new Date();
  return d.getFullYear() === hoy.getFullYear()
    && d.getMonth() === hoy.getMonth()
    && d.getDate()   === hoy.getDate();
};

export default function MisEntregasScreen() {
  const [entregas, setEntregas]     = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await repartidoresAPI.misEntregas();
      setEntregas(data.data?.entregas || data.data?.pedidos || []);
    } catch (_) {
      setEntregas([]);
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (cargando) {
    return <ActivityIndicator size="large" color={colors.secundario} style={{ flex: 1 }} />;
  }

  const hoy = entregas.filter((e) => esHoy(e.entregado_en || e.creado_en));
  const gananciasHoy = hoy.reduce(
    (s, e) => s + parseFloat(e.ganancia || e.comision_repartidor || 0),
    0,
  );
  const totalGanancias = entregas.reduce(
    (s, e) => s + parseFloat(e.ganancia || e.comision_repartidor || 0),
    0,
  );

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* Resumen de hoy */}
      <View style={estilos.resumen}>
        <View style={estilos.stat}>
          <Text style={estilos.statVal}>{hoy.length}</Text>
          <Text style={estilos.statLbl}>Entregas hoy</Text>
        </View>
        <View style={estilos.divider} />
        <View style={estilos.stat}>
          <Text style={[estilos.statVal, estilos.statGanancia]}>
            ${gananciasHoy.toFixed(2)}
          </Text>
          <Text style={estilos.statLbl}>Ganado hoy</Text>
        </View>
        <View style={estilos.divider} />
        <View style={estilos.stat}>
          <Text style={estilos.statVal}>{entregas.length}</Text>
          <Text style={estilos.statLbl}>Total</Text>
        </View>
      </View>

      {/* Total acumulado si hay historial */}
      {entregas.length > 0 && (
        <View style={estilos.totalBanner}>
          <Text style={estilos.totalBannerTxt}>
            💰 Ganancias totales: <Text style={estilos.totalBannerVal}>${totalGanancias.toFixed(2)} MXN</Text>
          </Text>
        </View>
      )}

      <FlatList
        data={entregas}
        keyExtractor={(e) => e.id}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescar(true); cargar(); }}
            tintColor={colors.secundario}
          />
        }
        contentContainerStyle={
          entregas.length === 0
            ? { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl }
            : { padding: espacio.md, paddingBottom: espacio.xl }
        }
        ListEmptyComponent={
          <>
            <Text style={{ fontSize: 64, textAlign: 'center' }}>📦</Text>
            <Text style={estilos.vacioTxt}>Aún no has hecho entregas</Text>
            <Text style={estilos.vacioSub}>
              Cuando entregues pedidos aparecerán aquí junto a tus ganancias.
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const ganancia = parseFloat(item.ganancia || item.comision_repartidor || 0);
          const fecha    = new Date(item.entregado_en || item.creado_en);
          const esDeHoy  = esHoy(item.entregado_en || item.creado_en);
          const metodoEmoji = METODO_TXT[item.metodo_pago] || '💵';

          return (
            <View style={[estilos.tarjeta, esDeHoy && estilos.tarjetaHoy]}>
              <View style={estilos.encab}>
                <Text style={estilos.numero}>{item.numero}</Text>
                <Text style={estilos.hora}>
                  {esDeHoy
                    ? fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                    : fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                </Text>
              </View>

              <Text style={estilos.negocio}>🏪 {item.negocio?.nombre || '—'}</Text>
              <Text style={estilos.dir} numberOfLines={1}>
                📍 {item.direccion_entrega || '—'}
              </Text>

              <View style={estilos.pie}>
                <View>
                  <Text style={estilos.total}>{metodoEmoji} ${parseFloat(item.total || 0).toFixed(2)}</Text>
                  <Text style={estilos.totalSub}>Total del pedido</Text>
                </View>
                <View style={estilos.gananciaBox}>
                  <Text style={estilos.ganancia}>+${ganancia.toFixed(2)}</Text>
                  <Text style={estilos.gananciaSub}>Tu ganancia</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  resumen: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.secundario,
    paddingVertical: espacio.md, paddingHorizontal: espacio.sm,
  },
  stat:        { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 22, fontWeight: '800', color: '#FFF' },
  statGanancia:{ color: '#A5F3A5' },
  statLbl:     { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' },
  divider:     { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },

  totalBanner: {
    backgroundColor: '#E7F7EE',
    paddingVertical: espacio.sm,
    paddingHorizontal: espacio.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  totalBannerTxt: { fontSize: 13, color: colors.texto, fontWeight: '600' },
  totalBannerVal: { color: colors.exito, fontWeight: '800' },

  tarjeta: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.secundario,
  },
  tarjetaHoy: { borderLeftColor: colors.primario },

  encab:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero:   { fontSize: 13, fontWeight: '700', color: colors.textoSuave },
  hora:     { fontSize: 12, color: colors.textoSuave },
  negocio:  { fontSize: 15, fontWeight: '700', color: colors.texto, marginTop: espacio.xs },
  dir:      { fontSize: 13, color: colors.textoSuave, marginTop: 2, marginBottom: espacio.sm },

  pie: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: espacio.xs,
    paddingTop: espacio.xs,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
  total:      { fontSize: 16, fontWeight: '700', color: colors.texto },
  totalSub:   { fontSize: 11, color: colors.textoSuave, marginTop: 2 },
  gananciaBox:{ alignItems: 'flex-end' },
  ganancia:   { fontSize: 18, fontWeight: '800', color: colors.exito },
  gananciaSub:{ fontSize: 11, color: colors.textoSuave, marginTop: 2 },

  vacioTxt: { fontSize: 17, fontWeight: '600', color: colors.texto, marginTop: espacio.md, textAlign: 'center' },
  vacioSub: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center', lineHeight: 18 },
});
