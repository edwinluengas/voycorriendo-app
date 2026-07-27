import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { negociosAPI } from '../../api/client';
import Boton from '../../components/Boton';
import MapaUbicacion from '../../components/MapaUbicacion';
import { colors, espacio, radio } from '../../theme/colors';

// ─────────────────────────────────────────────────────────────
// Carrito simple (en memoria; se exporta para que las demás pantallas lo usen).
// En una siguiente iteración lo vamos a migrar a un Context con useReducer.
// Cada línea del carrito puede tener opcion_elegida (p.ej. sabor) y notas
// (p.ej. "sin cebolla"). Dos líneas con la misma opción+notas se suman.
// ─────────────────────────────────────────────────────────────
let CARRITO = { negocio: null, items: [] };

// Construye una llave única por producto + opción + notas
const llaveItem = (producto_id, opcion_elegida, notas) =>
  `${producto_id}|${opcion_elegida || ''}|${(notas || '').trim().toLowerCase()}`;

export const agregarAlCarrito = (negocio, producto, extras = {}) => {
  const { opcion_elegida = null, notas = null } = extras;
  // Si cambia el negocio, reinicia el carrito (no se mezclan pedidos)
  if (!CARRITO.negocio || CARRITO.negocio.id !== negocio.id) {
    CARRITO = { negocio, items: [] };
  }
  const key = llaveItem(producto.id, opcion_elegida, notas);
  const existe = CARRITO.items.find((it) => it._key === key);
  if (existe) {
    existe.cantidad += 1;
  } else {
    CARRITO.items.push({
      _key: key,
      producto_id: producto.id,
      nombre: producto.nombre,
      precio_unitario: parseFloat(producto.precio),
      cantidad: 1,
      categoria: producto.categoria || null,
      opcion_elegida,
      notas,
      requiere_id: !!producto.requiere_id,
    });
  }
};

export const quitarDelCarrito = (key) => {
  const idx = CARRITO.items.findIndex((it) => it._key === key);
  if (idx >= 0) {
    if (CARRITO.items[idx].cantidad > 1) CARRITO.items[idx].cantidad -= 1;
    else CARRITO.items.splice(idx, 1);
  }
};

export const getCarrito = () => CARRITO;
export const vaciarCarrito = () => { CARRITO = { negocio: null, items: [] }; };

// ¿Algún item del carrito requiere INE?
export const carritoRequiereINE = () =>
  CARRITO.items.some((it) => it.requiere_id);

// ─── Emojis por categoría de negocio (fallback para productos sin imagen) ─
const EMOJI_POR_CATEGORIA_NEGOCIO = {
  restaurante:          '🍽️',
  tienda_conveniencia:  '🛒',
  farmacia:             '💊',
  papeleria:            '✏️',
  panaderia:            '🥖',
  'ahivoy store':       '🛍️',
  distribuidora:        '📦',
  otro:                 '🏪',
};

// Formatea tiempo_entrega a texto amigable
const formatoTiempoEntrega = (n) => {
  if (!n) return '';
  if (n.tipo_entrega === 'paqueteria') {
    const diasMin = Math.round((n.tiempo_entrega_min || 4320) / 1440);
    const diasMax = Math.round((n.tiempo_entrega_max || 7200) / 1440);
    return `📦 ${diasMin}-${diasMax} días`;
  }
  return `🕒 ${n.tiempo_entrega_min || 20}-${n.tiempo_entrega_max || 40} min`;
};

// Convierte lista de productos a secciones agrupadas por categoría del producto
const agruparPorCategoria = (productos) => {
  const grupos = {};
  for (const p of productos) {
    const cat = p.categoria || 'Otros';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  }
  // Orden alfabético de categorías, pero "Destacados" primero si existe
  const destacados = productos.filter((p) => p.destacado);
  const secciones = Object.keys(grupos)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((cat) => ({ title: cat, data: grupos[cat] }));
  if (destacados.length > 0) {
    secciones.unshift({ title: '⭐ Destacados', data: destacados });
  }
  return secciones;
};

export default function NegocioScreen({ route, navigation }) {
  const { id } = route.params;
  const [negocio, setNegocio]           = useState(null);
  const [productos, setProductos]       = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [itemsCarrito, setItemsCarrito] = useState(0);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const sectionListRef = useRef(null);

  // Modal de opciones / notas
  const [modalProducto, setModalProducto] = useState(null);
  const [modalOpcion, setModalOpcion]     = useState(null);
  const [modalNotas, setModalNotas]       = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await negociosAPI.detalle(id);
        const neg = data.data?.negocio;
        const ts = Date.now();
        const bust = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${ts}` : url;
        if (neg) {
          neg.foto_portada = bust(neg.foto_portada);
          neg.logo = bust(neg.logo);
        }
        setNegocio(neg);
        setProductos((neg?.productos || []).map((p) => ({ ...p, imagen: bust(p.imagen) })));

        // Si el carrito actual pertenece a este negocio, mostrar su badge
        const c = getCarrito();
        if (c.negocio?.id === neg?.id) {
          setItemsCarrito(c.items.reduce((s, it) => s + it.cantidad, 0));
        }
      } catch (e) {
        Alert.alert('Error', e.mensajeAmigable || 'No se pudo cargar el negocio.');
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  const secciones = useMemo(() => agruparPorCategoria(productos), [productos]);

  // Salto a una sección del menú. Antes esto NO funcionaba: `scrollToLocation`
  // lanza si la sección destino todavía no está renderizada (SectionList es
  // virtualizada y no hay getItemLayout), el error se tragaba en el catch y el
  // tap simplemente no hacía nada. Ahora se reintenta cuando la lista avisa
  // que falló, hasta que la sección existe.
  const scrollPendiente = useRef(null);

  const scrollASeccion = (idx) => {
    if (idx == null || idx < 0) return;
    try {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: idx,
        itemIndex: 0,       // 0 = el encabezado de la sección
        animated: true,
        viewPosition: 0,
        viewOffset: 0,
      });
    } catch (_) {
      // Se reintenta desde onScrollToIndexFailed
    }
  };

  const irACategoria = (titulo, idx) => {
    setCategoriaActiva(titulo);
    scrollPendiente.current = { idx, intentos: 0 };
    scrollASeccion(idx);
  };

  const reintentarScroll = () => {
    const pendiente = scrollPendiente.current;
    if (!pendiente || pendiente.intentos >= 4) { scrollPendiente.current = null; return; }
    pendiente.intentos += 1;
    setTimeout(() => scrollASeccion(pendiente.idx), 250);
  };

  // Mientras el usuario hace scroll a mano, la pestaña activa sigue a la
  // sección visible (como UberEats). La referencia debe ser estable: React
  // Native lanza si cambia la identidad de onViewableItemsChanged.
  const alCambiarVisibles = useRef(({ viewableItems }) => {
    const visible = viewableItems.find((v) => v?.section?.title);
    if (visible) setCategoriaActiva(visible.section.title);
  }).current;
  const configVisibilidad = useRef({ itemVisiblePercentThreshold: 30, minimumViewTime: 80 }).current;

  // Abre el modal (o agrega directo si el producto no tiene opciones)
  const agregar = (p) => {
    // Un pedido es de un solo negocio — si hay items de otro, se bloquea
    // (el cliente debe terminar o vaciar su carrito a propósito, nunca se
    // vacía automáticamente ni se ofrece esa opción aquí).
    const c = getCarrito();
    if (c.negocio && c.negocio.id !== negocio.id && c.items.length > 0) {
      // El botón "Ver carrito" de esta pantalla solo aparece si el carrito
      // es del negocio que se está viendo — aquí es de OTRO negocio, así
      // que sin esta acción el cliente no tenía ninguna ruta visible para
      // llegar a CarritoScreen y usar "Vaciar carrito" a propósito.
      Alert.alert(
        'Ya tienes un pedido en curso',
        `Tienes productos de "${c.negocio.nombre}" en tu carrito. Termina o vacía ese carrito antes de pedir en "${negocio.nombre}".`,
        [
          { text: 'Entendido', style: 'cancel' },
          { text: 'Ir a mi carrito', onPress: () => navigation.navigate('Carrito') },
        ],
      );
      return;
    }
    abrirOOAgregar(p);
  };

  // Si el producto tiene opciones o es restringido, abrimos el modal.
  // De lo contrario, agregamos directo.
  const abrirOOAgregar = (p) => {
    const tieneOpciones = !!(p.opciones && Array.isArray(p.opciones.valores) && p.opciones.valores.length > 0);
    if (tieneOpciones || p.requiere_id) {
      setModalProducto(p);
      setModalOpcion(tieneOpciones ? (p.opciones.valores[0] || null) : null);
      setModalNotas('');
      return;
    }
    agregarAlCarrito(negocio, p);
    setItemsCarrito(getCarrito().items.reduce((s, it) => s + it.cantidad, 0));
  };

  const confirmarDesdeModal = () => {
    if (!modalProducto) return;
    const p = modalProducto;
    // Si tiene opción requerida, asegurarse de que haya una selección
    if (p.opciones?.requerida && !modalOpcion) {
      Alert.alert('Falta elegir una opción', `Por favor elige ${p.opciones.titulo || 'una opción'}.`);
      return;
    }
    agregarAlCarrito(negocio, p, { opcion_elegida: modalOpcion, notas: modalNotas.trim() || null });
    setItemsCarrito(getCarrito().items.reduce((s, it) => s + it.cantidad, 0));
    setModalProducto(null);
    setModalOpcion(null);
    setModalNotas('');
  };

  const cerrarModal = () => {
    setModalProducto(null);
    setModalOpcion(null);
    setModalNotas('');
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
      <SafeAreaView style={estilos.vacio}>
        <Text style={{ fontSize: 48 }}>😕</Text>
        <Text style={estilos.vacioTxt}>No pudimos cargar este negocio.</Text>
        <Boton titulo="Volver" variante="secundario" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const emojiNegocio = EMOJI_POR_CATEGORIA_NEGOCIO[negocio.categoria] || '🏪';
  const envioTxt = negocio.tipo_entrega === 'paqueteria' ? 'Envío por paquetería' : 'Envío desde $35 MXN';

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      {/* ── Barra de secciones — SIEMPRE visible (antes vivía dentro del
          encabezado de la lista y desaparecía al hacer scroll, así que solo
          se podía saltar de sección estando hasta arriba) ── */}
      {secciones.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.categoriasBar}
          contentContainerStyle={estilos.categoriasBarContent}
          keyboardShouldPersistTaps="always"
        >
          {secciones.map((sec, idx) => {
            const activa = categoriaActiva === sec.title || (!categoriaActiva && idx === 0);
            return (
              <Pressable
                key={sec.title}
                style={[estilos.categoriaTab, activa && estilos.categoriaTabActiva]}
                onPress={() => irACategoria(sec.title, idx)}
              >
                <Text style={[estilos.categoriaTabTxt, activa && estilos.categoriaTabTxtActiva]}>
                  {sec.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <SectionList
        ref={sectionListRef}
        sections={secciones}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled
        onScrollToIndexFailed={reintentarScroll}
        onViewableItemsChanged={alCambiarVisibles}
        viewabilityConfig={configVisibilidad}
        ListHeaderComponent={
          <View style={estilos.header}>
            {negocio.foto_portada ? (
              <Image source={{ uri: negocio.foto_portada }} style={estilos.portadaImagen} />
            ) : negocio.categoria === 'ahivoy store' ? (
              <View style={[estilos.portada, estilos.portadaAhivoy]}>
                <View style={estilos.portadaDecor1} />
                <View style={estilos.portadaDecor2} />
                <View style={estilos.portadaStoreIcono}>
                  <Text style={estilos.portadaStoreEmoji}>🛒</Text>
                </View>
                <View style={estilos.portadaStoreBadgeRow}>
                  <View style={estilos.portadaStoreBadge}>
                    <Text style={estilos.portadaStoreBadgeTxt}>TIENDA EN LÍNEA</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={estilos.portada}>
                <Text style={estilos.portadaEmoji}>{emojiNegocio}</Text>
              </View>
            )}
            <View style={{ padding: espacio.lg }}>
              <Text style={estilos.nombre}>{negocio.nombre}</Text>
              <Text style={estilos.meta}>
                ⭐ {parseFloat(negocio.calificacion_promedio || 4.5).toFixed(1)}   ·   {formatoTiempoEntrega(negocio)}
              </Text>
              <Text style={estilos.envio}>🛵 {envioTxt}</Text>
              {!!negocio.descripcion && <Text style={estilos.descripcion}>{negocio.descripcion}</Text>}
              {!!(negocio.direccion || negocio.colonia) && (
                <Text style={estilos.direccion}>
                  📍 {[negocio.direccion, negocio.colonia].filter(Boolean).join(', ')}
                </Text>
              )}
              <MapaUbicacion
                lat={negocio.latitud ? parseFloat(negocio.latitud) : null}
                lng={negocio.longitud ? parseFloat(negocio.longitud) : null}
                titulo={negocio.nombre}
              />
            </View>

          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          // Suma todas las unidades del producto (aunque tengan diferentes sabores/notas)
          const totalEnCarrito = getCarrito().items
            .filter((it) => it.producto_id === item.id)
            .reduce((s, it) => s + it.cantidad, 0);
          const tieneOpciones = !!(item.opciones && Array.isArray(item.opciones.valores) && item.opciones.valores.length > 0);
          return (
            <Pressable style={estilos.producto} onPress={() => agregar(item)}>
              {!!(item.imagen || item.foto_url) && (
                <Image source={{ uri: item.imagen || item.foto_url }} style={estilos.productoFoto} />
              )}
              <View style={{ flex: 1 }}>
                <View style={estilos.pnombreFila}>
                  <Text style={estilos.pnombre}>{item.nombre}</Text>
                  {item.requiere_id && <Text style={estilos.badgeEdad}>🔞 +18</Text>}
                </View>
                {!!item.descripcion && (
                  <Text style={estilos.pdesc} numberOfLines={2}>{item.descripcion}</Text>
                )}
                {tieneOpciones && (
                  <Text style={estilos.pOpcionesHint}>
                    👉 {item.opciones.titulo || 'Elige una opción'}
                  </Text>
                )}
                <Text style={estilos.pprecio}>${parseFloat(item.precio).toFixed(2)}</Text>
              </View>
              <View style={[estilos.agregarBtn, totalEnCarrito > 0 && estilos.agregarBtnConteo]}>
                <Text style={estilos.agregarTxt}>{totalEnCarrito > 0 ? `${totalEnCarrito} +` : '+'}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={estilos.vacioProductos}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={estilos.vacioTxt}>Este negocio todavía no tiene productos.</Text>
          </View>
        }
      />

      {itemsCarrito > 0 && (
        <View style={estilos.ctaCarrito}>
          <Boton
            titulo={`Ver carrito (${itemsCarrito}) →`}
            onPress={() => navigation.navigate('Carrito')}
          />
        </View>
      )}

      {/* ─── Modal de opciones + notas ─────────────────────────── */}
      <Modal
        visible={!!modalProducto}
        transparent
        animationType="slide"
        onRequestClose={cerrarModal}
      >
        <Pressable style={estilos.modalBackdrop} onPress={cerrarModal}>
          <Pressable style={estilos.modalContenido} onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <ScrollView
                keyboardShouldPersistTaps="always"
                automaticallyAdjustKeyboardInsets={true}
                showsVerticalScrollIndicator={false}
              >
                {/* Handle visual */}
                <View style={estilos.modalHandle} />

                {modalProducto && (
                  <>
                    <Text style={estilos.modalTitulo}>{modalProducto.nombre}</Text>
                    <Text style={estilos.modalPrecio}>
                      ${parseFloat(modalProducto.precio).toFixed(2)}
                    </Text>
                    {!!modalProducto.descripcion && (
                      <Text style={estilos.modalDescripcion}>{modalProducto.descripcion}</Text>
                    )}

                    {/* Advertencia edad */}
                    {modalProducto.requiere_id && (
                      <View style={estilos.modalAviso}>
                        <Text style={estilos.modalAvisoEmoji}>🔞</Text>
                        <Text style={estilos.modalAvisoTxt}>
                          Producto con restricción de edad. Te pediremos una foto de tu INE al pagar.
                        </Text>
                      </View>
                    )}

                    {/* Opciones (radio buttons) */}
                    {modalProducto.opciones?.valores?.length > 0 && (
                      <>
                        <Text style={estilos.modalSeccion}>
                          {modalProducto.opciones.titulo || 'Elige una opción'}
                          {modalProducto.opciones.requerida && <Text style={estilos.requerida}>  *</Text>}
                        </Text>
                        {modalProducto.opciones.valores.map((op) => {
                          const seleccionada = modalOpcion === op;
                          return (
                            <Pressable
                              key={op}
                              style={[estilos.opcion, seleccionada && estilos.opcionSeleccionada]}
                              onPress={() => setModalOpcion(op)}
                            >
                              <View style={[estilos.radio, seleccionada && estilos.radioSeleccionado]}>
                                {seleccionada && <View style={estilos.radioPunto} />}
                              </View>
                              <Text style={[estilos.opcionTxt, seleccionada && estilos.opcionTxtSel]}>
                                {op}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </>
                    )}

                    {/* Notas */}
                    <Text style={estilos.modalSeccion}>
                      Notas para el negocio{' '}
                      <Text style={estilos.opcional}>(opcional)</Text>
                    </Text>
                    <TextInput
                      style={estilos.notasInput}
                      placeholder="Ej: sin cebolla, bien cocido, salsa aparte…"
                      placeholderTextColor={colors.textoSuave}
                      value={modalNotas}
                      onChangeText={setModalNotas}
                      multiline
                      maxLength={200}
                    />
                    <Text style={estilos.notasContador}>{modalNotas.length}/200</Text>

                    <View style={{ height: espacio.md }} />

                    <Boton
                      titulo={`Agregar al carrito — $${parseFloat(modalProducto.precio).toFixed(2)}`}
                      onPress={confirmarDesdeModal}
                    />
                    <View style={{ height: espacio.sm }} />
                    <Boton titulo="Cancelar" variante="secundario" onPress={cerrarModal} />
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  // Header (portada + info)
  header: { backgroundColor: colors.superficie, marginBottom: espacio.sm },
  portada: {
    height: 160,
    backgroundColor: colors.oscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portadaImagen: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  portadaAhivoy: {
    backgroundColor: colors.oscuro,
    height: 180,
    overflow: 'hidden',
  },
  portadaDecor1: {
    position: 'absolute', top: -30, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.primario, opacity: 0.3,
  },
  portadaDecor2: {
    position: 'absolute', bottom: -20, left: 40,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.acento, opacity: 0.15,
  },
  portadaStoreIcono: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primario, shadowOpacity: 0.7,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  portadaStoreEmoji: { fontSize: 40 },
  portadaStoreBadgeRow: {
    alignItems: 'center', marginTop: espacio.sm,
  },
  portadaStoreBadge: {
    backgroundColor: colors.acento,
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: radio.full,
  },
  portadaStoreBadgeTxt: {
    color: '#1A1A00', fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
  },
  portadaEmoji: { fontSize: 72 },
  productoFoto: {
    width: 72,
    height: 72,
    borderRadius: radio.sm,
    marginRight: espacio.sm,
    resizeMode: 'cover',
    backgroundColor: '#FFE6D1',
  },
  nombre: { fontSize: 24, fontWeight: '900', color: colors.texto, letterSpacing: -0.3 },
  meta: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  envio: { fontSize: 13, color: colors.secundario, fontWeight: '700', marginTop: 2 },
  descripcion: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.sm, lineHeight: 20 },
  direccion:   { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },

  // Tabs de secciones — barra fija arriba de la lista
  categoriasBar: {
    flexGrow: 0,
    backgroundColor: colors.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  categoriasBarContent: {
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    gap: espacio.xs,
  },
  categoriaTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radio.full,
    backgroundColor: colors.fondo,
    borderWidth: 1.5,
    borderColor: colors.borde,
  },
  categoriaTabActiva: {
    backgroundColor: colors.primario,
    borderColor: colors.primario,
  },
  categoriaTabTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textoSuave,
    textTransform: 'capitalize',
  },
  categoriaTabTxtActiva: { color: '#FFF' },

  // Sección
  seccionHeader: {
    backgroundColor: colors.fondo,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.md,
    paddingBottom: espacio.xs,
  },
  seccionTitulo: { fontSize: 16, fontWeight: '800', color: colors.texto, textTransform: 'capitalize' },

  // Producto
  producto: {
    flexDirection: 'row',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.md,
    alignItems: 'center',
  },
  pnombreFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, flexWrap: 'wrap' },
  pnombre: { fontSize: 15, fontWeight: '700', color: colors.texto, flexShrink: 1 },
  badgeEdad: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9B1C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radio.sm,
    overflow: 'hidden',
  },
  pdesc: { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  pOpcionesHint: {
    fontSize: 12,
    color: colors.secundario,
    marginTop: 4,
    fontWeight: '600',
  },
  pprecio: { fontSize: 15, fontWeight: '700', color: colors.primario, marginTop: espacio.xs },
  agregarBtn: {
    minWidth: 44, height: 40, borderRadius: 20,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: espacio.md,
    paddingHorizontal: espacio.sm,
  },
  agregarBtnConteo: { backgroundColor: colors.secundario },
  agregarTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Empty state productos
  vacioProductos: { alignItems: 'center', padding: espacio.xl, marginTop: espacio.lg },

  // CTA carrito
  ctaCarrito: { padding: espacio.md, backgroundColor: colors.superficie, borderTopWidth: 1, borderTopColor: colors.borde },

  // Vacío total
  vacio: { flex: 1, backgroundColor: colors.fondo, alignItems: 'center', justifyContent: 'center', gap: espacio.md, padding: espacio.lg },
  vacioTxt: { fontSize: 16, color: colors.texto, textAlign: 'center' },

  // ─── Modal de opciones ───────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.sm,
    paddingBottom: espacio.xl,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borde,
    alignSelf: 'center',
    marginBottom: espacio.md,
  },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: colors.texto },
  modalPrecio: { fontSize: 18, fontWeight: '800', color: colors.primario, marginTop: 4 },
  modalDescripcion: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, lineHeight: 20 },

  modalAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: radio.md,
    padding: espacio.md,
    marginTop: espacio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalAvisoEmoji: { fontSize: 24 },
  modalAvisoTxt: { flex: 1, fontSize: 13, color: '#7F1D1D', fontWeight: '600', lineHeight: 18 },

  modalSeccion: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.texto,
    marginTop: espacio.lg,
    marginBottom: espacio.sm,
  },
  requerida: { color: '#DC2626', fontWeight: '900' },
  opcional: { color: colors.textoSuave, fontWeight: '400', fontSize: 13 },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.md,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: colors.borde,
    marginBottom: espacio.xs,
    backgroundColor: colors.fondo,
    gap: espacio.sm,
  },
  opcionSeleccionada: {
    borderColor: colors.primario,
    backgroundColor: '#FFF3E6',
    borderWidth: 2,
  },
  opcionTxt: { fontSize: 15, color: colors.texto, fontWeight: '500' },
  opcionTxtSel: { fontWeight: '800', color: colors.primario },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSeleccionado: { borderColor: colors.primario },
  radioPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primario,
  },

  notasInput: {
    borderWidth: 1,
    borderColor: colors.borde,
    borderRadius: radio.md,
    padding: espacio.md,
    fontSize: 14,
    color: colors.texto,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: colors.fondo,
  },
  notasContador: {
    fontSize: 11,
    color: colors.textoSuave,
    textAlign: 'right',
    marginTop: 4,
  },
});
