import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { negocioOnboardingAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (_) { return ''; }
};

function TarjetaStat({ label, valor, sub, color }) {
  return (
    <View style={[estilos.stat, color && { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Text style={estilos.statValor}>{valor}</Text>
      <Text style={estilos.statLabel}>{label}</Text>
      {!!sub && <Text style={estilos.statSub}>{sub}</Text>}
    </View>
  );
}

export default function GananciasNegocioScreen({ navigation }) {
  const [datos, setDatos]           = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await negocioOnboardingAPI.ganancias();
      setDatos(data.data);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudieron cargar los datos.');
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  const d = datos || {};

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: espacio.xl }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargar(); }} />}
      >
        {/* Hero */}
        <View style={estilos.hero}>
          <Text style={estilos.heroLabel}>Ventas en comida</Text>
          <Text style={estilos.heroValor}>{fmt(d.subtotal_productos)}</Text>
          <Text style={estilos.heroSub}>{d.pedidos_completados || 0} pedidos entregados</Text>
        </View>

        {/* Stats */}
        <View style={estilos.statsGrid}>
          <TarjetaStat
            label="Subtotal de comida"
            valor={fmt(d.subtotal_productos)}
            sub="Lo que pagaron los clientes por tus productos"
            color={colors.primario}
          />
          <TarjetaStat
            label="Comisiones plataforma"
            valor={fmt(d.comisiones_pagadas)}
            sub="Comisión cobrada por VoyCorriendo"
            color={colors.error}
          />
          <TarjetaStat
            label="Liquidación neta"
            valor={fmt(d.liquidacion_comida)}
            sub="Lo que te corresponde recibir"
            color={colors.secundario}
          />
          <TarjetaStat
            label="Tokens disponibles"
            valor={`${d.tokens_disponibles || 0}`}
            sub="Tokens activos para publicar pedidos"
            color="#FBBF24"
          />
        </View>

        {/* Información de modelo económico */}
        <View style={estilos.infoBox}>
          <Text style={estilos.infoTitulo}>¿Cómo funciona?</Text>
          <Text style={estilos.infoTxt}>
            • El <Text style={{ fontWeight: '700' }}>fee de envío lo paga el cliente</Text> — no se resta de tus ventas.{'\n'}
            • La comisión de plataforma se descuenta del fee de envío cobrado, no de tus productos.{'\n'}
            • La <Text style={{ fontWeight: '700' }}>liquidación neta</Text> es lo que VoyCorriendo te deposita por cada pedido entregado.{'\n'}
            • Los <Text style={{ fontWeight: '700' }}>tokens</Text> son tu suscripción para recibir pedidos.
          </Text>
        </View>

        {/* Ledger reciente */}
        {(d.resumen || []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Últimos pedidos conciliados</Text>
            {(d.resumen || []).slice(0, 15).map((l, i) => (
              <View key={l.pedido_id || i} style={estilos.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.filaMetodo}>
                    {l.metodo_pago === 'efectivo' ? '💵' : '💳'} {l.tipo_envio === 'express' ? 'Express' : 'Estándar'}
                  </Text>
                  <Text style={estilos.filaFecha}>{fmtFecha(l.registrado_en)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={estilos.filaSubtotal}>{fmt(l.subtotal_productos)}</Text>
                  <Text style={estilos.filaComision}>- {fmt(l.comision_plataforma)} comisión</Text>
                  <Text style={estilos.filaLiquidacion}>{fmt(l.liquidacion_comida)} neto</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {(d.resumen || []).length === 0 && (
          <View style={estilos.vacio}>
            <Text style={{ fontSize: 48 }}>📊</Text>
            <Text style={estilos.vacioTxt}>Aún no hay pedidos conciliados</Text>
            <Text style={estilos.vacioSub}>Aquí verás el desglose de cada pedido entregado.</Text>
          </View>
        )}

        {/* Nota */}
        <View style={estilos.notaBox}>
          <Text style={estilos.notaTxt}>
            Todos los registros vienen del ledger de conciliación de VoyCorriendo. Si tienes dudas sobre algún monto, contacta a soporte.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  hero: {
    backgroundColor: colors.primario, paddingVertical: espacio.xl,
    alignItems: 'center', paddingHorizontal: espacio.lg,
  },
  heroLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  heroValor: { fontSize: 48, fontWeight: '900', color: '#FFF', marginVertical: espacio.xs },
  heroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm,
    padding: espacio.md,
  },
  stat: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.superficie,
    borderRadius: radio.md, padding: espacio.md,
    borderLeftWidth: 4, borderLeftColor: colors.borde,
  },
  statValor: { fontSize: 20, fontWeight: '900', color: colors.texto },
  statLabel: { fontSize: 12, color: colors.textoSuave, marginTop: 2, fontWeight: '600' },
  statSub:   { fontSize: 11, color: colors.textoSuave, marginTop: 2, lineHeight: 15 },

  infoBox: {
    marginHorizontal: espacio.md, backgroundColor: '#EFF6FF',
    borderRadius: radio.md, padding: espacio.md, borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoTitulo: { fontSize: 14, fontWeight: '800', color: '#1D4ED8', marginBottom: espacio.xs },
  infoTxt: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },

  seccion: { paddingHorizontal: espacio.md, marginTop: espacio.md },
  seccionTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  fila: {
    flexDirection: 'row', backgroundColor: colors.superficie,
    borderRadius: radio.md, padding: espacio.md, marginBottom: espacio.sm,
  },
  filaMetodo:     { fontSize: 14, fontWeight: '700', color: colors.texto },
  filaFecha:      { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  filaSubtotal:   { fontSize: 15, fontWeight: '800', color: colors.texto },
  filaComision:   { fontSize: 12, color: colors.error, marginTop: 2 },
  filaLiquidacion: { fontSize: 13, fontWeight: '700', color: colors.secundario, marginTop: 2 },

  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioTxt: { fontSize: 16, fontWeight: '700', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 13, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.xs },

  notaBox: {
    margin: espacio.md, backgroundColor: '#F3F4F6',
    borderRadius: radio.md, padding: espacio.md,
  },
  notaTxt: { fontSize: 12, color: colors.textoSuave, lineHeight: 18, textAlign: 'center' },
});
