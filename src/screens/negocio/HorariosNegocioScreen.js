/**
 * HorariosNegocioScreen — editar los horarios de atención después de
 * aprobado. El onboarding solo dejaba prender/apagar días con un horario
 * fijo (09:00–21:00) y prometía "podrás editarlos desde el dashboard",
 * pero esa pantalla nunca existía — este es ese hueco cerrado.
 *
 * Selección de hora por lista (no texto libre): garantiza que el valor
 * guardado siempre sea un HH:MM válido, sin parseo ni validación de
 * formato del lado del usuario.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Boton from '../../components/Boton';
import { negocioOnboardingAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const DIAS = [
  { id: 'lun', label: 'Lunes' },
  { id: 'mar', label: 'Martes' },
  { id: 'mie', label: 'Miércoles' },
  { id: 'jue', label: 'Jueves' },
  { id: 'vie', label: 'Viernes' },
  { id: 'sab', label: 'Sábado' },
  { id: 'dom', label: 'Domingo' },
];

// Horas en pasos de 30 min — cubre cualquier apertura/cierre real de un
// restaurante, incluyendo trasnochados (ej. abre 18:00, cierra 02:00 del
// día siguiente — el modelo no distingue día de cierre, solo el string).
const HORAS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

export default function HorariosNegocioScreen({ navigation }) {
  const [horarios, setHorarios] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [selector, setSelector] = useState(null); // { dia, campo } o null

  const cargar = useCallback(async () => {
    try {
      const { data } = await negocioOnboardingAPI.miNegocio();
      setHorarios(data.data?.negocio?.horarios || {});
    } catch (e) {
      Alert.alert('Error', 'No pudimos cargar tus horarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const togglearDia = (dia) => {
    setHorarios((h) => {
      const actual = h[dia];
      if (actual?.abre && actual?.cierra) {
        const { [dia]: _, ...resto } = h;
        return resto;
      }
      return { ...h, [dia]: { abre: '09:00', cierra: '21:00' } };
    });
  };

  const elegirHora = (hora) => {
    if (!selector) return;
    setHorarios((h) => ({
      ...h,
      [selector.dia]: { ...h[selector.dia], [selector.campo]: hora },
    }));
    setSelector(null);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await negocioOnboardingAPI.actualizarPerfil({ horarios });
      Alert.alert('¡Listo!', 'Tus horarios se actualizaron.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No pudimos guardar tus horarios.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[estilos.contenedor, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: espacio.lg, paddingBottom: espacio.xl }}>
        <Text style={estilos.titulo}>⏰ Horarios de atención</Text>
        <Text style={estilos.subtitulo}>
          Marca los días que abres y toca la hora para cambiarla — por ejemplo, si hoy abres o cierras más tarde de lo normal.
        </Text>

        {DIAS.map((d) => {
          const h = horarios[d.id];
          const abierto = !!(h?.abre && h?.cierra);
          return (
            <View key={d.id} style={estilos.filaDia}>
              <Pressable style={estilos.filaHeader} onPress={() => togglearDia(d.id)}>
                <Text style={estilos.diaNombre}>{d.label}</Text>
                <View style={[estilos.toggle, abierto && estilos.toggleActivo]}>
                  <View style={[estilos.toggleBolita, abierto && estilos.toggleBolitaActiva]} />
                </View>
              </Pressable>
              {abierto ? (
                <View style={estilos.horasRow}>
                  <Pressable style={estilos.horaChip} onPress={() => setSelector({ dia: d.id, campo: 'abre' })}>
                    <Text style={estilos.horaChipLabel}>Abre</Text>
                    <Text style={estilos.horaChipValor}>{h.abre}</Text>
                  </Pressable>
                  <Text style={estilos.horaGuion}>—</Text>
                  <Pressable style={estilos.horaChip} onPress={() => setSelector({ dia: d.id, campo: 'cierra' })}>
                    <Text style={estilos.horaChipLabel}>Cierra</Text>
                    <Text style={estilos.horaChipValor}>{h.cierra}</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={estilos.cerradoTxt}>Cerrado todo el día</Text>
              )}
            </View>
          );
        })}

        <Boton
          titulo={guardando ? 'Guardando...' : 'Guardar horarios'}
          onPress={guardar}
          cargando={guardando}
          estilo={{ marginTop: espacio.lg }}
        />
      </ScrollView>

      {/* Selector de hora — lista, no texto libre: siempre válido */}
      <Modal visible={!!selector} transparent animationType="slide" onRequestClose={() => setSelector(null)}>
        <Pressable style={estilos.modalFondo} onPress={() => setSelector(null)}>
          <View style={estilos.modalCaja} onStartShouldSetResponder={() => true}>
            <Text style={estilos.modalTitulo}>
              {selector?.campo === 'abre' ? 'Hora de apertura' : 'Hora de cierre'}
            </Text>
            <FlatList
              data={HORAS}
              keyExtractor={(h) => h}
              style={{ maxHeight: 320 }}
              initialScrollIndex={selector ? Math.max(0, HORAS.indexOf(horarios[selector.dia]?.[selector.campo] || '09:00')) : 0}
              getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
              renderItem={({ item }) => (
                <Pressable style={estilos.horaOpcion} onPress={() => elegirHora(item)}>
                  <Text style={estilos.horaOpcionTxt}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  titulo: { fontSize: 22, fontWeight: '900', color: colors.texto, marginBottom: espacio.xs },
  subtitulo: { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.lg, lineHeight: 18 },

  filaDia: {
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm,
    borderWidth: 1, borderColor: colors.borde,
  },
  filaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diaNombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: '#CCC',
    padding: 3, justifyContent: 'center',
  },
  toggleActivo: { backgroundColor: colors.exito },
  toggleBolita: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleBolitaActiva: { alignSelf: 'flex-end' },

  horasRow: { flexDirection: 'row', alignItems: 'center', marginTop: espacio.sm, gap: espacio.sm },
  horaChip: {
    flex: 1, backgroundColor: colors.fondo, borderRadius: radio.sm,
    borderWidth: 1, borderColor: colors.borde,
    paddingVertical: espacio.sm, paddingHorizontal: espacio.md, alignItems: 'center',
  },
  horaChipLabel: { fontSize: 10, color: colors.textoSuave, fontWeight: '700', textTransform: 'uppercase' },
  horaChipValor: { fontSize: 18, color: colors.primario, fontWeight: '800', marginTop: 2 },
  horaGuion: { color: colors.textoSuave, fontWeight: '700' },
  cerradoTxt: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.sm, fontStyle: 'italic' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: espacio.lg, maxHeight: '60%',
  },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: espacio.md, textAlign: 'center' },
  horaOpcion: { paddingVertical: 13, alignItems: 'center', height: 48, justifyContent: 'center' },
  horaOpcionTxt: { fontSize: 16, color: colors.texto, fontWeight: '600' },
});
