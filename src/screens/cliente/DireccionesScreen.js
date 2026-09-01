import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usuariosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

export default function DireccionesScreen() {
  const [direcciones, setDirecciones] = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [modal, setModal]             = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [form, setForm]               = useState({ nombre: '', direccion: '', notas: '' });

  const cargar = async () => {
    try {
      const { data } = await usuariosAPI.misDirecciones();
      setDirecciones(data.data?.direcciones || []);
    } catch (_) {}
    finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const abrir  = () => { setForm({ nombre: '', direccion: '', notas: '' }); setModal(true); };
  const cerrar = () => setModal(false);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      return Alert.alert('Faltan datos', 'Escribe un nombre y la dirección.');
    }
    setGuardando(true);
    try {
      const { data } = await usuariosAPI.agregarDireccion(form);
      setDirecciones(data.data?.direcciones || []);
      cerrar();
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (id, nombre) => {
    Alert.alert('Eliminar dirección', `¿Eliminar "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            const { data } = await usuariosAPI.eliminarDireccion(id);
            setDirecciones(data.data?.direcciones || []);
          } catch (_) { Alert.alert('Error', 'No se pudo eliminar.'); }
        },
      },
    ]);
  };

  if (cargando) {
    return <View style={s.centrado}><ActivityIndicator color={colors.primario} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.contenedor} edges={['bottom']}>
      <FlatList
        data={direcciones}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: espacio.lg, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={s.vacio}>
            <Text style={s.vacioEmoji}>📍</Text>
            <Text style={s.vacioTxt}>No tienes direcciones guardadas</Text>
            <Text style={s.vacioSub}>Guarda tus lugares frecuentes para ordenar más rápido</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardIcono}><Text style={{ fontSize: 22 }}>📍</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardNombre}>{item.nombre}</Text>
              <Text style={s.cardDir}>{item.direccion}</Text>
              {!!item.notas && <Text style={s.cardNotas}>{item.notas}</Text>}
            </View>
            <Pressable onPress={() => eliminar(item.id, item.nombre)} style={s.cardEliminar}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </Pressable>
          </View>
        )}
      />

      {direcciones.length < 5 && (
        <View style={s.footer}>
          <Pressable style={s.btnAgregar} onPress={abrir}>
            <Text style={s.btnAgregarTxt}>+ Agregar dirección</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={modal} animationType="slide" transparent onRequestClose={cerrar}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <Text style={s.sheetTit}>Nueva dirección</Text>

            <Text style={s.label}>Nombre *</Text>
            <TextInput
              style={s.input}
              placeholder="Ej. Casa, Trabajo, Gym..."
              value={form.nombre}
              onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
            />
            <Text style={s.label}>Dirección *</Text>
            <TextInput
              style={s.input}
              placeholder="Calle, número, colonia"
              value={form.direccion}
              onChangeText={v => setForm(f => ({ ...f, direccion: v }))}
            />
            <Text style={s.label}>Notas (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Ej. Interior 3, color rojo..."
              value={form.notas}
              onChangeText={v => setForm(f => ({ ...f, notas: v }))}
            />

            <View style={{ flexDirection: 'row', gap: espacio.sm, marginTop: espacio.md }}>
              <Pressable style={[s.btn, s.btnCancelar]} onPress={cerrar}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={[s.btn, s.btnGuardar, guardando && { opacity: 0.6 }]} onPress={guardar} disabled={guardando}>
                <Text style={s.btnGuardarTxt}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vacio:      { alignItems: 'center', paddingTop: 80 },
  vacioEmoji: { fontSize: 56, marginBottom: espacio.md },
  vacioTxt:   { fontSize: 17, fontWeight: '700', color: colors.texto, marginBottom: espacio.xs },
  vacioSub:   { fontSize: 14, color: colors.textoSuave, textAlign: 'center', paddingHorizontal: espacio.xl },

  card: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.borde,
  },
  cardIcono:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4EB', alignItems: 'center', justifyContent: 'center', marginRight: espacio.md },
  cardNombre:  { fontSize: 15, fontWeight: '700', color: colors.texto },
  cardDir:     { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  cardNotas:   { fontSize: 12, color: colors.textoSuave, fontStyle: 'italic', marginTop: 2 },
  cardEliminar:{ padding: espacio.sm },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: espacio.lg, backgroundColor: colors.superficie, borderTopWidth: 1, borderTopColor: colors.borde },
  btnAgregar:    { backgroundColor: colors.primario, borderRadius: radio.md, paddingVertical: 14, alignItems: 'center' },
  btnAgregarTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: espacio.lg, paddingBottom: 40 },
  sheetTit:{ fontSize: 20, fontWeight: '800', color: colors.texto, marginBottom: espacio.lg },
  label:   { fontSize: 13, fontWeight: '600', color: colors.texto, marginBottom: 4, marginTop: espacio.sm },
  input:   { backgroundColor: colors.fondo, borderRadius: radio.sm, padding: espacio.md, fontSize: 15, borderWidth: 1, borderColor: colors.borde, color: colors.texto },

  btn:           { flex: 1, paddingVertical: 13, borderRadius: radio.md, alignItems: 'center' },
  btnCancelar:   { backgroundColor: colors.fondo, borderWidth: 1, borderColor: colors.borde },
  btnCancelarTxt:{ fontSize: 15, fontWeight: '700', color: colors.textoSuave },
  btnGuardar:    { backgroundColor: colors.primario },
  btnGuardarTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
