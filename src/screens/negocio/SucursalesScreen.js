/**
 * SucursalesScreen — un mismo dueño, un negocio por plaza.
 *
 * Cada sucursal es un negocio completo para el servidor (sus pedidos, su
 * menú, su apertura, su deuda). Aquí el dueño ve todas, elige con cuál
 * trabajar y abre una nueva en otra plaza. La sucursal nueva nace con el
 * nombre, las fotos, el menú y los datos de cobro de la matriz; lo que es
 * del LOCAL (dirección, GPS, foto del local, comprobante) se llena en el
 * mismo asistente de alta, estando en el local, y el equipo la aprueba.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { negocioOnboardingAPI, negocioActivo } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const ESTADO = {
  aprobado:    { texto: 'Operando',      color: '#047857', fondo: '#ECFDF5' },
  en_revision: { texto: 'En revisión',   color: '#B45309', fondo: '#FFFBEB' },
  pendiente:   { texto: 'Sin terminar',  color: '#6B7280', fondo: '#F3F4F6' },
  rechazado:   { texto: 'Por corregir',  color: '#B91C1C', fondo: '#FEF2F2' },
};

export default function SucursalesScreen({ navigation }) {
  const [sucursales, setSucursales] = useState([]);
  const [activaId, setActivaId]     = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [creando, setCreando]       = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [{ data }, elegida] = await Promise.all([
        negocioOnboardingAPI.misSucursales(),
        negocioActivo.obtener(),
      ]);
      const lista = data?.data?.sucursales || [];
      setSucursales(lista);
      // Sin elección guardada (o una que ya no existe) el servidor usa la
      // matriz: la pantalla tiene que decir lo mismo.
      const valida = lista.find((s) => s.id === elegida);
      setActivaId(valida ? valida.id : (lista.find((s) => s.es_matriz) || lista[0])?.id || null);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No pudimos cargar tus sucursales.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Cambiar de sucursal reinicia el panel: todo lo que había en pantalla
  // (pedidos, apertura, menú) era de la otra.
  const usar = async (s, destino = 'DashboardNegocio') => {
    await negocioActivo.fijar(s.es_matriz ? null : s.id);
    navigation.dispatch(CommonActions.reset({
      index: destino === 'DashboardNegocio' ? 0 : 1,
      routes: destino === 'DashboardNegocio'
        ? [{ name: 'DashboardNegocio' }]
        : [{ name: 'DashboardNegocio' }, { name: destino }],
    }));
  };

  const abrirNueva = () => {
    Alert.alert(
      'Abrir sucursal en otra plaza',
      'Copiamos el nombre, las fotos, el menú y tus datos de cobro de tu negocio.\n\n'
      + 'Tú confirmas la dirección y la ubicación ESTANDO EN EL LOCAL NUEVO, y subes la foto '
      + 'del local y el comprobante de domicilio. La revisamos en menos de 48 horas.\n\n'
      + 'Solo puedes tener una sucursal por plaza.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: crear },
      ],
    );
  };

  const crear = async () => {
    setCreando(true);
    try {
      const { data } = await negocioOnboardingAPI.crearSucursal();
      const s = data?.data?.sucursal;
      if (!s?.id) throw new Error('sin sucursal');
      await usar({ ...s, es_matriz: false }, 'OnboardingNegocio');
    } catch (e) {
      Alert.alert('No se pudo crear la sucursal', e?.mensajeAmigable || 'Intenta de nuevo en un momento.');
    } finally {
      setCreando(false);
    }
  };

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
        data={sucursales}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: espacio.md, paddingBottom: espacio.xl }}
        ListHeaderComponent={
          <Text style={estilos.intro}>
            Elige con qué sucursal quieres trabajar. Los pedidos, el menú y el botón de abrir/cerrar
            son de la sucursal elegida.
          </Text>
        }
        renderItem={({ item: s }) => {
          const est = ESTADO[s.verificacion_estado] || ESTADO.pendiente;
          const activa = s.id === activaId;
          return (
            <Pressable
              onPress={() => (activa ? navigation.goBack() : usar(s))}
              style={({ pressed }) => [estilos.tarjeta, activa && estilos.tarjetaActiva, pressed && { opacity: 0.85 }]}
            >
              {s.logo
                ? <Image source={{ uri: s.logo }} style={estilos.logo} />
                : <View style={[estilos.logo, estilos.logoVacio]}><Text style={{ fontSize: 22 }}>🏪</Text></View>}
              <View style={{ flex: 1 }}>
                <View style={estilos.filaTitulo}>
                  <Text style={estilos.nombre} numberOfLines={1}>{s.plaza_nombre || 'Sin ubicar todavía'}</Text>
                  {s.es_matriz && <Text style={estilos.matriz}>MATRIZ</Text>}
                </View>
                <Text style={estilos.direccion} numberOfLines={1}>
                  {s.direccion ? `${s.direccion}${s.colonia ? `, ${s.colonia}` : ''}` : s.nombre}
                </Text>
                <View style={[estilos.pill, { backgroundColor: est.fondo }]}>
                  <Text style={[estilos.pillTxt, { color: est.color }]}>
                    {est.texto}{s.verificacion_estado === 'aprobado' ? (s.abierto_ahora ? ' · abierta' : ' · cerrada') : ''}
                  </Text>
                </View>
              </View>
              {activa
                ? <Ionicons name="checkmark-circle" size={26} color={colors.primario} />
                : <Ionicons name="chevron-forward" size={22} color={colors.textoSuave} />}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable
            style={[estilos.nueva, creando && { opacity: 0.6 }]}
            onPress={abrirNueva}
            disabled={creando}
          >
            {creando
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="add-circle-outline" size={22} color="#FFF" />
                  <Text style={estilos.nuevaTxt}>Abrir sucursal en otra plaza</Text>
                </>}
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo },
  intro: { fontSize: 13, color: colors.textoSuave, lineHeight: 19, marginBottom: espacio.md },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    backgroundColor: colors.superficie, borderRadius: radio.md, padding: espacio.md,
    marginBottom: espacio.sm, borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tarjetaActiva: { borderColor: colors.primario },
  logo: { width: 52, height: 52, borderRadius: 26 },
  logoVacio: { backgroundColor: colors.oscuroCard, alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { fontSize: 16, fontWeight: '800', color: colors.texto, flexShrink: 1 },
  matriz: {
    fontSize: 10, fontWeight: '900', color: colors.primario, letterSpacing: 0.5,
    borderWidth: 1, borderColor: colors.primario, borderRadius: radio.sm, paddingHorizontal: 5, paddingVertical: 1,
  },
  direccion: { fontSize: 12, color: colors.textoSuave, marginTop: 2, marginBottom: 6 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radio.full },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  nueva: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm,
    backgroundColor: colors.primario, borderRadius: radio.lg, paddingVertical: 15, marginTop: espacio.md,
  },
  nuevaTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
