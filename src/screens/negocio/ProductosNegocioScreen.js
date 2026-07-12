/**
 * ProductosNegocioScreen
 * Gestión de productos del negocio: crear, editar, toggle disponible, subir foto.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  ActivityIndicator, Alert, Switch, Modal, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { negocioOnboardingAPI } from '../../api/client';
import Campo from '../../components/Campo';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

// ─── Estado vacío de opciones ─────────────────────────────
const opcionesVacias = () => ({
  activo:   false,
  titulo:   '',
  tipo:     'radio',    // 'radio' = elegir una | 'extras' = ingredientes adicionales
  requerida: true,
  valores:  [],
});

const CATEGORIAS = [
  'Entradas', 'Tacos', 'Hamburguesas', 'Pizzas', 'Mariscos', 'Sopas y caldos',
  'Ensaladas', 'Desayunos', 'Parrilla', 'Bebidas', 'Postres', 'Comida corrida',
  'Especiales', 'Para compartir', 'Vegetariano', 'Otros',
];

export default function ProductosNegocioScreen() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [modal, setModal]         = useState(null); // null | 'nuevo' | 'editar'
  const [guardando, setGuardando] = useState(false);
  const [form, setForm]           = useState({ nombre: '', descripcion: '', precio: '', categoria: 'Entradas' });
  const [opciones, setOpciones]   = useState(opcionesVacias());
  const [nuevoValor, setNuevoValor] = useState('');
  const [nuevoExtra, setNuevoExtra] = useState('');

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
    setForm({ nombre: '', descripcion: '', precio: '', categoria: 'Entradas' });
    setOpciones(opcionesVacias());
    setNuevoValor(''); setNuevoExtra('');
    setModal('nuevo');
  };

  const abrirEditar = (prod) => {
    setForm({
      id: prod.id,
      nombre: prod.nombre || '',
      descripcion: prod.descripcion || '',
      precio: String(prod.precio ?? ''),
      categoria: prod.categoria || 'Entradas',
    });
    // Cargar especificaciones existentes si las hay
    if (prod.opciones && Object.keys(prod.opciones).length > 0) {
      setOpciones({
        activo:    true,
        titulo:    prod.opciones.titulo || '',
        tipo:      prod.opciones.tipo || 'radio',
        requerida: prod.opciones.requerida !== false,
        valores:   prod.opciones.valores || [],
      });
    } else {
      setOpciones(opcionesVacias());
    }
    setNuevoValor(''); setNuevoExtra('');
    setModal('editar');
  };

  const agregarValor = () => {
    if (!nuevoValor.trim()) return;
    if (opciones.tipo === 'radio') {
      setOpciones((o) => ({ ...o, valores: [...o.valores, nuevoValor.trim()] }));
    } else {
      const precio = parseFloat(nuevoExtra) || 0;
      setOpciones((o) => ({ ...o, valores: [...o.valores, { nombre: nuevoValor.trim(), extra: precio }] }));
    }
    setNuevoValor(''); setNuevoExtra('');
  };

  const quitarValor = (idx) => {
    setOpciones((o) => ({ ...o, valores: o.valores.filter((_, i) => i !== idx) }));
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) {
      Alert.alert('Faltan datos', 'El nombre y el precio son obligatorios.');
      return;
    }
    if (opciones.activo && !opciones.titulo.trim()) {
      Alert.alert('Especificaciones', 'Escribe el título del grupo de opciones.');
      return;
    }
    if (opciones.activo && opciones.valores.length < 2) {
      Alert.alert('Especificaciones', 'Agrega al menos 2 opciones.');
      return;
    }
    setGuardando(true);
    try {
      const opcionesPayload = opciones.activo
        ? { tipo: opciones.tipo, titulo: opciones.titulo.trim(), requerida: opciones.requerida, valores: opciones.valores }
        : null;

      const payload = {
        nombre:      form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio:      parseFloat(form.precio),
        categoria:   form.categoria,
        opciones:    opcionesPayload,
      };

      if (modal === 'nuevo') {
        await negocioOnboardingAPI.crearProducto(payload);
      } else {
        await negocioOnboardingAPI.actualizarProducto(form.id, payload);
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

  const eliminar = (prod) => {
    Alert.alert(
      'Eliminar producto',
      `¿Eliminar "${prod.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await negocioOnboardingAPI.eliminarProducto(prod.id);
              setProductos((ps) => ps.filter((p) => p.id !== prod.id));
            } catch (e) {
              Alert.alert('Error', e?.mensajeAmigable || 'No se pudo eliminar el producto.');
            }
          },
        },
      ]
    );
  };

  const cacheBust = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : url;

  const procesarSubidaFoto = async (prod, asset) => {
    try {
      const { data } = await negocioOnboardingAPI.subirFotoProducto(prod.id, asset.base64, asset.mimeType || 'image/jpeg');
      const newUrl = data.data?.url || data.data?.producto?.imagen || data.data?.foto_url;
      if (newUrl) {
        // Actualización inmediata con cache-bust — no espera recarga de API
        setProductos(ps => ps.map(p =>
          p.id === prod.id ? { ...p, foto_url: cacheBust(newUrl) } : p
        ));
      } else {
        await cargar();
      }
      Alert.alert('✅ ¡Listo!', 'Foto actualizada.');
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir la foto.');
    }
  };

  const subirFotoDesdeGaleria = async (prod) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, quality: 0.85, base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    await procesarSubidaFoto(prod, result.assets[0]);
  };

  const subirFotoDesdeCamara = async (prod) => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, quality: 0.85, base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    await procesarSubidaFoto(prod, result.assets[0]);
  };

  const subirFoto = (prod) => {
    Alert.alert('Seleccionar imagen', '¿De dónde quieres subir la foto?', [
      { text: '📷 Tomar foto',        onPress: () => subirFotoDesdeCamara(prod) },
      { text: '🖼️ Elegir de galería',  onPress: () => subirFotoDesdeGaleria(prod) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
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
            {(item.foto_url || item.imagen) ? (
              <Image source={{ uri: item.foto_url || item.imagen }} style={estilos.foto} />
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
                <Pressable style={estilos.btnFoto} onPress={() => subirFoto(item)}>
                  <Text style={estilos.btnFotoTxt}>
                    {(item.foto_url || item.imagen) ? '🔄 Foto' : '📷 Foto'}
                  </Text>
                </Pressable>
                <Pressable style={estilos.btnEliminar} onPress={() => eliminar(item)}>
                  <Text style={estilos.btnEliminarTxt}>🗑️</Text>
                </Pressable>
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
      <Modal visible={!!modal} animationType="slide" transparent statusBarTranslucent>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContenido}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              automaticallyAdjustKeyboardInsets={true}
            >
              <Text style={estilos.modalTitulo}>
                {modal === 'nuevo' ? '➕ Nuevo producto' : '✏️ Editar producto'}
              </Text>

              <Campo
                etiqueta="Nombre *"
                value={form.nombre}
                onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Ej. Tacos de camarón"
              />
              <Campo
                etiqueta="Descripción"
                value={form.descripcion}
                onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                placeholder="Ingredientes, porciones, etc."
                multiline
              />
              <Campo
                etiqueta="Precio *"
                value={form.precio}
                onChangeText={(v) => setForm((f) => ({ ...f, precio: v }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              {/* Selector de categoría con chips */}
              <Text style={estilos.categoriaLabel}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {CATEGORIAS.map((cat) => {
                  const activa = form.categoria === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setForm((f) => ({ ...f, categoria: cat }))}
                      style={[estilos.categoriaChip, activa && estilos.categoriaChipActivo]}
                    >
                      <Text style={[estilos.categoriaChipTxt, activa && estilos.categoriaChipTxtActivo]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ── Especificaciones del producto ── */}
              <View style={estilos.espSeparador} />
              <View style={estilos.espEncab}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.espTitulo}>Opciones / especificaciones</Text>
                  <Text style={estilos.espSub}>Sabores, extras, tamaños…</Text>
                </View>
                <Switch
                  value={opciones.activo}
                  onValueChange={(v) => setOpciones((o) => ({ ...o, activo: v }))}
                  trackColor={{ false: '#CCC', true: colors.primario }}
                  thumbColor="#FFF"
                />
              </View>

              {/* Specs body — siempre montado, ocultado con CSS para evitar bug de
                  touch responder en Android New Architecture al condicional mount */}
              <View
                style={[estilos.espCuerpo, !opciones.activo && { height: 0, overflow: 'hidden', marginTop: 0 }]}
                pointerEvents={opciones.activo ? 'auto' : 'none'}
              >
                  <Campo
                    etiqueta="Título del grupo *"
                    value={opciones.titulo}
                    onChangeText={(v) => setOpciones((o) => ({ ...o, titulo: v }))}
                    placeholder="Ej. Elige tu sabor"
                  />

                  {/* Tipo de opción */}
                  <Text style={estilos.espLabel}>Tipo de selección</Text>
                  <View style={estilos.espTipos}>
                    {[
                      { id: 'radio',  label: 'Una opción (ej. sabor)' },
                      { id: 'extras', label: 'Extras / ingredientes' },
                    ].map((t) => (
                      <Pressable
                        key={t.id}
                        style={[estilos.espTipoChip, opciones.tipo === t.id && estilos.espTipoChipActivo]}
                        onPress={() => setOpciones((o) => ({ ...o, tipo: t.id, valores: [] }))}
                      >
                        <Text style={[estilos.espTipoTxt, opciones.tipo === t.id && estilos.espTipoTxtActivo]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={[estilos.espRequeridaFila, opciones.tipo !== 'radio' && { display: 'none' }]}>
                    <Text style={estilos.espLabel}>Selección obligatoria</Text>
                    <Switch
                      value={opciones.requerida}
                      onValueChange={(v) => setOpciones((o) => ({ ...o, requerida: v }))}
                      trackColor={{ false: '#CCC', true: colors.primario }}
                      thumbColor="#FFF"
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>

                  {/* Lista de valores */}
                  {opciones.valores.length > 0 && (
                    <View style={{ marginBottom: espacio.sm }}>
                      {opciones.valores.map((v, i) => (
                        <View key={i} style={estilos.espValorFila}>
                          <Text style={estilos.espValorTxt} numberOfLines={1}>
                            {opciones.tipo === 'radio' ? v : `${v.nombre}${v.extra > 0 ? ` +$${v.extra}` : ''}`}
                          </Text>
                          <Pressable onPress={() => quitarValor(i)} style={estilos.espBtnQuitar}>
                            <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 16 }}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Agregar valor */}
                  <View style={estilos.espAgregarFila}>
                    <TextInput
                      style={estilos.espInput}
                      value={nuevoValor}
                      onChangeText={setNuevoValor}
                      placeholder={opciones.tipo === 'radio' ? 'Ej. Jamaica' : 'Ej. Con queso'}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={agregarValor}
                    />
                    <View style={[{ width: 80 }, opciones.tipo !== 'extras' && { display: 'none' }]}>
                      <TextInput
                        style={[estilos.espInput, { width: 80 }]}
                        value={nuevoExtra}
                        onChangeText={setNuevoExtra}
                        placeholder="+$0"
                        keyboardType="numeric"
                        returnKeyType="done"
                        blurOnSubmit={false}
                        onSubmitEditing={agregarValor}
                      />
                    </View>
                    <Pressable style={estilos.espBtnAgregar} onPress={agregarValor}>
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>+</Text>
                    </Pressable>
                  </View>
              </View>

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
    backgroundColor: '#EEF2FF',
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
  btnEliminar: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FEF2F2', borderRadius: radio.full },
  btnEliminarTxt: { fontSize: 12 },

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

  // ── Especificaciones ──────────────────────────────────────
  espSeparador: { height: 1, backgroundColor: colors.borde, marginVertical: espacio.md },
  espEncab: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.sm },
  espTitulo: { fontSize: 14, fontWeight: '800', color: colors.texto },
  espSub:    { fontSize: 11, color: colors.textoSuave },
  espCuerpo: {
    backgroundColor: colors.fondo,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  espLabel: { fontSize: 11, fontWeight: '800', color: colors.textoSuave, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  espTipos: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.sm },
  espTipoChip: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radio.md, borderWidth: 1.5, borderColor: colors.borde,
    alignItems: 'center',
  },
  espTipoChipActivo: { borderColor: colors.primario, backgroundColor: '#EEF2FF' },
  espTipoTxt:        { fontSize: 12, fontWeight: '700', color: colors.textoSuave, textAlign: 'center' },
  espTipoTxtActivo:  { color: colors.primario },
  espRequeridaFila:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espacio.sm },
  espValorFila: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.superficie, borderRadius: radio.sm,
    paddingHorizontal: espacio.sm, paddingVertical: 8,
    marginBottom: 4, gap: espacio.sm,
  },
  espValorTxt:   { flex: 1, fontSize: 13, color: colors.texto },
  espBtnQuitar:  { padding: 4 },
  espAgregarFila: { flexDirection: 'row', gap: espacio.xs, alignItems: 'center' },
  espInput: {
    flex: 1,
    backgroundColor: colors.superficie,
    borderRadius: radio.sm,
    borderWidth: 1,
    borderColor: colors.borde,
    paddingHorizontal: espacio.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.texto,
  },
  espBtnAgregar: {
    width: 36, height: 36,
    backgroundColor: colors.primario,
    borderRadius: radio.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  categoriaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textoSuave,
    marginBottom: 7,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  categoriaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radio.full,
    backgroundColor: colors.fondo,
    borderWidth: 1.5,
    borderColor: colors.borde,
  },
  categoriaChipActivo: {
    backgroundColor: colors.primario,
    borderColor: colors.primario,
  },
  categoriaChipTxt: { fontSize: 13, fontWeight: '700', color: colors.textoSuave },
  categoriaChipTxtActivo: { color: '#FFF' },
});
