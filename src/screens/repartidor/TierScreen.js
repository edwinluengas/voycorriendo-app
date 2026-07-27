import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { repartidoresAPI } from '../../api/client';
import { FEE_ENVIO } from '../../config/businessRules';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

const TIERS = [
  {
    id: 'daily',
    label: 'Diario',
    emoji: '⚡',
    pago: `$${FEE_ENVIO.standard} MXN`,
    desc: 'Recibes tu pago el mismo día al completar cada entrega. Ideal si necesitas liquidez inmediata.',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FCD34D',
  },
  {
    id: 'weekly',
    label: 'Semanal',
    emoji: '📅',
    pago: `$${FEE_ENVIO.standard} MXN`,
    desc: 'Acumulas tus entregas y recibes el total cada viernes vía SPEI. Sin diferencia en la tarifa.',
    color: colors.primario,
    bg: '#FFF3E8',
    border: colors.primario,
  },
];

export default function TierScreen({ navigation }) {
  const [tierActual, setTierActual] = useState(null);
  const [seleccion, setSeleccion]   = useState(null);
  const [ruta, setRuta]             = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [perfil, rutaResp] = await Promise.all([
        repartidoresAPI.miPerfil(),
        repartidoresAPI.miRuta(),
      ]);
      const t = perfil.data?.data?.repartidor?.tier || 'weekly';
      setTierActual(t);
      setSeleccion(t);
      setRuta(rutaResp.data?.data?.batch);
    } catch (_) {}
    finally { setCargando(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const guardar = async () => {
    if (seleccion === tierActual) { navigation.goBack(); return; }
    setGuardando(true);
    try {
      await repartidoresAPI.actualizarPerfil({ tier: seleccion });
      setTierActual(seleccion);
      Alert.alert('Tier actualizado', `Ahora cobras en modo ${seleccion === 'daily' ? 'Diario' : 'Semanal'}.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No se pudo actualizar.');
    } finally { setGuardando(false); }
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.secundario} />
      </View>
    );
  }

  const pedidosEnRuta = ruta?.pedidos || [];

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        {/* Ruta activa */}
        {ruta && pedidosEnRuta.length > 0 && (
          <View style={estilos.rutaBox}>
            <Text style={estilos.rutaTitulo}>🗺️ Ruta activa — {pedidosEnRuta.length} pedido{pedidosEnRuta.length > 1 ? 's' : ''}</Text>
            {ruta.route_data?.duracion_total_min && (
              <Text style={estilos.rutaInfo}>
                ~{ruta.route_data.duracion_total_min} min · {ruta.route_data.distancia_total_km} km total
              </Text>
            )}
            {pedidosEnRuta.map((p, i) => (
              <View key={p.id} style={estilos.rutaParada}>
                <View style={[estilos.rutaNum, p.tipo_envio === 'express' && estilos.rutaNumExpress]}>
                  <Text style={estilos.rutaNumTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.rutaDir} numberOfLines={1}>{p.direccion_entrega}</Text>
                  <Text style={estilos.rutaTipo}>
                    {p.tipo_envio === 'express' ? '⚡ Express' : '📦 Estándar'} · {p.numero}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={estilos.titulo}>Cuándo cobrar</Text>
        <Text style={estilos.sub}>
          {`Tarifa regular $${FEE_ENVIO.standard} por entrega · $${FEE_ENVIO.express} por entrega express. `}
          Elige cuándo quieres recibir tu dinero.
        </Text>

        {TIERS.map((t) => {
          const activo = seleccion === t.id;
          const esActual = tierActual === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSeleccion(t.id)}
              style={[estilos.card, activo && { borderColor: t.border, backgroundColor: t.bg }]}
            >
              <View style={estilos.cardEncab}>
                <Text style={estilos.cardEmoji}>{t.emoji}</Text>
                <View style={{ flex: 1, marginLeft: espacio.sm }}>
                  <View style={estilos.cardTituloFila}>
                    <Text style={[estilos.cardLabel, activo && { color: t.color }]}>{t.label}</Text>
                    {esActual && (
                      <View style={[estilos.badgeActual, { backgroundColor: t.color }]}>
                        <Text style={estilos.badgeActualTxt}>Actual</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[estilos.cardPago, { color: t.color }]}>{t.pago} por entrega</Text>
                </View>
                <View style={[estilos.radio, activo && { borderColor: t.color, backgroundColor: t.color }]} />
              </View>
              <Text style={estilos.cardDesc}>{t.desc}</Text>
            </Pressable>
          );
        })}

        <View style={estilos.comparativa}>
          <Text style={estilos.comparativaTitulo}>Ejemplo: 10 entregas estándar en un día</Text>
          <View style={estilos.comparativaFila}>
            <Text style={estilos.comparativaLabel}>💰 Ganancia</Text>
            <Text style={estilos.comparativaValor}>${FEE_ENVIO.standard * 10} MXN</Text>
          </View>
          <View style={estilos.comparativaFila}>
            <Text style={estilos.comparativaLabel}>⚡ Express (si aplica)</Text>
            <Text style={estilos.comparativaValor}>${FEE_ENVIO.express} por entrega</Text>
          </View>
          {/* El bono por metas NO existe todavía (nada en el backend lo paga).
              Se quitó de aquí en vez de dejarlo prometido: mostrarle al
              repartidor un ingreso que nunca va a llegar es peor que no
              ofrecerlo. Cuando se active de verdad, se vuelve a poner. */}
          <View style={estilos.comparativaFila}>
            <Text style={estilos.comparativaLabel}>💵 Propinas</Text>
            <Text style={estilos.comparativaValor}>100% para ti</Text>
          </View>
        </View>

        <Boton
          titulo={seleccion === tierActual ? 'Sin cambios' : `Guardar — modo ${seleccion === 'daily' ? 'Diario' : 'Semanal'}`}
          onPress={guardar}
          cargando={guardando}
          estilo={{ marginTop: espacio.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg },

  rutaBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.lg,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  rutaTitulo: { fontSize: 15, fontWeight: '800', color: '#1B5E20', marginBottom: 2 },
  rutaInfo: { fontSize: 12, color: '#388E3C', marginBottom: espacio.sm },
  rutaParada: { flexDirection: 'row', alignItems: 'center', marginTop: espacio.xs, gap: espacio.sm },
  rutaNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#388E3C', alignItems: 'center', justifyContent: 'center',
  },
  rutaNumExpress: { backgroundColor: '#F59E0B' },
  rutaNumTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  rutaDir: { fontSize: 13, fontWeight: '600', color: colors.texto },
  rutaTipo: { fontSize: 11, color: colors.textoSuave, marginTop: 1 },

  titulo: { fontSize: 22, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  sub: { fontSize: 13, color: colors.textoSuave, lineHeight: 18, marginBottom: espacio.lg },

  card: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    borderWidth: 2,
    borderColor: colors.borde,
    padding: espacio.md,
    marginBottom: espacio.md,
  },
  cardEncab: { flexDirection: 'row', alignItems: 'center' },
  cardEmoji: { fontSize: 32 },
  cardTituloFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  cardLabel: { fontSize: 18, fontWeight: '800', color: colors.texto },
  badgeActual: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radio.full,
  },
  badgeActualTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  cardPago: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  cardDesc: { fontSize: 13, color: colors.textoSuave, lineHeight: 18, marginTop: espacio.sm },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.borde,
  },

  comparativa: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginTop: espacio.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  comparativaTitulo: { fontSize: 13, fontWeight: '700', color: colors.textoSuave, marginBottom: espacio.sm },
  comparativaFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  comparativaLabel: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  comparativaValor: { fontSize: 14, color: colors.texto },
});
