/**
 * ProductosNegocioScreen
 * Gestión de productos del negocio: crear, editar, toggle disponible, subir foto.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  ActivityIndicator, Alert, Switch, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { negocioOnboardingAPI } from '../../api/client';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

export default function ProductosNegocioScreen() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [modal, setModal]         = useState(null); // null | 'nuevo' | producto
  const [guardando, setGuardando] = useState(false);
  const [form, setForm]           = useState({ nombre: '', descripcion: '', precio: '', categoria: 'general' });

  const cargar = useCallback(async () => {
    try {
      const { data } = await negocioOnboardingAPI.misProductos();
      setProductos(data.data?.productos || []);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo cargar los productos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const abrirNuevo = () => {
    setForm({ nombre: '', descripcion: '', precio: '', categoria: 'general' });
    setModal('nuevo');
  };

  const abrirEditar = (prod) => {
    setForm({
      id: prod.id,
      nombre: prod.nombre || '',
      descripcion: prod.descripcion || '',
      precio: String(prod.precio ?? ''),
      categoria: prod.categoria || 'general',
    });
    setModal('editar');
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) {
      Alert.alert('Faltan datos', 'El nombre y el precio son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      if (modal === 'nuevo') {
        await negocioOnboardingAPI.crearProducto({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          precio: parseFloat(form.precio),
          categoria: form.categoria,
        });
      } else {
        await negocioOnboardingAPI.actualizarProducto(form.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          precio: parseFloat(form.precio),
          categoria: form.categoria,
        });
      }
      setModal(null);
      await cargar();
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo guardar el producto.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleDisponible = async (prod) => {
    try {
      await negocioOnboardingAPI.actualizarProducto(prod.id, { disponible: !prod.disponible });
      setProductos((ps) => ps.map((p) => p.id === prod.id ? { ...p, disponible: !p.disponible } : p));
    } catch (e) {
      Alert.alert('Error', 'No se pudo cambiar la disponibilidad.');
    }
  };

  const subirFoto = async (prod) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    try {
      await negocioOnboardingAPI.subirFotoProducto(prod.id, asset.base64, mime);
      await cargar();
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir la foto.');
    }
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={productos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: espacio.md, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={estilos.vacio}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={estilos.vacioTxt}>Aún no tienes productos</Text>
            <Text style={estilos.vacioSub}>Toca el botón "+" para agregar tu primer platillo o artículo.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[estilos.tarjeta, !item.disponible && estilos.tarjetaInactiva]}>
            {item.foto_url ? (
              <Image source={{ uri: item.foto_url }} style={estilos.foto} />
            ) : (
              <Pressable style={estilos.fotoPlaceholder} onPress={() => subirFoto(item)}>
                <Text style={estilos.fotoPlaceholderTxt}>📷</Text>
              </Pressable>
            )}
            <View style={estilos.info}>
              <Text style={estilos.nombre} numberOfLines={1}>{item.nombre}</Text>
              {!!item.descripcion && (
                <Text style={estilos.desc} numberOfLines={2}>{item.descripcion}</Text>
              )}
              <Text style={estilos.precio}>${parseFloat(item.precio).toFixed(2)}</Text>
              <View style={estilos.acciones}>
                <Pressable style={estilos.btnEditar} onPress={() => abrirEditar(item)}>
                  <Text style={estilos.btnEditarTxt}>✏️ Editar</Text>
                </Pressable>
                {item.foto_url ? (
                  <Pressable style={estilos.btnFoto} onPress={() => subirFoto(item)}>
                    <Text style={estilos.btnFotoTxt}>🔄 Foto</Text>
                  </Pressable>
                ) : (
                  <Pressable style={estilos.btnFoto} onPress={() => subirFoto(item)}>
                    <Text style={estilos.btnFotoTxt}>📷 Foto</Text>
                  </Pressable>
                )}
                <Switch
                  value={!!item.disponible}
                  onValueChange={() => toggleDisponible(item)}
                  trackColor={{ false: '#CCC', true: colors.exito }}
                  thumbColor="#FFF"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>
          </View>
        )}
      />

      {/* Botón flotante "+" */}
      <Pressable style={estilos.fab} onPress={abrirNuevo}>
        <Text style={estilos.fabTxt}>+</Text>
      </Pressable>

      {/* Modal nuevo / editar */}
      <Modal visible={!!modal} animationType="slide" transparent>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContenido}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={estilos.modalTitulo}>
                {modal === 'nuevo' ? '➕ Nuevo producto' : '✏️ Editar producto'}
              </Text>

              <Campo
                label="Nombre *"
                value={form.nombre}
                onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Ej. Tacos de camarón"
              />
              <Campo
                label="Descripción"
                value={form.descripcion}
                onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                placeholder="Ingredientes, porciones, etc."
                multiline
              />
              <Campo
                label="Precio *"
                value={form.precio}
                onChangeText={(v) => setForm((f) => ({ ...f, precio: v }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <Campo
                label="Categoría"
                value={form.categoria}
                onChangeText={(v) => setForm((f) => ({ ...f, categoria: v }))}
                placeholder="Ej. entradas, bebidas, postres"
              />

              <View style={{ flexDirection: 'row', gap: espacio.sm, marginTop: espacio.md }}>
                <Pressable
                  style={[estilos.btnModal, { flex: 1, backgroundColor: colors.fondo, borderWidth: 1, borderColor: colors.borde }]}
                  onPress={() => setModal(null)}
                >
                  <Text style={{ color: colors.texto, fontWeight: '700' }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[estilos.btnModal, { flex: 2, backgroundColor: colors.primario }]}
                  onPress={guardar}
                  disabled={guardando}
                >
                  {guardando
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={{ color: '#FFF', fontWeight: '800' }}>
                        {modal === 'nuevo' ? 'Agregar' : 'Guardar cambios'}
                      </Text>
                  }
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  tarjeta: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    marginBottom: espacio.sm,
    overflow: 'hidden',
  },
  tarjetaInactiva: { opacity: 0.55 },

  foto: { width: 90, height: 90, resizeMode: 'cover' },
  fotoPlaceholder: {
    width: 90, height: 90,
    backgroundColor: '#FFE6D1',
    alignItems: 'center', justifyContent: 'center',
  },
  fotoPlaceholderTxt: { fontSize: 28 },

  info: { flex: 1, padding: espacio.sm },
  nombre: { fontSize: 15, fontWeight: '800', color: colors.texto },
  desc: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  precio: { fontSize: 16, fontWeight: '700', color: colors.primario, marginTop: espacio.xs },

  acciones: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, marginTop: espacio.xs, flexWrap: 'wrap' },
  btnEditar: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: radio.full },
  btnEditarTxt: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  btnFoto: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F0FDF4', borderRadius: radio.full },
  btnFotoTxt: { fontSize: 12, fontWeight: '700', color: '#16A34A' },

  vacio: { alignItems: 'center', marginTop: 60, paddingHorizontal: espacio.lg },
  vacioTxt: { fontSize: 18, fontWeight: '700', color: colors.texto, marginTop: espacio.md },
  vacioSub: { fontSize: 13, color: colors.textoSuave, textAlign: 'center', marginTop: espacio.xs },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabTxt: { color: '#FFF', fontSize: 28, fontWeight: '800', lineHeight: 32 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: espacio.lg,
    maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: colors.texto, marginBottom: espacio.md },
  btnModal: {
    paddingVertical: 14, borderRadius: radio.md,
    alignItems: 'center',
  },
});
