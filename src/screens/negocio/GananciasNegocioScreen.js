import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl, Linking,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { negocioOnboardingAPI, telegramAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';
import { LIMITE_PEDIDOS_DEUDA } from '../../config/businessRules';

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
  const [vinculando, setVinculando] = useState(false);
  const [pagando, setPagando]       = useState(false);
  const [refSpei, setRefSpei]       = useState('');
  const [mostrarSpei, setMostrarSpei] = useState(false);
  const [retirando, setRetirando]   = useState(false);

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

  const notificarPago = async () => {
    if (!refSpei.trim()) {
      Alert.alert('Referencia requerida', 'Escribe la referencia de tu transferencia SPEI.');
      return;
    }
    try {
      setPagando(true);
      await negocioOnboardingAPI.pagarDeuda(refSpei.trim(), datos?.deuda_plataforma);
      setRefSpei('');
      setMostrarSpei(false);
      Alert.alert('¡Notificación enviada!', 'Un operador verificará tu transferencia y desbloqueará tu cuenta en breve.');
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setPagando(false);
    }
  };

  const solicitarRetiroDiario = () => {
    Alert.alert(
      'Retiro diario',
      'Adelanto inmediato con 5% de descuento sobre tu saldo pendiente. El corte del viernes es gratis. ¿Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setRetirando(true);
            try {
              const { data } = await negocioOnboardingAPI.retiroDiario();
              Alert.alert('¡Solicitud enviada!', data.mensaje || 'El equipo procesará tu depósito en breve.');
              cargar();
            } catch (e) {
              Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.');
            } finally {
              setRetirando(false);
            }
          },
        },
      ]
    );
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  const d = datos || {};
  const deudaActual     = parseFloat(d.deuda_plataforma || 0);
  const pedidosPendientes = d.pedidos_efectivo_pendientes || 0;
  const limitePedidos    = d.limite_pedidos_deuda || LIMITE_PEDIDOS_DEUDA || 1;
  const pct             = Math.min(100, (pedidosPendientes / limitePedidos) * 100);
  const bloqueado        = d.bloqueado_por_deuda;
  // 80% ≈ el umbral real de aviso del backend (12 de 15 pedidos por default)
  const colorDeuda       = pct >= 100 ? '#DC2626' : pct >= 80 ? '#F59E0B' : colors.secundario;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: espacio.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargar(); }} />}
      >
        {/* ── Aviso de bloqueo ─────────────────────────────── */}
        {bloqueado && (
          <View style={estilos.bloqueadoBox}>
            <Text style={estilos.bloqueadoTitulo}>🚫 Cuenta suspendida</Text>
            <Text style={estilos.bloqueadoDesc}>
              Llegaste a {limitePedidos} pedidos en efectivo sin liquidar ({fmt(deudaActual)}). Transfiere el saldo adeudado por SPEI y notifícanos para reactivarte.
            </Text>
            <Pressable style={estilos.bloqueadoBtn} onPress={() => setMostrarSpei(true)}>
              <Text style={estilos.bloqueadoBtnTxt}>Pagar ahora →</Text>
            </Pressable>
          </View>
        )}

        {/* Hero */}
        <View style={estilos.hero}>
          <Text style={estilos.heroLabel}>Ventas en comida</Text>
          <Text style={estilos.heroValor}>{fmt(d.subtotal_productos)}</Text>
          <Text style={estilos.heroSub}>{d.pedidos_completados || 0} pedidos entregados</Text>
        </View>

        {/* ── Stats de período ─────────────────────────────── */}
        <View style={estilos.statsGrid}>
          <TarjetaStat label="Ventas hoy"    valor={fmt(d.ventas_hoy)}    color={colors.primario} />
          <TarjetaStat label="Ventas semana" valor={fmt(d.ventas_semana)} color={colors.primario} />
          <TarjetaStat label="Tarjeta/digital" valor={fmt(d.subtotal_tarjeta)}  sub="Cobrado en app"    color="#2563EB" />
          <TarjetaStat label="Efectivo"        valor={fmt(d.subtotal_efectivo)} sub="Cobrado en mano"   color={colors.texto} />
          <TarjetaStat label="Pedidos totales" valor={d.total_pedidos ?? d.pedidos_completados ?? 0} color={colors.textoSuave} />
          <TarjetaStat label="Ingreso generado" valor={fmt(d.ingreso_generado)} sub="Neto, toda la vida" color="#2563EB" />
          <TarjetaStat label="Ingreso ya pagado" valor={fmt(d.ingreso_pagado)} sub="Efectivo + cortes confirmados" color={colors.secundario} />
          <TarjetaStat label="Por pagar" valor={fmt(d.ingreso_por_pagar)} sub="Pendiente de corte/retiro" color="#F59E0B" />
        </View>

        {/* ── La plataforma te debe (tarjeta pendiente de viernes) ── */}
        <View style={estilos.infoCard}>
          <Text style={estilos.infoCardTitulo}>💳 La plataforma te debe</Text>
          <Text style={estilos.infoCardValor}>{fmt(d.plataforma_debe)}</Text>
          <Text style={estilos.infoCardSub}>
            Pedidos con tarjeta ya entregados. Te lo depositamos el próximo viernes (menos tus fees en efectivo).
          </Text>
          <View style={estilos.netoRow}>
            <Text style={estilos.netoLabel}>Neto estimado del viernes:</Text>
            <Text style={estilos.netoValor}>{fmt(d.neto_viernes)}</Text>
          </View>
          {parseFloat(d.plataforma_debe || 0) > 0 && !bloqueado && (
            <Pressable
              style={[estilos.btnRetiroDiario, retirando && { opacity: 0.7 }]}
              onPress={solicitarRetiroDiario}
              disabled={retirando}
            >
              {retirando
                ? <ActivityIndicator color={colors.primario} size="small" />
                : <Text style={estilos.btnRetiroDiarioTxt}>⚡ Adelantar hoy (con comisión)</Text>
              }
            </Pressable>
          )}
        </View>

        {/* ── Debes a la plataforma (fees efectivo) ─────────── */}
        <View style={[estilos.deudaCard, bloqueado && estilos.deudaCardRoja]}>
          <View style={estilos.deudaHeader}>
            <Text style={estilos.deudaTitulo}>
              {bloqueado ? '🔴 Debes a la plataforma' : '⚠️ Debes a la plataforma'}
            </Text>
            <Text style={[estilos.deudaValor, { color: colorDeuda }]}>{fmt(deudaActual)}</Text>
          </View>
          <Text style={estilos.deudaSub}>
            Fee de $35 por cada pedido en efectivo entregado. Se netea del depósito del viernes.
          </Text>
          {/* Barra de progreso hacia el límite de pedidos sin liquidar */}
          <View style={estilos.barraBg}>
            <View style={[estilos.barraRelleno, { width: `${pct}%`, backgroundColor: colorDeuda }]} />
          </View>
          <Text style={estilos.barraMeta}>
            {pedidosPendientes} de {limitePedidos} pedidos en efectivo · {pct >= 100 ? 'BLOQUEADO' : pct >= 80 ? 'Cerca del límite' : 'Dentro del límite'}
          </Text>
          {deudaActual > 0 && (
            <Pressable style={estilos.btnPagarDeuda} onPress={() => setMostrarSpei(!mostrarSpei)}>
              <Text style={estilos.btnPagarDeudaTxt}>🏦 Pagar ahora por SPEI</Text>
            </Pressable>
          )}
        </View>

        {/* ── Panel SPEI ────────────────────────────────────── */}
        {mostrarSpei && (
          <View style={estilos.speiBox}>
            <Text style={estilos.speiTitulo}>Datos para transferir</Text>
            <View style={estilos.speiDetalle}>
              <Text style={estilos.speiLabel}>Banco</Text>
              <Text style={estilos.speiValor}>{d.banco_plataforma || 'Citibanamex'}</Text>
            </View>
            <View style={estilos.speiDetalle}>
              <Text style={estilos.speiLabel}>CLABE</Text>
              <Pressable onPress={() => Alert.alert('CLABE copiada', d.clabe_plataforma)}>
                <Text style={[estilos.speiValor, { color: colors.primario, textDecorationLine: 'underline' }]}>
                  {d.clabe_plataforma}
                </Text>
              </Pressable>
            </View>
            <View style={estilos.speiDetalle}>
              <Text style={estilos.speiLabel}>Referencia</Text>
              <Text style={estilos.speiValor}>{d.referencia_spei}</Text>
            </View>
            <View style={estilos.speiDetalle}>
              <Text style={estilos.speiLabel}>Monto a pagar</Text>
              <Text style={[estilos.speiValor, { fontWeight: '900', color: colorDeuda }]}>{fmt(deudaActual)}</Text>
            </View>

            <Text style={estilos.speiInstruccion}>
              Después de transferir, escribe aquí la referencia de comprobante para que el equipo confirme:
            </Text>
            <TextInput
              style={estilos.speiInput}
              placeholder="Referencia de tu transferencia (opcional)"
              value={refSpei}
              onChangeText={setRefSpei}
              autoCapitalize="characters"
            />
            <Pressable
              style={[estilos.speiBtn, pagando && { opacity: 0.7 }]}
              onPress={notificarPago}
              disabled={pagando}
            >
              {pagando
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={estilos.speiBtnTxt}>Notificar pago realizado</Text>
              }
            </Pressable>
          </View>
        )}

        {/* ── Ledger reciente ───────────────────────────────── */}
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
                  <Text style={estilos.filaComision}>- $35 fee</Text>
                  <Text style={estilos.filaLiquidacion}>{fmt(parseFloat(l.subtotal_productos || 0) - 35)} neto</Text>
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

        {/* ── Cómo funciona ─────────────────────────────────── */}
        <View style={estilos.infoBox}>
          <Text style={estilos.infoTitulo}>¿Cómo funciona el modelo?</Text>
          <Text style={estilos.infoTxt}>
            • <Text style={{ fontWeight: '700' }}>Efectivo:</Text> el repartidor te paga en el momento. Tú quedas debiendo $35 de fee a la plataforma.{'\n'}
            • <Text style={{ fontWeight: '700' }}>Tarjeta/app:</Text> la plataforma recibe el pago y te deposita (ticket − $35) cada viernes.{'\n'}
            • El depósito del viernes <Text style={{ fontWeight: '700' }}>netea tu deuda de efectivo</Text> — no tendrás que pagar si tus pedidos digitales lo cubren.
          </Text>
        </View>

        {/* ── Vincular Telegram ─────────────────────────────── */}
        <View style={estilos.telegramBox}>
          <Text style={estilos.telegramTitulo}>🔔 Alertas en Telegram</Text>
          <Text style={estilos.telegramDesc}>
            Recibe notificaciones de nuevos pedidos y alertas de deuda directamente en Telegram.
          </Text>
          <Pressable
            style={[estilos.telegramBtn, vinculando && { opacity: 0.7 }]}
            disabled={vinculando}
            onPress={async () => {
              setVinculando(true);
              try {
                const { data } = await telegramAPI.vincularLink();
                const link = data.data?.link;
                if (link) await Linking.openURL(link);
              } catch (e) {
                Alert.alert('Error', e?.mensajeAmigable || 'No se pudo generar el enlace de Telegram.');
              } finally {
                setVinculando(false);
              }
            }}
          >
            {vinculando
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={estilos.telegramBtnTxt}>Vincular mi Telegram</Text>
            }
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  bloqueadoBox: {
    backgroundColor: '#FEF2F2', margin: espacio.md,
    borderRadius: radio.md, padding: espacio.lg,
    borderWidth: 2, borderColor: '#DC2626',
  },
  bloqueadoTitulo: { fontSize: 18, fontWeight: '900', color: '#991B1B', marginBottom: espacio.xs },
  bloqueadoDesc:   { fontSize: 13, color: '#7F1D1D', lineHeight: 19, marginBottom: espacio.md },
  bloqueadoBtn: {
    backgroundColor: '#DC2626', borderRadius: radio.md,
    paddingVertical: espacio.sm, alignItems: 'center',
  },
  bloqueadoBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

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

  infoCard: {
    marginHorizontal: espacio.md, marginBottom: espacio.md,
    backgroundColor: '#EFF6FF', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoCardTitulo: { fontSize: 14, fontWeight: '800', color: '#1E40AF', marginBottom: espacio.xs },
  infoCardValor:  { fontSize: 32, fontWeight: '900', color: '#1D4ED8', marginBottom: espacio.xs },
  infoCardSub:    { fontSize: 12, color: '#374151', lineHeight: 17 },
  netoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: espacio.sm, paddingTop: espacio.sm,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
  },
  netoLabel: { fontSize: 13, color: '#1E40AF', fontWeight: '600' },
  netoValor: { fontSize: 18, fontWeight: '900', color: '#1D4ED8' },
  btnRetiroDiario: {
    marginTop: espacio.sm, paddingTop: espacio.sm,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
    alignItems: 'center', paddingVertical: espacio.xs,
  },
  btnRetiroDiarioTxt: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },

  deudaCard: {
    marginHorizontal: espacio.md, marginBottom: espacio.md,
    backgroundColor: '#FFFBEB', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#FDE68A',
  },
  deudaCardRoja: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  deudaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.xs },
  deudaTitulo: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  deudaValor:  { fontSize: 24, fontWeight: '900' },
  deudaSub:    { fontSize: 12, color: '#78350F', lineHeight: 16, marginBottom: espacio.sm },
  barraBg: {
    height: 10, borderRadius: 5, backgroundColor: '#E5E7EB',
    overflow: 'hidden', marginBottom: espacio.xs,
  },
  barraRelleno: { height: '100%', borderRadius: 5 },
  barraMeta: { fontSize: 11, color: colors.textoSuave, marginBottom: espacio.sm },
  btnPagarDeuda: {
    backgroundColor: colors.primario, borderRadius: radio.md,
    paddingVertical: espacio.sm, alignItems: 'center', marginTop: espacio.xs,
  },
  btnPagarDeudaTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  speiBox: {
    marginHorizontal: espacio.md, marginBottom: espacio.md,
    backgroundColor: '#1A1A1A', borderRadius: radio.md,
    padding: espacio.lg, borderWidth: 1, borderColor: '#2C2C2E',
  },
  speiTitulo: { fontSize: 15, fontWeight: '800', color: '#E0E0E0', marginBottom: espacio.md },
  speiDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: espacio.sm },
  speiLabel:   { fontSize: 12, color: '#9E9E9E', flex: 1 },
  speiValor:   { fontSize: 13, fontWeight: '700', color: '#E0E0E0', flex: 2, textAlign: 'right' },
  speiInstruccion: { fontSize: 12, color: '#9E9E9E', marginTop: espacio.md, lineHeight: 17, marginBottom: espacio.sm },
  speiInput: {
    backgroundColor: '#2C2C2E', borderRadius: radio.sm,
    padding: espacio.sm, color: '#E0E0E0', fontSize: 13,
    marginBottom: espacio.sm, borderWidth: 1, borderColor: '#3C3C3E',
  },
  speiBtn: {
    backgroundColor: colors.secundario, borderRadius: radio.md,
    paddingVertical: espacio.sm, alignItems: 'center',
  },
  speiBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  infoBox: {
    marginHorizontal: espacio.md, marginBottom: espacio.md,
    backgroundColor: '#EFF6FF', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoTitulo: { fontSize: 14, fontWeight: '800', color: '#1D4ED8', marginBottom: espacio.xs },
  infoTxt: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },

  seccion: { paddingHorizontal: espacio.md, marginTop: espacio.md },
  seccionTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  fila: {
    flexDirection: 'row', backgroundColor: colors.superficie,
    borderRadius: radio.md, padding: espacio.md, marginBottom: espacio.sm,
  },
  filaMetodo:      { fontSize: 14, fontWeight: '700', color: colors.texto },
  filaFecha:       { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  filaSubtotal:    { fontSize: 15, fontWeight: '800', color: colors.texto },
  filaComision:    { fontSize: 12, color: colors.error, marginTop: 2 },
  filaLiquidacion: { fontSize: 13, fontWeight: '700', color: colors.secundario, marginTop: 2 },

  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioTxt: { fontSize: 16, fontWeight: '700', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 13, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.xs },

  telegramBox: {
    margin: espacio.md, backgroundColor: '#EFF6FF',
    borderRadius: radio.md, padding: espacio.lg,
    borderLeftWidth: 4, borderLeftColor: '#2563EB',
  },
  telegramTitulo: { fontSize: 15, fontWeight: '800', color: '#1E40AF', marginBottom: espacio.xs },
  telegramDesc:   { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: espacio.md },
  telegramBtn: {
    backgroundColor: '#2563EB', borderRadius: radio.md,
    paddingVertical: espacio.sm, alignItems: 'center',
  },
  telegramBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
