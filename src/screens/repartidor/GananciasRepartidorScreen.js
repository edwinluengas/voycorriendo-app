import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { repartidoresAPI, telegramAPI } from '../../api/client';
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

export default function GananciasRepartidorScreen({ navigation }) {
  const [datos, setDatos]         = useState(null);
  const [cargando, setCargando]       = useState(true);
  const [refrescando, setRefrescar]   = useState(false);
  const [solicitando, setSolicitando] = useState(false);
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
            label="Fondo efectivo"
            valor={fmt(d.fondo_efectivo)}
            sub="Efectivo cobrado pendiente"
            color={colors.secundario}
          />
          <TarjetaStat
            label="Entregas totales"
            valor={d.pedidos_completados || 0}
            color={colors.textoSuave}
          />
        </View>

        {/* Botón solicitar depósito */}
        {hayFondo && (
          <View style={{ paddingHorizontal: espacio.lg, marginTop: espacio.md }}>
            <Pressable
              style={[estilos.btnDeposito, solicitando && { opacity: 0.7 }]}
              onPress={solicitarDeposito}
              disabled={solicitando}
            >
              {solicitando
                ? <ActivityIndicator color="#FFF" />
                : <Text style={estilos.btnDepositoTxt}>💸 Solicitar depósito ahora</Text>
              }
            </Pressable>
            <Text style={estilos.depositoSub}>
              El equipo procesará tu depósito a la CLABE registrada en 24-48 horas hábiles.
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

  btnDeposito: {
    backgroundColor: colors.secundario, borderRadius: radio.md,
    paddingVertical: espacio.md, alignItems: 'center',
  },
  btnDepositoTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
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
