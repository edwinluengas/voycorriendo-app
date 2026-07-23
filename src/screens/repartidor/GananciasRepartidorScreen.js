import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { repartidoresAPI, telegramAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';
import { PCT_DESCUENTO_PAGO_DIARIO } from '../../config/businessRules';

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

export default function GananciasRepartidorScreen({ navigation }) {
  const [datos, setDatos]         = useState(null);
  const [cargando, setCargando]       = useState(true);
  const [refrescando, setRefrescar]   = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [retirando, setRetirando]     = useState(false);
  const [vinculando, setVinculando]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await repartidoresAPI.ganancias();
      setDatos(data.data);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudieron cargar las ganancias.');
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const solicitarDeposito = () => {
    Alert.alert(
      'Solicitar depósito',
      `Se notificará al equipo de VoyCorriendo para procesar tu depósito.\n\nMonto disponible: ${fmt(datos?.fondo_efectivo || 0)}\n\n¿Confirmas la solicitud?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setSolicitando(true);
            try {
              await repartidoresAPI.solicitarDeposito();
              Alert.alert('¡Solicitud enviada!', 'El equipo de VoyCorriendo procesará tu depósito en 24-48 horas hábiles.');
            } catch (e) {
              Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.');
            } finally {
              setSolicitando(false);
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
  const totalGanado    = (parseFloat(d.ganancias_envios || 0) + parseFloat(d.propinas_cobradas || 0));
  const hayFondo       = parseFloat(d.fondo_efectivo || 0) > 0;
  const esDiaViernes   = new Date().getDay() === 5;

  const solicitarRetiroDiario = () => {
    const disponible = parseFloat(d.fondo_efectivo || 0);
    const feeDiario = Math.round(disponible * PCT_DESCUENTO_PAGO_DIARIO * 100) / 100;
    const neto = Math.round((disponible - feeDiario) * 100) / 100;
    if (neto <= 0) {
      Alert.alert('Saldo insuficiente', 'No tienes saldo disponible para el retiro diario.');
      return;
    }
    Alert.alert(
      '💸 Retiro diario',
      `Disponible: ${fmt(disponible)}\nDescuento por pago diario (5%): -${fmt(feeDiario)}\nRecibirás: ${fmt(neto)}\n\nEl corte del viernes es gratis. ¿Confirmas el retiro inmediato?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Retirar ${fmt(neto)}`,
          onPress: async () => {
            setRetirando(true);
            try {
              await repartidoresAPI.retiroDiario();
              Alert.alert('¡Solicitud enviada!', `El equipo procesará tu depósito de ${fmt(neto)} en 24 horas.`);
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

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: espacio.xl }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargar(); }} />}
      >
        {/* Resumen principal */}
        <View style={estilos.hero}>
          <Text style={estilos.heroLabel}>Total ganado</Text>
          <Text style={estilos.heroValor}>{fmt(totalGanado)}</Text>
          <Text style={estilos.heroSub}>{d.pedidos_completados || 0} entregas completadas</Text>
        </View>

        {/* Stats */}
        <View style={estilos.statsGrid}>
          <TarjetaStat
            label="Ganancias por envíos"
            valor={fmt(d.ganancias_envios)}
            color={colors.primario}
          />
          <TarjetaStat
            label="Propinas recibidas"
            valor={fmt(d.propinas_cobradas)}
            color="#FBBF24"
          />
          <TarjetaStat
            label="Efectivo en mano"
            valor={fmt(d.fondo_efectivo)}
            sub="Cobrado de pedidos en efectivo"
            color={colors.secundario}
          />
          <TarjetaStat
            label="Entregas totales"
            valor={d.total_pedidos ?? d.pedidos_completados ?? 0}
            color={colors.textoSuave}
          />
          <TarjetaStat
            label="Ingreso generado"
            valor={fmt(d.ingreso_generado)}
            sub="Total ganado en la vida"
            color="#2563EB"
          />
          <TarjetaStat
            label="Ingreso ya pagado"
            valor={fmt(d.ingreso_pagado)}
            sub="Efectivo + retiros confirmados"
            color={colors.secundario}
          />
          <TarjetaStat
            label="Por pagar"
            valor={fmt(d.ingreso_por_pagar)}
            sub="Pendiente de retiro/depósito"
            color="#F59E0B"
          />
        </View>

        {/* Saldo por cobrar: deuda con la plataforma por pedidos asignados
            no entregados que hubo que reembolsar al cliente. Se descuenta
            automáticamente de los próximos retiros. */}
        {parseFloat(d.saldo_por_cobrar || 0) > 0 && (
          <View style={estilos.saldoPorCobrarCard}>
            <Text style={estilos.saldoPorCobrarTitulo}>
              📒 Saldo por cobrar: -{fmt(d.saldo_por_cobrar)}
            </Text>
            <Text style={estilos.saldoPorCobrarSub}>
              Un pedido que tenías asignado no se entregó y se le regresó el dinero al cliente.
              Este monto se descontará automáticamente de tus próximos retiros.
            </Text>
          </View>
        )}

        {/* ── Calificación y regla de baja permanente ──────── */}
        {/* Siempre visible, aunque aún no tenga calificaciones — la
            consecuencia de esta regla es permanente, mejor que la conozca
            desde el primer día y no hasta que ya le esté por aplicar. */}
        {(() => {
          const hayCalificaciones = (d.pedidos_calificados || 0) > 0;
          const enAlerta = hayCalificaciones && d.calificacion_promedio < d.calificacion_min;
          return (
            <View style={[estilos.calificacionCard, enAlerta && estilos.calificacionCardAlerta]}>
              <View style={estilos.calificacionHeader}>
                <Text style={estilos.calificacionTitulo}>⭐ Tu calificación</Text>
                <Text style={[estilos.calificacionValor, enAlerta && { color: colors.error }]}>
                  {hayCalificaciones ? parseFloat(d.calificacion_promedio || 0).toFixed(1) : '—'}
                </Text>
              </View>
              <Text style={estilos.calificacionSub}>
                {hayCalificaciones
                  ? `Basado en ${d.pedidos_calificados} pedido${d.pedidos_calificados === 1 ? '' : 's'} calificado${d.pedidos_calificados === 1 ? '' : 's'}.`
                  : 'Aún sin calificaciones.'}
              </Text>
              <Text style={estilos.calificacionLeyenda}>
                ⚠️ Si tu promedio baja de {d.calificacion_min}★ después de {d.calificaciones_min_para_baja} pedidos calificados,
                tu cuenta se da de baja de forma <Text style={{ fontWeight: '800' }}>permanente</Text>: ni tú ni tu vehículo
                podrán volver a registrarse en VoyCorriendo.
              </Text>
            </View>
          );
        })()}

        {/* ── La plataforma te debe ────────────────────────── */}
        {parseFloat(d.por_depositar || 0) > 0 && (
          <View style={estilos.debeCard}>
            <Text style={estilos.debeTitulo}>💳 La plataforma te debe</Text>
            <Text style={estilos.debeValor}>{fmt(d.por_depositar)}</Text>
            <Text style={estilos.debeSub}>
              Tus envíos de pedidos con tarjeta aún no pagados. Se depositan el próximo viernes gratis.
            </Text>
          </View>
        )}

        {/* ── Retiro de fondos ─────────────────────────────── */}
        {hayFondo && (
          <View style={{ paddingHorizontal: espacio.lg, marginTop: espacio.md, gap: espacio.sm }}>
            {/* Viernes — depósito gratuito */}
            <Pressable
              style={[estilos.btnDeposito, solicitando && { opacity: 0.7 }]}
              onPress={solicitarDeposito}
              disabled={solicitando}
            >
              {solicitando
                ? <ActivityIndicator color="#FFF" />
                : <Text style={estilos.btnDepositoTxt}>📅 Solicitar depósito del viernes (gratis)</Text>
              }
            </Pressable>

            {/* Retiro diario — con fee de $10 */}
            {!esDiaViernes && (
              <Pressable
                style={[estilos.btnRetiroDiario, retirando && { opacity: 0.7 }]}
                onPress={solicitarRetiroDiario}
                disabled={retirando}
              >
                {retirando
                  ? <ActivityIndicator color={colors.primario} />
                  : (
                    <View>
                      <Text style={estilos.btnRetiroDiarioTxt}>⚡ Retiro diario — fee $10</Text>
                      <Text style={estilos.btnRetiroDiarioSub}>Recibirás {fmt(parseFloat(d.fondo_efectivo || 0) * (1 - PCT_DESCUENTO_PAGO_DIARIO))} hoy (5% menos que el viernes gratis)</Text>
                    </View>
                  )
                }
              </Pressable>
            )}

            <Text style={estilos.depositoSub}>
              Los depósitos del viernes son gratuitos. El retiro diario tiene un fee de $10 MXN.
            </Text>
          </View>
        )}

        {/* Histórico reciente */}
        {(d.pedidos_recientes || []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Últimas entregas</Text>
            {(d.pedidos_recientes || []).map((p) => (
              <View key={p.id} style={estilos.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.filaNum}>#{p.numero}</Text>
                  <Text style={estilos.filaFecha}>{fmtFecha(p.creado_en)}</Text>
                  <Text style={estilos.filaMetodo}>{p.metodo_pago === 'efectivo' ? '💵 Efectivo' : '💳 Digital'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={estilos.filaGanancia}>{fmt(p.pago_repartidor)}</Text>
                  {parseFloat(p.propina || 0) > 0 && (
                    <Text style={estilos.filaPropina}>+ {fmt(p.propina)} propina</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Vincular Telegram */}
        <View style={estilos.telegramBox}>
          <Text style={estilos.telegramTitulo}>🔔 Alertas en Telegram</Text>
          <Text style={estilos.telegramDesc}>
            Recibe notificaciones de nuevos pedidos, pagos y más directamente en Telegram.
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

        {/* Nota de transparencia */}
        <View style={estilos.notaBox}>
          <Text style={estilos.notaTxt}>
            Todas las ganancias se calculan en tiempo real desde el ledger de conciliación. Si tienes dudas sobre algún monto, contacta a soporte.
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
  statValor: { fontSize: 22, fontWeight: '900', color: colors.texto },
  statLabel: { fontSize: 12, color: colors.textoSuave, marginTop: 2, fontWeight: '600' },
  statSub:   { fontSize: 11, color: colors.textoSuave, marginTop: 2 },

  debeCard: {
    marginHorizontal: espacio.lg, marginTop: espacio.md,
    backgroundColor: '#EFF6FF', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#BFDBFE',
  },
  debeTitulo: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: espacio.xs },
  debeValor:  { fontSize: 28, fontWeight: '900', color: '#1D4ED8', marginBottom: espacio.xs },
  debeSub:    { fontSize: 12, color: '#374151', lineHeight: 17 },

  saldoPorCobrarCard: {
    marginHorizontal: espacio.lg, marginTop: espacio.md,
    backgroundColor: '#FEF2F2', borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: '#FCA5A5',
  },
  saldoPorCobrarTitulo: { fontSize: 14, fontWeight: '800', color: colors.error },
  saldoPorCobrarSub:    { fontSize: 12, color: '#374151', lineHeight: 17, marginTop: 4 },

  calificacionCard: {
    marginHorizontal: espacio.lg, marginTop: espacio.md,
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, borderWidth: 1, borderColor: colors.borde,
  },
  calificacionCardAlerta: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  calificacionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calificacionTitulo: { fontSize: 14, fontWeight: '800', color: colors.texto },
  calificacionValor:  { fontSize: 22, fontWeight: '900', color: colors.texto },
  calificacionSub:    { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  calificacionLeyenda: { fontSize: 12, color: '#7F1D1D', lineHeight: 17, marginTop: espacio.sm },

  btnDeposito: {
    backgroundColor: colors.secundario, borderRadius: radio.md,
    paddingVertical: espacio.md, alignItems: 'center',
  },
  btnDepositoTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  btnRetiroDiario: {
    borderRadius: radio.md, paddingVertical: espacio.md, alignItems: 'center',
    borderWidth: 2, borderColor: colors.primario, backgroundColor: '#FFF3E8',
  },
  btnRetiroDiarioTxt: { color: colors.primario, fontWeight: '800', fontSize: 15 },
  btnRetiroDiarioSub: { color: colors.primario, fontSize: 12, opacity: 0.8, marginTop: 2 },
  depositoSub: { fontSize: 12, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.sm, lineHeight: 17 },

  seccion: { paddingHorizontal: espacio.md, marginTop: espacio.md },
  seccionTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.sm },
  fila: {
    flexDirection: 'row', backgroundColor: colors.superficie,
    borderRadius: radio.md, padding: espacio.md, marginBottom: espacio.sm,
  },
  filaNum:     { fontSize: 14, fontWeight: '800', color: colors.texto },
  filaFecha:   { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  filaMetodo:  { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  filaGanancia: { fontSize: 18, fontWeight: '800', color: colors.primario },
  filaPropina:  { fontSize: 12, color: '#FBBF24', fontWeight: '700', marginTop: 2 },

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

  notaBox: {
    margin: espacio.md, backgroundColor: '#F3F4F6',
    borderRadius: radio.md, padding: espacio.md,
  },
  notaTxt: { fontSize: 12, color: colors.textoSuave, lineHeight: 18, textAlign: 'center' },
});
