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
  ActivityIndicator, Alert, Image, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { negocioOnboardingAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const cacheBust = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : url;

export default function FotosNegocioScreen({ navigation }) {
  const [negocio, setNegocio]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [subiendo, setSubiendo]   = useState(null);
  const [preview, setPreview]     = useState(null); // { asset, onConfirm }

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

  // ── Picker: galería sin recorte (imagen completa) ────────
  const elegirImagen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'No se pudo leer la imagen.'); return null; }
    return asset;
  };

  const tomarFoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  };

  // ── Muestra opciones galería / cámara → preview modal ───
  const elegirOTomarFoto = (onConfirm) => {
    Alert.alert('Subir foto', '¿De dónde tomamos la foto?', [
      {
        text: 'Cámara',
        onPress: async () => {
          const asset = await tomarFoto();
          if (asset) setPreview({ asset, onConfirm });
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const asset = await elegirImagen();
          if (asset) setPreview({ asset, onConfirm });
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Subir portada ────────────────────────────────────────
  const subirPortada = () => {
    elegirOTomarFoto(async (asset) => {
      setSubiendo('portada');
      try {
        const { data } = await negocioOnboardingAPI.subirDocumento('foto_portada', asset.base64, asset.mimeType || 'image/jpeg');
        const url = data.data?.url;
        if (url) setNegocio((n) => ({ ...n, foto_portada: cacheBust(url) }));
        Alert.alert('¡Listo!', 'Foto de portada actualizada. Los clientes ya la verán.');
      } catch (e) {
        Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir. Intenta de nuevo.');
      } finally {
        setSubiendo(null);
      }
    });
  };

  // ── Subir logo ───────────────────────────────────────────
  const subirLogo = () => {
    elegirOTomarFoto(async (asset) => {
      setSubiendo('logo');
      try {
        const { data } = await negocioOnboardingAPI.subirDocumento('logo', asset.base64, asset.mimeType || 'image/jpeg');
        const url = data.data?.url;
        if (url) setNegocio((n) => ({ ...n, logo: cacheBust(url) }));
        Alert.alert('¡Listo!', 'Logo actualizado.');
      } catch (e) {
        Alert.alert('Error', e?.mensajeAmigable || 'No se pudo subir. Intenta de nuevo.');
      } finally {
        setSubiendo(null);
      }
    });
  };

  // ── Subir foto de producto ───────────────────────────────
  const subirFotoProducto = (producto) => {
    elegirOTomarFoto(async (asset) => {
      setSubiendo(producto.id);
      try {
        const { data } = await negocioOnboardingAPI.subirFotoProducto(
          producto.id,
          asset.base64,
          asset.mimeType || 'image/jpeg',
        );
        const url = data.data?.url || data.data?.producto?.imagen;
        setNegocio((n) => ({
          ...n,
          productos: (n.productos || []).map((p) =>
            p.id === producto.id ? { ...p, imagen: url ? cacheBust(url) : p.imagen } : p,
          ),
        }));
        Alert.alert('¡Listo!', 'Foto del producto actualizada.');
      } catch (e) {
        Alert.alert('Error', e?.mensajeAmigable || 'No se pudo actualizar la foto.');
      } finally {
        setSubiendo(null);
      }
    });
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
      {/* ── Modal: vista previa de imagen completa ── */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={estilos.previewOverlay}>
          <Text style={estilos.previewTitulo}>Vista previa</Text>
          {preview?.asset?.uri && (
            <Image
              source={{ uri: preview.asset.uri }}
              style={estilos.previewImg}
              resizeMode="contain"
            />
          )}
          <Text style={estilos.previewHint}>¿Se ve bien tu foto? Confirma para subirla.</Text>
          <View style={estilos.previewBotones}>
            <Pressable style={estilos.previewBtnCancelar} onPress={() => setPreview(null)}>
              <Text style={estilos.previewBtnCancelarTxt}>Elegir otra</Text>
            </Pressable>
            <Pressable
              style={estilos.previewBtnConfirmar}
              onPress={() => {
                const { asset, onConfirm } = preview;
                setPreview(null);
                onConfirm(asset);
              }}
            >
              <Text style={estilos.previewBtnConfirmarTxt}>✅ Subir esta foto</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
          <Text style={estilos.seccionTitulo}>🍽️ Fotos de productos</Text>
          <Text style={estilos.seccionDesc}>
            Agrega fotos a cada platillo o producto. Los clientes ordenan más cuando ven la imagen real.
          </Text>

          {productos.length === 0 ? (
            <View style={estilos.sinProductos}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>📭</Text>
              <Text style={estilos.sinProductosTxt}>
                Aún no tienes productos. Ve a la sección "🍽️ Productos" en el dashboard
                para agregar tu menú y luego vuelve aquí a subir las fotos.
              </Text>
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
    </SafeAreaView>
  );
}

// ── Tarjeta de producto con foto ──────────────────────────
function ProductoFotoItem({ producto, subiendo, onSubir }) {
  const fotoUri = producto.imagen || producto.foto_url;
  return (
    <View style={estilos.productoCard}>
      {fotoUri ? (
        <Image source={{ uri: fotoUri }} style={estilos.productoImg} resizeMode="cover" />
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
              {fotoUri ? '🔄 Cambiar foto' : '📷 Agregar foto'}
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

  // Productos
  sinProductos:   { alignItems: 'center', paddingVertical: espacio.lg },
  sinProductosTxt: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.sm, textAlign: 'center', lineHeight: 18 },

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

  // Modal preview
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.lg,
  },
  previewTitulo: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: espacio.md },
  previewImg: {
    width: '100%',
    height: 340,
    borderRadius: radio.md,
    backgroundColor: '#111',
  },
  previewHint: { color: '#CCC', fontSize: 13, marginTop: espacio.md, textAlign: 'center' },
  previewBotones: { flexDirection: 'row', gap: espacio.md, marginTop: espacio.lg },
  previewBtnCancelar: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radio.md,
    borderWidth: 1.5,
    borderColor: '#555',
    alignItems: 'center',
  },
  previewBtnCancelarTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  previewBtnConfirmar: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radio.md,
    backgroundColor: colors.primario,
    alignItems: 'center',
  },
  previewBtnConfirmarTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },

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
