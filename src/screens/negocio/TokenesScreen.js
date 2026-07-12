import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { tokensAPI } from '../../api/client';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

// Colores por tier (por nombre, no por posición)
const TIER_COLORS = {
  silver:  { color: '#6B7280', bg: '#F9FAFB' },
  golden:  { color: colors.primario, bg: '#FFF3E8', destacado: true },
  diamond: { color: '#7C3AED', bg: '#F5F3FF' },
};

const formatFecha = (f) => {
  if (!f) return '';
  try {
    return new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) { return ''; }
};

export default function TokenesScreen() {
  const [saldo, setSaldo]       = useState(null);
  const [lotes, setLotes]       = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [comprando, setComprando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [resSaldo, resCatalogo] = await Promise.all([
        tokensAPI.saldo(),
        tokensAPI.packs(),
      ]);
      setSaldo(resSaldo.data.data?.total_tokens ?? 0);
      setLotes(resSaldo.data.data?.packs || []);
      setCatalogo(resCatalogo.data.data?.packs || []);
    } catch (_) {}
    finally { setCargando(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const comprar = async (pack) => {
    Alert.alert(
      'Confirmar compra',
      `¿Comprar pack ${pack.label} — ${pack.tokens} tokens por $${pack.precio.toLocaleString('es-MX')} MXN?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: async () => {
            setComprando(pack.id);
            try {
              const { data } = await tokensAPI.comprar(pack.id);

              if (data.sandbox) {
                Alert.alert('¡Tokens acreditados! (Sandbox)', `+${data.data.tokens_acreditados} tokens`);
                cargar();
                return;
              }

              const url = data.data?.sandbox_init_point || data.data?.init_point;
              if (url) {
                await Linking.openURL(url);
                Alert.alert('Pago iniciado', 'Completa el pago en Mercado Pago. Los tokens se acreditarán automáticamente.');
              }
            } catch (e) {
              Alert.alert('Error', e.mensajeAmigable || 'No se pudo procesar la compra.');
            } finally { setComprando(null); }
          },
        },
      ],
    );
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  const sinTokens = saldo === 0;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        {/* Saldo actual */}
        <View style={[estilos.saldoBox, sinTokens && estilos.saldoBoxVacio]}>
          <Text style={estilos.saldoEmoji}>{sinTokens ? '⚠️' : '🪙'}</Text>
          <Text style={estilos.saldoNum}>{saldo}</Text>
          <Text style={estilos.saldoLabel}>tokens disponibles</Text>
          {sinTokens && (
            <Text style={estilos.saldoAviso}>
              Sin tokens se cobra comisión por pedido entregado.
            </Text>
          )}
        </View>

        {/* Lotes activos */}
        {lotes.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Tus packs activos</Text>
            {lotes.map((p) => {
              const tierName = p.pack_type;
              const tierColors = TIER_COLORS[tierName] || TIER_COLORS.silver;
              return (
                <View key={p.id} style={[estilos.packActivo, { borderLeftColor: tierColors.color }]}>
                  <Text style={[estilos.packActivoNombre, { color: tierColors.color }]}>
                    {tierName.charAt(0).toUpperCase() + tierName.slice(1)}
                  </Text>
                  <Text style={estilos.packActivoTokens}>{p.tokens_remaining} tokens</Text>
                  <Text style={estilos.packActivoVence}>Vence {formatFecha(p.expires_at)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Catálogo de packs */}
        <Text style={estilos.seccionTitulo}>Comprar tokens</Text>
        <Text style={estilos.seccionSub}>
          Cada pedido confirmado descuenta 1 token. Los tokens son prepagados y no expiran antes de su vigencia.
        </Text>

        {catalogo.map((pack) => {
          const tierColors = TIER_COLORS[pack.id] || TIER_COLORS.silver;
          return (
            <View key={pack.id} style={[estilos.packCard, { borderColor: tierColors.color, backgroundColor: tierColors.bg }]}>
              {tierColors.destacado && (
                <View style={[estilos.badgeRecomendado, { backgroundColor: tierColors.color }]}>
                  <Text style={estilos.badgeRecomendadoTxt}>Más popular</Text>
                </View>
              )}
              <View style={estilos.packEncab}>
                <Text style={[estilos.packNombre, { color: tierColors.color }]}>{pack.label}</Text>
                <Text style={[estilos.packPrecio, { color: tierColors.color }]}>
                  ${pack.precio.toLocaleString('es-MX')} MXN
                </Text>
              </View>
              <View style={estilos.packDetalle}>
                <Chip label={`${pack.tokens} tokens`} />
                <Chip label={`$${Number(pack.costo_token).toFixed(0)}/token`} />
                <Chip label={`${pack.vigencia_dias} días`} />
              </View>
              <Boton
                titulo={comprando === pack.id ? 'Procesando…' : `Comprar ${pack.label}`}
                onPress={() => comprar(pack)}
                cargando={comprando === pack.id}
                estilo={{ marginTop: espacio.sm, backgroundColor: tierColors.color }}
              />
            </View>
          );
        })}

        <View style={estilos.nota}>
          <Text style={estilos.notaTxt}>
            El pago se procesa vía Mercado Pago. Los tokens se acreditan automáticamente al confirmar el pago.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Chip = ({ label }) => (
  <View style={estilos.chip}>
    <Text style={estilos.chipTxt}>{label}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },

  saldoBox: {
    backgroundColor: colors.superficie,
    borderRadius: radio.lg,
    padding: espacio.xl,
    alignItems: 'center',
    marginBottom: espacio.lg,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  saldoBoxVacio: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  saldoEmoji: { fontSize: 44 },
  saldoNum: { fontSize: 56, fontWeight: '800', color: colors.texto, marginTop: espacio.xs },
  saldoLabel: { fontSize: 14, color: colors.textoSuave, marginTop: 2 },
  saldoAviso: {
    marginTop: espacio.sm,
    fontSize: 13, color: '#B91C1C', textAlign: 'center', fontWeight: '600',
  },

  seccion: { marginBottom: espacio.lg },
  seccionTitulo: { fontSize: 17, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  seccionSub: { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.md, lineHeight: 18 },

  packActivo: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borde,
    borderLeftWidth: 4,
    gap: espacio.sm,
  },
  packActivoNombre: { fontSize: 14, fontWeight: '800', flex: 1 },
  packActivoTokens: { fontSize: 14, fontWeight: '800', color: colors.primario },
  packActivoVence: { fontSize: 11, color: colors.textoSuave },

  packCard: {
    borderRadius: radio.md,
    borderWidth: 2,
    padding: espacio.md,
    marginBottom: espacio.md,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeRecomendado: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: radio.sm,
  },
  badgeRecomendadoTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  packEncab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.sm },
  packNombre: { fontSize: 20, fontWeight: '800' },
  packPrecio: { fontSize: 20, fontWeight: '800' },
  packDetalle: { flexDirection: 'row', gap: espacio.xs, flexWrap: 'wrap' },

  chip: {
    backgroundColor: 'rgba(0,0,0,0.07)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radio.full,
  },
  chipTxt: { fontSize: 12, fontWeight: '600', color: colors.texto },

  nota: {
    backgroundColor: colors.superficie,
    borderRadius: radio.sm,
    padding: espacio.md,
    marginTop: espacio.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  notaTxt: { fontSize: 12, color: colors.textoSuave, lineHeight: 18, textAlign: 'center' },
});
