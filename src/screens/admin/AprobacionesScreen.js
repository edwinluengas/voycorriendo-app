import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, Alert,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { adminAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const TABS = [
  { key: 'negocios',     label: '🏪 Negocios' },
  { key: 'repartidores', label: '🛵 Repartidores' },
];

export default function AprobacionesScreen() {
  const [tab, setTab]             = useState('negocios');
  const [dash, setDash]           = useState({});
  const [cargando, setCargando]   = useState(true);
  const [refrescando, setRefrescar] = useState(false);
  const [accionando, setAccionando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await adminAPI.dashboard();
      setDash(data.data || data || {});
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo cargar el panel.');
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const negsP = (dash.negocios_pendientes ?? dash.negocios ?? []).filter(
    (n) => ['pendiente', 'en_revision'].includes(n.verificacion_estado),
  );
  const repsP = (dash.repartidores_pendientes ?? dash.repartidores ?? []).filter(
    (r) => ['pendiente', 'en_revision'].includes(r.estado),
  );

  const aprobarNeg = (id, nombre) => {
    Alert.alert('Aprobar negocio', `¿Aprobar "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar ✅',
        onPress: async () => {
          setAccionando(id);
          try { await adminAPI.aprobarNegocio(id); await cargar(); }
          catch (e) { Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.'); }
          finally { setAccionando(null); }
        },
      },
    ]);
  };

  const aprobarRep = (id, nombre) => {
    Alert.alert('Aprobar repartidor', `¿Aprobar a "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar ✅',
        onPress: async () => {
          setAccionando(id);
          try { await adminAPI.aprobarRepartidor(id); await cargar(); }
          catch (e) { Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.'); }
          finally { setAccionando(null); }
        },
      },
    ]);
  };

  if (cargando) {
    return <ActivityIndicator size="large" color={colors.primario} style={{ flex: 1 }} />;
  }

  const lista = tab === 'negocios' ? negsP : repsP;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* Estadísticas rápidas */}
      <View style={estilos.statsBar}>
        <Stat label="Pedidos hoy"   valor={dash.pedidos_hoy ?? '—'} />
        <View style={estilos.div} />
        <Stat label="Negocios"      valor={negsP.length} resaltado={negsP.length > 0} />
        <View style={estilos.div} />
        <Stat label="Repartidores"  valor={repsP.length} resaltado={repsP.length > 0} />
      </View>

      {/* Tabs */}
      <View style={estilos.tabs}>
        {TABS.map((t) => {
          const n = t.key === 'negocios' ? negsP.length : repsP.length;
          return (
            <Pressable
              key={t.key}
              style={[estilos.tab, tab === t.key && estilos.tabActiva]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[estilos.tabTxt, tab === t.key && estilos.tabTxtActiva]}>
                {t.label}
              </Text>
              {n > 0 && (
                <View style={estilos.badge}>
                  <Text style={estilos.badgeTxt}>{n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={lista}
        keyExtractor={(it) => it.id}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargar(); }} />
        }
        contentContainerStyle={lista.length === 0
          ? { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl }
          : { padding: espacio.md, paddingBottom: espacio.xl }}
        ListEmptyComponent={
          <>
            <Text style={{ fontSize: 56, textAlign: 'center' }}>✅</Text>
            <Text style={estilos.vacioTxt}>
              No hay {tab === 'negocios' ? 'negocios' : 'repartidores'} pendientes
            </Text>
          </>
        }
        renderItem={({ item }) =>
          tab === 'negocios' ? (
            <TarjetaNegocio
              negocio={item}
              enProceso={accionando === item.id}
              onAprobar={() => aprobarNeg(item.id, item.nombre)}
            />
          ) : (
            <TarjetaRepartidor
              repartidor={item}
              enProceso={accionando === item.id}
              onAprobar={() => aprobarRep(item.id, item.usuario?.nombre || item.nombre || 'Sin nombre')}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function Stat({ label, valor, resaltado }) {
  return (
    <View style={estilos.stat}>
      <Text style={[estilos.statVal, resaltado && estilos.statValAlert]}>{valor}</Text>
      <Text style={estilos.statLbl}>{label}</Text>
    </View>
  );
}

function TarjetaNegocio({ negocio, enProceso, onAprobar }) {
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabFila}>
        <Text style={estilos.nombre} numberOfLines={1}>🏪 {negocio.nombre}</Text>
        <EstadoBadge estado={negocio.verificacion_estado} />
      </View>
      <Text style={estilos.sub}>{negocio.categoria}  ·  📞 {negocio.telefono || 'Sin tel'}</Text>
      {negocio.email ? <Text style={estilos.sub}>✉️ {negocio.email}</Text> : null}
      {negocio.direccion ? <Text style={estilos.sub}>📍 {negocio.direccion}</Text> : null}
      {negocio.verificacion_nota ? (
        <Text style={estilos.nota}>📝 {negocio.verificacion_nota}</Text>
      ) : null}
      <Pressable
        style={[estilos.btnAprobar, enProceso && estilos.btnDeshabilitado]}
        onPress={onAprobar}
        disabled={enProceso}
      >
        {enProceso
          ? <ActivityIndicator color="#FFF" />
          : <Text style={estilos.btnTxt}>✅ Aprobar negocio</Text>}
      </Pressable>
    </View>
  );
}

function TarjetaRepartidor({ repartidor, enProceso, onAprobar }) {
  const nombre = repartidor.usuario?.nombre || repartidor.nombre || 'Sin nombre';
  const tel    = repartidor.usuario?.telefono || '';
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabFila}>
        <Text style={estilos.nombre} numberOfLines={1}>🛵 {nombre}</Text>
        <EstadoBadge estado={repartidor.estado} />
      </View>
      {tel ? <Text style={estilos.sub}>📞 {tel}</Text> : null}
      {repartidor.tipo_vehiculo ? (
        <Text style={estilos.sub}>🏍️ {repartidor.tipo_vehiculo}</Text>
      ) : null}
      {repartidor.placa_vehiculo ? (
        <Text style={estilos.sub}>🪪 Placa: {repartidor.placa_vehiculo}</Text>
      ) : null}
      {repartidor.mensaje ? (
        <Text style={estilos.nota}>📝 {repartidor.mensaje}</Text>
      ) : null}
      <Pressable
        style={[estilos.btnAprobar, enProceso && estilos.btnDeshabilitado]}
        onPress={onAprobar}
        disabled={enProceso}
      >
        {enProceso
          ? <ActivityIndicator color="#FFF" />
          : <Text style={estilos.btnTxt}>✅ Aprobar repartidor</Text>}
      </Pressable>
    </View>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    pendiente:   { color: colors.advertencia, txt: 'Pendiente' },
    en_revision: { color: colors.secundario,  txt: 'En revisión' },
    rechazado:   { color: colors.error,       txt: 'Rechazado' },
  }[estado] || { color: colors.textoSuave, txt: estado };

  return (
    <View style={[estilos.pill, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
      <Text style={[estilos.pillTxt, { color: cfg.color }]}>{cfg.txt}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primario, padding: espacio.md,
  },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statValAlert: { color: '#FFD700' },
  statLbl:  { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  div:      { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: espacio.sm, gap: espacio.xs,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActiva:    { borderBottomColor: colors.primario },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: colors.textoSuave },
  tabTxtActiva: { color: colors.primario, fontWeight: '800' },
  badge: {
    backgroundColor: colors.primario, borderRadius: radio.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  tarjeta: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.advertencia,
  },
  encabFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.xs },
  nombre:   { fontSize: 16, fontWeight: '800', color: colors.texto, flex: 1, marginRight: espacio.sm },
  sub:      { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  nota:     { fontSize: 12, color: colors.advertencia, marginTop: espacio.xs, fontStyle: 'italic' },

  pill: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radio.full, borderWidth: 1,
  },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  btnAprobar: {
    marginTop: espacio.md,
    backgroundColor: colors.exito,
    paddingVertical: 12,
    borderRadius: radio.md,
    alignItems: 'center',
  },
  btnDeshabilitado: { opacity: 0.6 },
  btnTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  vacioTxt: {
    fontSize: 16, color: colors.textoSuave,
    marginTop: espacio.md, textAlign: 'center',
  },
});
