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

const PACKS = [
  {
    id: 'starter',
    label: 'Starter',
    tokens: 50,
    precio: 1050,
    vigencia: '60 días',
    costoPorToken: 21,
    color: '#6B7280',
    bg: '#F9FAFB',
  },
  {
    id: 'pro',
    label: 'Pro',
    tokens: 200,
    precio: 4000,
    vigencia: '90 días',
    costoPorToken: 20,
    color: colors.primario,
    bg: '#FFF3E8',
    destacado: true,
  },
  {
    id: 'elite',
    label: 'Elite',
    tokens: 500,
    precio: 9500,
    vigencia: '120 días',
    costoPorToken: 19,
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
];

const formatFecha = (f) => {
  if (!f) return '';
  try {
    return new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) { return ''; }
};

export default function TokenesScreen({ navigation }) {
  const [saldo, setSaldo]       = useState(null);
  const [packs, setPacks]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [comprando, setComprando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await tokensAPI.saldo();
      setSaldo(data.data?.total_tokens ?? 0);
      setPacks(data.data?.packs || []);
    } catch (_) {}
    finally { setCargando(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const comprar = async (packId) => {
    const label = packId.charAt(0).toUpperCase() + packId.slice(1);
    Alert.alert(
      'Confirmar compra',
      `¿Comprar pack ${label}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: async () => {
            setComprando(packId);
            try {
              const { data } = await tokensAPI.comprar(packId);

              // Sandbox: acreditado directo
              if (data.sandbox) {
                Alert.alert('¡Tokens acreditados! (Sandbox)', `+${data.data.tokens_acreditados} tokens`);
                cargar();
                return;
              }

              // Producción: abrir checkout de Mercado Pago
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
              Sin tokens se cobra $30 MXN por pedido entregado.
            </Text>
          )}
        </View>

        {/* Packs activos */}
        {packs.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Tus packs activos</Text>
            {packs.map((p) => (
              <View key={p.id} style={estilos.packActivo}>
                <Text style={estilos.packActivoNombre}>
                  {p.pack_type.charAt(0).toUpperCase() + p.pack_type.slice(1)}
                </Text>
                <Text style={estilos.packActivoTokens}>{p.tokens_remaining} tokens</Text>
                <Text style={estilos.packActivoVence}>Vence {formatFecha(p.expires_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Catálogo de packs */}
        <Text style={estilos.seccionTitulo}>Comprar tokens</Text>
        <Text style={estilos.seccionSub}>
          Cada pedido entregado descuenta 1 token. Los tokens son prepagados.
        </Text>

        {PACKS.map((p) => (
          <View key={p.id} style={[estilos.packCard, { borderColor: p.color, backgroundColor: p.bg }]}>
            {p.destacado && (
              <View style={[estilos.badgeRecomendado, { backgroundColor: p.color }]}>
                <Text style={estilos.badgeRecomendadoTxt}>Más popular</Text>
              </View>
            )}
            <View style={estilos.packEncab}>
              <Text style={[estilos.packNombre, { color: p.color }]}>{p.label}</Text>
              <Text style={[estilos.packPrecio, { color: p.color }]}>${p.precio.toLocaleString('es-MX')} MXN</Text>
            </View>
            <View style={estilos.packDetalle}>
              <Chip label={`${p.tokens} tokens`} />
              <Chip label={`$${p.costoPorToken}/token`} />
              <Chip label={p.vigencia} />
            </View>
            <Boton
              titulo={comprando === p.id ? 'Procesando…' : `Comprar ${p.label}`}
              onPress={() => comprar(p.id)}
              cargando={comprando === p.id}
              estilo={{ marginTop: espacio.sm, backgroundColor: p.color }}
            />
          </View>
        ))}

        <View style={estilos.nota}>
          <Text style={estilos.notaTxt}>
            🔒 El pago real se procesa vía Mercado Pago. Actualmente en modo sandbox.
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
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    fontWeight: '600',
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
    gap: espacio.sm,
  },
  packActivoNombre: { fontSize: 14, fontWeight: '700', color: colors.texto, flex: 1 },
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
    position: 'absolute',
    top: 0, right: 0,
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
