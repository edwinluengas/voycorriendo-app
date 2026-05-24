/**
 * FotosNegocioScreen
 * ------------------
 * El dueño del negocio sube y cambia:
 *   - Foto de portada (banner principal que ven los clientes en Home y en el menú)
 *   - Logo circular (mostrado en destacados y confirmaciones de pedido)
 *   - Foto de cada producto del menú
 *
 * Las fotos de portada/logo se suben a Supabase via POST /api/negocios/documento.
 * Las fotos de producto van a PUT /api/negocios/:negocioId/productos/:productoId.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, Alert, Image, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { negocioOnboardingAPI, negociosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const ASPECT_PORTADA = [16, 9];
const ASPECT_LOGO    = [1, 1];
const ASPECT_PRODUCT = [4, 3];

export default function FotosNegocioScreen({ navigation }) {
  const [negocio, setNegocio]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(null); // 'portada' | 'logo' | productoId
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '', categoria: '' });
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await negocioOnboardingAPI.miNegocio();
      setNegocio(data.data?.negocio || null);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Picker genérico ──────────────────────────────────────
  const elegirImagen = async (aspectRatio) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Activa el acceso a tu galería en Ajustes.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: aspectRatio,
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'No se pudo leer la imagen.'); return null; }
    return asset;
  };

  const tomarFoto = async (aspectRatio) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Activa el acceso a la cámara en Ajustes.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: aspectRatio,
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  };

  // ── Muestra opciones galería / cámara ────────────────────
  const elegirOTomarFoto = (aspect) =>
    new Promise((resolve) => {
      Alert.alert('Subir foto', '¿De dónde tomamos la foto?', [
        { text: 'Cámara',   onPress: async () => resolve(await tomarFoto(aspect)) },
        { text: 'Galería',  onPress: async () => resolve(await elegirImagen(aspect)) },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });

  // ── Subir portada ────────────────────────────────────────
  const subirPortada = async () => {
    const asset = await elegirOTomarFoto(ASPECT_PORTADA);
    if (!asset) return;
    setSubiendo('portada');
    try {
      const { data } = await negocioOnboardingAPI.subirDocumento('foto_portada', asset.base64, asset.mimeType || 'image/jpeg');
      const url = data.data?.url;
      if (url) setNegocio((n) => ({ ...n, foto_portada: url }));
      Alert.alert('¡Listo!', 'Foto de portada actualizada. Los clientes ya la verán.');
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir. Intenta de nuevo.');
    } finally {
      setSubiendo(null);
    }
  };

  // ── Subir logo ───────────────────────────────────────────
  const subirLogo = async () => {
    const asset = await elegirOTomarFoto(ASPECT_LOGO);
    if (!asset) return;
    setSubiendo('logo');
    try {
      const { data } = await negocioOnboardingAPI.subirDocumento('logo', asset.base64, asset.mimeType || 'image/jpeg');
      const url = data.data?.url;
      if (url) setNegocio((n) => ({ ...n, logo: url }));
      Alert.alert('¡Listo!', 'Logo actualizado.');
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir. Intenta de nuevo.');
    } finally {
      setSubiendo(null);
    }
  };

  // ── Agregar nuevo producto ───────────────────────────────
  const agregarProducto = async () => {
    if (!nuevoProducto.nombre.trim()) return Alert.alert('Falta', 'Pon el nombre del producto.');
    const precio = parseFloat(nuevoProducto.precio);
    if (!nuevoProducto.precio || isNaN(precio)) return Alert.alert('Falta', 'Pon un precio válido.');
    setGuardandoProducto(true);
    try {
      const { data } = await negociosAPI.crearProducto(negocio.id, {
        nombre: nuevoProducto.nombre.trim(),
        precio,
        categoria: nuevoProducto.categoria.trim() || 'General',
      });
      const productoNuevo = data.data?.producto || {
        id: String(Date.now()),
        nombre: nuevoProducto.nombre.trim(),
        precio,
        categoria: nuevoProducto.categoria.trim() || 'General',
        foto_url: null,
      };
      setNegocio((n) => ({ ...n, productos: [...(n.productos || []), productoNuevo] }));
      setNuevoProducto({ nombre: '', precio: '', categoria: '' });
      setMostrandoForm(false);
      Alert.alert('¡Listo!', 'Producto agregado. Ahora puedes subir su foto.');
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo agregar el producto.');
    } finally {
      setGuardandoProducto(false);
    }
  };

  // ── Subir foto de producto ───────────────────────────────
  const subirFotoProducto = async (producto) => {
    const asset = await elegirOTomarFoto(ASPECT_PRODUCT);
    if (!asset) return;
    setSubiendo(producto.id);
    try {
      const fotoUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      const { data } = await negociosAPI.actualizarProducto(negocio.id, producto.id, { foto_url: fotoUrl });
      const updatedFoto = data.data?.producto?.foto_url || fotoUrl;
      setNegocio((n) => ({
        ...n,
        productos: (n.productos || []).map((p) =>
          p.id === producto.id ? { ...p, foto_url: updatedFoto } : p,
        ),
      }));
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo actualizar la foto.');
    } finally {
      setSubiendo(null);
    }
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  if (!negocio) {
    return (
      <SafeAreaView style={estilos.centrado}>
        <Text style={{ fontSize: 40 }}>😕</Text>
        <Text style={estilos.errorTxt}>No encontramos tu negocio.</Text>
        <Pressable style={estilos.btnVolver} onPress={() => navigation.goBack()}>
          <Text style={estilos.btnVolverTxt}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const productos = negocio.productos || [];

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xl * 2 }}>

        {/* ── Portada ── */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>📸 Foto de portada</Text>
          <Text style={estilos.seccionDesc}>
            Esta imagen aparece en la lista de negocios y en la parte superior de tu menú.
            Usa una foto atractiva de tus platillos o de tu local.
          </Text>
          <View style={estilos.portadaContenedor}>
            {negocio.foto_portada ? (
              <Image source={{ uri: negocio.foto_portada }} style={estilos.portadaImg} resizeMode="cover" />
            ) : (
              <View style={[estilos.portadaImg, estilos.portadaVacia]}>
                <Text style={{ fontSize: 48 }}>🖼️</Text>
                <Text style={estilos.sinFotoTxt}>Sin portada</Text>
              </View>
            )}
            <Pressable
              style={estilos.btnCambiarPortada}
              onPress={subirPortada}
              disabled={subiendo === 'portada'}
            >
              {subiendo === 'portada'
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={estilos.btnCambiarTxt}>
                    {negocio.foto_portada ? '📷 Cambiar portada' : '📷 Subir portada'}
                  </Text>
              }
            </Pressable>
          </View>
        </View>

        {/* ── Logo ── */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>🏷️ Logo del negocio</Text>
          <Text style={estilos.seccionDesc}>
            Aparece en los pedidos confirmados y en las notificaciones. Formato cuadrado.
          </Text>
          <View style={estilos.logoFila}>
            {negocio.logo ? (
              <Image source={{ uri: negocio.logo }} style={estilos.logoImg} resizeMode="cover" />
            ) : (
              <View style={[estilos.logoImg, estilos.logoVacio]}>
                <Text style={{ fontSize: 32 }}>🏪</Text>
              </View>
            )}
            <Pressable
              style={estilos.btnCambiarLogo}
              onPress={subirLogo}
              disabled={subiendo === 'logo'}
            >
              {subiendo === 'logo'
                ? <ActivityIndicator color={colors.primario} size="small" />
                : <Text style={estilos.btnCambiarLogoTxt}>
                    {negocio.logo ? 'Cambiar logo' : 'Subir logo'}
                  </Text>
              }
            </Pressable>
          </View>
        </View>

        {/* ── Productos ── */}
        <View style={estilos.seccion}>
          <View style={estilos.seccionEncab}>
            <Text style={estilos.seccionTitulo}>🍽️ Fotos de productos</Text>
            <Pressable style={estilos.btnAgregarProducto} onPress={() => setMostrandoForm(true)}>
              <Text style={estilos.btnAgregarProductoTxt}>+ Agregar</Text>
            </Pressable>
          </View>
          <Text style={estilos.seccionDesc}>
            Agrega tus productos y súbeles una foto. Los clientes ordenan más cuando ven la imagen real.
          </Text>

          {productos.length === 0 ? (
            <View style={estilos.sinProductos}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>📭</Text>
              <Text style={estilos.sinProductosTxt}>
                Aún no tienes productos. Toca "+ Agregar" para crear el primero.
              </Text>
              <Pressable style={estilos.btnAgregarPrimero} onPress={() => setMostrandoForm(true)}>
                <Text style={estilos.btnAgregarPrimeroTxt}>+ Agregar mi primer producto</Text>
              </Pressable>
            </View>
          ) : (
            productos.map((producto) => (
              <ProductoFotoItem
                key={producto.id}
                producto={producto}
                subiendo={subiendo === producto.id}
                onSubir={() => subirFotoProducto(producto)}
              />
            ))
          )}
        </View>

        {/* Tip */}
        <View style={estilos.tip}>
          <Text style={estilos.tipEmoji}>💡</Text>
          <Text style={estilos.tipTxt}>
            Las fotos de alta calidad aumentan hasta un 40% las conversiones. Usa luz natural
            y fondo limpio. ¡La primera impresión vende!
          </Text>
        </View>
      </ScrollView>
      {/* ── Modal: agregar producto ── */}
      <Modal visible={mostrandoForm} transparent animationType="slide" onRequestClose={() => setMostrandoForm(false)}>
        <KeyboardAvoidingView style={estilos.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={{ flex: 1 }} onPress={() => setMostrandoForm(false)} />
          <View style={estilos.modalContenido}>
            <Text style={estilos.modalTitulo}>Agregar producto</Text>

            <Text style={estilos.modalLabel}>Nombre *</Text>
            <TextInput
              style={estilos.modalInput}
              placeholder="Ej. Tacos de canasta"
              placeholderTextColor={colors.textoSuave}
              value={nuevoProducto.nombre}
              onChangeText={(v) => setNuevoProducto((p) => ({ ...p, nombre: v }))}
            />

            <Text style={estilos.modalLabel}>Precio *</Text>
            <TextInput
              style={estilos.modalInput}
              placeholder="0.00"
              placeholderTextColor={colors.textoSuave}
              value={nuevoProducto.precio}
              onChangeText={(v) => setNuevoProducto((p) => ({ ...p, precio: v.replace(/[^0-9.]/g, '') }))}
              keyboardType="decimal-pad"
            />

            <Text style={estilos.modalLabel}>Categoría</Text>
            <TextInput
              style={estilos.modalInput}
              placeholder="Ej. Platillo principal, Bebida..."
              placeholderTextColor={colors.textoSuave}
              value={nuevoProducto.categoria}
              onChangeText={(v) => setNuevoProducto((p) => ({ ...p, categoria: v }))}
            />

            <View style={estilos.modalBotones}>
              <Pressable style={estilos.modalBtnCancelar} onPress={() => setMostrandoForm(false)} disabled={guardandoProducto}>
                <Text style={estilos.modalBtnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={estilos.modalBtnGuardar} onPress={agregarProducto} disabled={guardandoProducto}>
                {guardandoProducto
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={estilos.modalBtnGuardarTxt}>Agregar</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Tarjeta de producto con foto ──────────────────────────
function ProductoFotoItem({ producto, subiendo, onSubir }) {
  return (
    <View style={estilos.productoCard}>
      {producto.foto_url ? (
        <Image source={{ uri: producto.foto_url }} style={estilos.productoImg} resizeMode="cover" />
      ) : (
        <View style={[estilos.productoImg, estilos.productoImgVacio]}>
          <Text style={{ fontSize: 28 }}>📷</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: espacio.md }}>
        <Text style={estilos.productoNombre} numberOfLines={1}>{producto.nombre}</Text>
        <Text style={estilos.productoPrecio}>${parseFloat(producto.precio).toFixed(2)}</Text>
        {producto.categoria ? (
          <Text style={estilos.productoCategoria}>{producto.categoria}</Text>
        ) : null}
        <Pressable
          style={[estilos.btnProductoFoto, subiendo && estilos.btnProductoFotoDeshabilitado]}
          onPress={onSubir}
          disabled={subiendo}
        >
          {subiendo ? (
            <ActivityIndicator color={colors.primario} size="small" />
          ) : (
            <Text style={estilos.btnProductoFotoTxt}>
              {producto.foto_url ? '🔄 Cambiar foto' : '📷 Agregar foto'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, backgroundColor: colors.fondo, alignItems: 'center', justifyContent: 'center', padding: espacio.lg },
  errorTxt:   { fontSize: 16, color: colors.textoSuave, marginTop: espacio.md, textAlign: 'center' },
  btnVolver:  { marginTop: espacio.md, padding: espacio.md },
  btnVolverTxt: { color: colors.primario, fontWeight: '700' },

  seccion: {
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginTop: espacio.md,
    padding: espacio.md,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  seccionTitulo: { fontSize: 17, fontWeight: '800', color: colors.texto, marginBottom: 4 },
  seccionDesc:   { fontSize: 13, color: colors.textoSuave, lineHeight: 18, marginBottom: espacio.md },

  // Portada
  portadaContenedor: { gap: espacio.sm },
  portadaImg: {
    width: '100%',
    height: 180,
    borderRadius: radio.md,
    backgroundColor: '#FFE6D1',
  },
  portadaVacia: { alignItems: 'center', justifyContent: 'center' },
  sinFotoTxt:   { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  btnCambiarPortada: {
    backgroundColor: colors.primario,
    paddingVertical: 12,
    borderRadius: radio.md,
    alignItems: 'center',
  },
  btnCambiarTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Logo
  logoFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.lg },
  logoImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFE6D1',
    overflow: 'hidden',
  },
  logoVacio: { alignItems: 'center', justifyContent: 'center' },
  btnCambiarLogo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radio.md,
    borderWidth: 2,
    borderColor: colors.primario,
    alignItems: 'center',
  },
  btnCambiarLogoTxt: { color: colors.primario, fontWeight: '700', fontSize: 14 },

  // Encabezado sección con botón
  seccionEncab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  btnAgregarProducto: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: colors.primario, borderRadius: radio.full,
  },
  btnAgregarProductoTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Productos
  sinProductos:   { alignItems: 'center', paddingVertical: espacio.lg },
  sinProductosTxt: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.sm, textAlign: 'center', lineHeight: 18 },
  btnAgregarPrimero: {
    marginTop: espacio.md,
    paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: colors.primario, borderRadius: radio.md,
  },
  btnAgregarPrimeroTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Modal agregar producto
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContenido: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg,
    padding: espacio.lg,
    paddingBottom: espacio.xl,
  },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: colors.texto, marginBottom: espacio.md },
  modalLabel: { fontSize: 14, fontWeight: '600', color: colors.texto, marginBottom: espacio.xs },
  modalInput: {
    backgroundColor: colors.fondo,
    borderWidth: 1, borderColor: colors.borde,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
    fontSize: 16, color: colors.texto,
    marginBottom: espacio.md,
  },
  modalBotones: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.sm },
  modalBtnCancelar: {
    flex: 1, paddingVertical: 12, borderRadius: radio.md,
    borderWidth: 2, borderColor: colors.borde, alignItems: 'center',
  },
  modalBtnCancelarTxt: { color: colors.textoSuave, fontWeight: '700', fontSize: 15 },
  modalBtnGuardar: {
    flex: 2, paddingVertical: 12, borderRadius: radio.md,
    backgroundColor: colors.primario, alignItems: 'center',
  },
  modalBtnGuardarTxt: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  productoCard: {
    flexDirection: 'row',
    paddingVertical: espacio.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
    alignItems: 'center',
    marginBottom: espacio.xs,
  },
  productoImg: {
    width: 72,
    height: 72,
    borderRadius: radio.md,
    backgroundColor: '#F3F4F6',
  },
  productoImgVacio: { alignItems: 'center', justifyContent: 'center' },
  productoNombre:   { fontSize: 14, fontWeight: '700', color: colors.texto },
  productoPrecio:   { fontSize: 13, color: colors.primario, fontWeight: '700', marginTop: 2 },
  productoCategoria:{ fontSize: 11, color: colors.textoSuave, marginTop: 2 },
  btnProductoFoto:  {
    marginTop: espacio.sm,
    paddingVertical: 7,
    paddingHorizontal: espacio.sm,
    borderRadius: radio.sm,
    backgroundColor: '#FFF3E8',
    borderWidth: 1,
    borderColor: colors.primario,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  btnProductoFotoDeshabilitado: { opacity: 0.5 },
  btnProductoFotoTxt: { color: colors.primario, fontWeight: '700', fontSize: 12 },

  // Tip
  tip: {
    flexDirection: 'row',
    margin: espacio.md,
    padding: espacio.md,
    backgroundColor: '#FFF9E6',
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: '#FFE08A',
    gap: espacio.sm,
    alignItems: 'flex-start',
  },
  tipEmoji: { fontSize: 20 },
  tipTxt: { flex: 1, fontSize: 13, color: '#7A5200', lineHeight: 18 },
});
