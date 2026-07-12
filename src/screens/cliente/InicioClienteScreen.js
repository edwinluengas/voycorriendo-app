import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { negociosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const CATEGORIAS = [
  { id: 'todos',                nombre: 'Para ti',        emoji: '⚡' },
  { id: 'ahivoy store',         nombre: 'VoyStore',       emoji: '🛍️', esAhivoy: true },
  { id: 'restaurante',          nombre: 'Restaurantes',   emoji: '🍽️' },
  { id: 'tienda_conveniencia',  nombre: 'Tiendita',       emoji: '🛒' },
  { id: 'farmacia',             nombre: 'Farmacia',       emoji: '💊' },
  { id: 'papeleria',            nombre: 'Papelería',      emoji: '✏️' },
  { id: 'panaderia',            nombre: 'Panadería',      emoji: '🥖' },
];

// Subcategorías de restaurante al estilo Uber Eats / Rappi
const SUBCATEGORIAS_RESTAURANTE = [
  { id: 'todas',       nombre: 'Todos',        emoji: '🍽️' },
  { id: 'tacos',       nombre: 'Tacos',        emoji: '🌮' },
  { id: 'pizza',       nombre: 'Pizza',        emoji: '🍕' },
  { id: 'hamburguesa', nombre: 'Hamburguesas', emoji: '🍔' },
  { id: 'sushi',       nombre: 'Sushi',        emoji: '🍱' },
  { id: 'mariscos',    nombre: 'Mariscos',     emoji: '🦐' },
  { id: 'pollo',       nombre: 'Pollo',        emoji: '🍗' },
  { id: 'desayuno',    nombre: 'Desayunos',    emoji: '🍳' },
  { id: 'postres',     nombre: 'Postres',      emoji: '🍰' },
  { id: 'vegano',      nombre: 'Vegano',       emoji: '🥗' },
];

// Categorías de la Tienda en Línea VoyCorriendo Store
const CATEGORIAS_STORE = [
  { id: 'todas',         nombre: 'Todo',          emoji: '🛍️' },
  { id: 'refaccionaria', nombre: 'Refaccionaria', emoji: '🔧' },
  { id: 'construccion',  nombre: 'Construcción',  emoji: '🏗️' },
  { id: 'moda',          nombre: 'Moda',          emoji: '👗' },
  { id: 'electronica',   nombre: 'Electrónica',   emoji: '📱' },
  { id: 'hogar',         nombre: 'Hogar',         emoji: '🏡' },
  { id: 'belleza',       nombre: 'Belleza',       emoji: '💄' },
  { id: 'herramientas',  nombre: 'Herramientas',  emoji: '🛠️' },
  { id: 'autos',         nombre: 'Autos',         emoji: '🚗' },
  { id: 'juguetes',      nombre: 'Juguetes',      emoji: '🎮' },
  { id: 'mascotas',      nombre: 'Mascotas',      emoji: '🐾' },
  { id: 'regalos',       nombre: 'Regalos',       emoji: '🎁' },
];

const EMOJI_POR_CATEGORIA = {
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
  if (n.tipo_entrega === 'paqueteria') {
    const diasMin = Math.round(n.tiempo_entrega_min / 1440);
    const diasMax = Math.round(n.tiempo_entrega_max / 1440);
    return `📦 ${diasMin}-${diasMax} días`;
  }
  return `🕒 ${n.tiempo_entrega_min}-${n.tiempo_entrega_max} min`;
};

export default function InicioClienteScreen({ navigation, route }) {
  const [negocios, setNegocios]             = useState([]);
  const [cargando, setCargando]             = useState(true);
  const [categoria, setCategoria]           = useState('todos');
  const [subcat, setSubcat]                 = useState('todas');
  const [refrescando, setRefrescar]         = useState(false);

  // Si llegamos con un filtro (p.ej. desde la sugerencia "pide una bebida"),
  // lo aplicamos automáticamente. useFocusEffect dispara cada vez que el tab
  // recibe foco, lo que captura los params aunque el componente ya esté montado.
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.filtroCategoria) {
        setCategoria(route.params.filtroCategoria);
        navigation.setParams({ filtroCategoria: undefined });
      }
    }, [route?.params?.filtroCategoria])
  );

  // Refresca negocios (con logos actualizados) cada vez que el usuario vuelve a esta pantalla
  useFocusEffect(
    useCallback(() => {
      cargarNegocios();
    }, [cargarNegocios])
  );

  const cargarNegocios = useCallback(async () => {
    try {
      const { data } = await negociosAPI.listar();
      const ts = Date.now();
      const bust = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${ts}` : url;
      const negs = (data.data?.negocios || []).map((n) => ({
        ...n,
        logo: bust(n.logo),
        foto_portada: bust(n.foto_portada),
      }));
      setNegocios(negs);
    } catch (_) {
      setNegocios([]);
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  }, []);

  useEffect(() => { cargarNegocios(); }, [cargarNegocios]);

  const destacados   = negocios.filter((n) => n.destacado);
  const porCategoria = categoria === 'todos'
    ? negocios
    : negocios.filter((n) => n.categoria === categoria);

  // Filtro de subcategorías para restaurantes y store (client-side)
  const filtrados = ((categoria === 'restaurante' || categoria === 'ahivoy store') && subcat !== 'todas')
    ? porCategoria.filter((n) => {
        const haystack = `${n.nombre} ${n.descripcion || ''} ${n.tags || ''} ${n.subcategoria || ''}`.toLowerCase();
        return haystack.includes(subcat);
      })
    : porCategoria;

  const tiendaAhivoy = negocios.find((n) => n.categoria === 'ahivoy store');

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={filtrados}
        keyExtractor={(it) => it.id}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescar(true); cargarNegocios(); }} />
        }
        ListHeaderComponent={
          <>
            {/* Header con gradiente oscuro */}
            <View style={estilos.headerOscuro}>
              <Text style={estilos.hola}>¡Hola! 👋</Text>
              <Text style={estilos.pregunta}>¿Qué se te antoja hoy?</Text>
            </View>

            {/* Banner Tienda VoyCorriendo — alto impacto */}
            {tiendaAhivoy && categoria === 'todos' && (
              <Pressable
                style={estilos.bannerAhivoy}
                onPress={() => { setCategoria('ahivoy store'); setSubcat('todas'); }}
              >
                {/* Decoración de fondo */}
                <View style={estilos.bannerDecor1} />
                <View style={estilos.bannerDecor2} />

                <View style={estilos.bannerContenido}>
                  {/* Icono del store */}
                  <View style={[estilos.bannerIconoCirculo, { backgroundColor: '#1C1C1E' }]}>
                    <Image
                      source={require('../../../assets/icon.png')}
                      style={{ width: 54, height: 54, borderRadius: 27 }}
                      resizeMode="cover"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={estilos.bannerFila}>
                      <Text style={estilos.bannerTitulo}>VoyStore</Text>
                      <View style={estilos.bannerBadge}>
                        <Text style={estilos.bannerBadgeTxt}>TIENDA</Text>
                      </View>
                    </View>
                    <Text style={estilos.bannerSubtitulo}>
                      Ropa · Electrónica · Herramientas · Hogar
                    </Text>
                    <View style={estilos.bannerCtaFila}>
                      <Text style={estilos.bannerCta}>Explorar tienda</Text>
                      <Text style={estilos.bannerCtaArrow}> →</Text>
                    </View>
                  </View>
                </View>

                {/* Chips de categorías preview */}
                <View style={estilos.bannerChips}>
                  {['🔧 Refaccionaria', '👗 Moda', '📱 Electrónica', '🏗️ Construcción'].map((c) => (
                    <View key={c} style={estilos.bannerChip}>
                      <Text style={estilos.bannerChipTxt}>{c}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            )}

            {/* Categorías principales */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORIAS}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: espacio.md, paddingVertical: espacio.sm }}
              renderItem={({ item }) => (
                <Pressable
                  style={[estilos.cat, categoria === item.id && estilos.catActiva]}
                  onPress={() => { setCategoria(item.id); setSubcat('todas'); }}
                >
                  <Text style={estilos.catEmoji}>{item.emoji}</Text>
                  <Text style={[estilos.catTxt, categoria === item.id && estilos.catTxtActiva]}>{item.nombre}</Text>
                </Pressable>
              )}
            />

            {/* Subcategorías — restaurante o store */}
            {(categoria === 'restaurante' || categoria === 'ahivoy store') && (
              <View style={estilos.subcatContenedor}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={categoria === 'ahivoy store' ? CATEGORIAS_STORE : SUBCATEGORIAS_RESTAURANTE}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ paddingHorizontal: espacio.md, gap: espacio.sm }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[estilos.subcat, subcat === item.id && estilos.subcatActiva]}
                      onPress={() => setSubcat(item.id)}
                    >
                      <Text style={estilos.subcatEmoji}>{item.emoji}</Text>
                      <Text style={[estilos.subcatTxt, subcat === item.id && estilos.subcatTxtActiva]}>
                        {item.nombre}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            )}

            {/* Carrusel de destacados (solo en "Todos") */}
            {destacados.length > 0 && categoria === 'todos' && (
              <>
                <Text style={estilos.seccion}>⭐ Destacados</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: espacio.md }}
                >
                  {destacados.map((n) => (
                    <Pressable
                      key={n.id}
                      style={estilos.destacado}
                      onPress={() => navigation.navigate('Negocio', { id: n.id })}
                    >
                      {n.foto_portada ? (
                        <Image source={{ uri: n.foto_portada }} style={estilos.destacadoImagen} />
                      ) : (
                        <View style={estilos.destacadoImagen}>
                          <Text style={estilos.destacadoEmoji}>
                            {EMOJI_POR_CATEGORIA[n.categoria] || '🏪'}
                          </Text>
                        </View>
                      )}
                      <Text style={estilos.destacadoNombre} numberOfLines={1}>{n.nombre}</Text>
                      <Text style={estilos.destacadoMeta}>⭐ {n.calificacion_promedio || '4.5'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={estilos.seccion}>
              {categoria === 'todos'
                ? 'Todos los negocios'
                : categoria === 'ahivoy store'
                  ? subcat === 'todas'
                    ? '🛍️ VoyStore Tienda'
                    : `🛍️ ${CATEGORIAS_STORE.find(c => c.id === subcat)?.emoji} ${CATEGORIAS_STORE.find(c => c.id === subcat)?.nombre}`
                  : `${CATEGORIAS.find(c => c.id === categoria)?.nombre}`}
            </Text>
          </>
        }
        renderItem={({ item }) => <TarjetaNegocio negocio={item} onPress={() => navigation.navigate('Negocio', { id: item.id })} />}
        ListEmptyComponent={
          cargando
            ? <ActivityIndicator size="large" color={colors.primario} style={{ marginTop: 60 }} />
            : (
              <View style={estilos.vacio}>
                <Text style={estilos.vacioEmoji}>📭</Text>
                <Text style={estilos.vacioTxt}>Todavía no hay negocios en esta categoría.</Text>
                <Text style={estilos.vacioSub}>Pronto sumamos más. ¡Gracias por tu paciencia!</Text>
              </View>
            )
        }
      />
    </SafeAreaView>
  );
}

const TarjetaNegocio = ({ negocio, onPress }) => {
  const esAhivoy = negocio.categoria === 'ahivoy store';
  return (
  <Pressable style={estilos.tarjeta} onPress={onPress}>
    {negocio.foto_portada ? (
      <Image source={{ uri: negocio.foto_portada }} style={estilos.imagenPlaceholder} />
    ) : esAhivoy ? (
      <View style={[estilos.imagenPlaceholder, estilos.imagenAhivoy]}>
        <Image
          source={negocio.logo ? { uri: negocio.logo } : require('../../../assets/icon.png')}
          style={estilos.miniLogoImg}
        />
      </View>
    ) : (
      <View style={estilos.imagenPlaceholder}>
        <Text style={estilos.imagenEmoji}>
          {EMOJI_POR_CATEGORIA[negocio.categoria] || '🏪'}
        </Text>
      </View>
    )}
    <View style={{ flex: 1, padding: espacio.md }}>
      <View style={estilos.filaNombre}>
        <Text style={estilos.nombre} numberOfLines={1}>{negocio.nombre}</Text>
        {negocio.destacado && <Text style={estilos.badgeDestacado}>⭐</Text>}
      </View>
      <Text style={estilos.meta}>
        ⭐ {negocio.calificacion_promedio || '4.5'} · {formatoTiempoEntrega(negocio)}
      </Text>
      <Text style={estilos.envio}>
        {negocio.tipo_entrega === 'paqueteria' ? 'Envío por paquetería' : 'Envío desde $35 MXN'}
      </Text>
    </View>
  </Pressable>
  );
};

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  // Header oscuro al estilo Uber Eats
  headerOscuro: {
    backgroundColor: colors.oscuro,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.md,
    paddingBottom: espacio.lg,
  },
  hola: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },
  pregunta: { fontSize: 26, fontWeight: '900', color: colors.textoInverso, marginTop: 2, letterSpacing: -0.3 },

  // Subcategorías restaurante
  subcatContenedor: {
    backgroundColor: colors.fondo,
    paddingVertical: espacio.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  subcat: {
    alignItems: 'center',
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderRadius: radio.md,
    backgroundColor: colors.superficie,
    borderWidth: 1,
    borderColor: colors.borde,
    minWidth: 80,
  },
  subcatActiva: {
    backgroundColor: colors.oscuro,
    borderColor: colors.oscuro,
  },
  subcatEmoji: { fontSize: 22 },
  subcatTxt: { fontSize: 11, color: colors.texto, marginTop: 3, fontWeight: '600', textAlign: 'center' },
  subcatTxtActiva: { color: '#FFF' },

  // Banner Store — alto impacto, fondo oscuro
  bannerAhivoy: {
    marginHorizontal: espacio.md,
    marginBottom: espacio.md,
    borderRadius: radio.xl,
    backgroundColor: colors.oscuro,
    overflow: 'hidden',
  },
  bannerDecor1: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.primario, opacity: 0.25,
  },
  bannerDecor2: {
    position: 'absolute', bottom: -20, left: 60,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.acento, opacity: 0.12,
  },
  bannerContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.md,
    gap: espacio.md,
  },
  bannerIconoCirculo: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primario, shadowOpacity: 0.6,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bannerIconoEmoji: { fontSize: 36 },
  bannerTitulo: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  bannerSubtitulo: { color: '#9E9E9E', fontSize: 12, marginTop: 3, lineHeight: 16 },
  bannerCtaFila: { flexDirection: 'row', alignItems: 'center', marginTop: espacio.sm },
  bannerCta: {
    color: colors.primario, fontSize: 13, fontWeight: '800',
  },
  bannerCtaArrow: { color: colors.primario, fontSize: 14, fontWeight: '900' },
  bannerFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  bannerBadge: {
    backgroundColor: colors.acento, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: radio.full,
  },
  bannerBadgeTxt: { color: '#1A1A00', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // Chips de categorías en el banner
  bannerChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs,
    paddingHorizontal: espacio.md, paddingBottom: espacio.md,
  },
  bannerChip: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radio.full,
    borderWidth: 1, borderColor: '#3A3A3C',
  },
  bannerChipTxt: { color: '#E0E0E0', fontSize: 11, fontWeight: '600' },

  // Mini logo VoyCorriendo en tarjetas (fallback)
  miniLogoImg: { width: 62, height: 62, borderRadius: 10 },

  // Tabs de categoría
  cat: {
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderRadius: radio.xl,
    backgroundColor: colors.superficie,
    marginRight: espacio.sm,
    borderWidth: 1.5,
    borderColor: colors.borde,
    alignItems: 'center',
    minWidth: 80,
  },
  catActiva: { backgroundColor: colors.primario, borderColor: colors.primario },
  catEmoji: { fontSize: 20 },
  catTxt: { fontSize: 11, color: colors.texto, marginTop: 3, fontWeight: '700' },
  catTxtActiva: { color: '#FFF' },

  // Sección
  seccion: {
    fontSize: 17, fontWeight: '800', color: colors.texto,
    paddingHorizontal: espacio.lg, paddingTop: espacio.lg, paddingBottom: espacio.sm,
    letterSpacing: -0.2,
  },

  // Destacados (carrusel)
  destacado: {
    width: 120,
    marginRight: espacio.sm,
    alignItems: 'center',
  },
  destacadoImagen: {
    width: 100, height: 100,
    borderRadius: radio.md,
    backgroundColor: '#FFE6D1',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: espacio.xs,
    resizeMode: 'cover',
    overflow: 'hidden',
  },
  destacadoEmoji: { fontSize: 44 },
  destacadoNombre: { fontSize: 13, fontWeight: '700', color: colors.texto, textAlign: 'center' },
  destacadoMeta: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },

  // Tarjeta de negocio
  tarjeta: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  imagenPlaceholder: {
    width: 96, height: 96,
    backgroundColor: '#FFE6D1',
    alignItems: 'center', justifyContent: 'center',
    resizeMode: 'cover',
  },
  imagenAhivoy: { backgroundColor: '#FFF3C4' },
  imagenEmoji: { fontSize: 40 },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nombre: { fontSize: 16, fontWeight: '800', color: colors.texto, marginBottom: 2, flexShrink: 1 },
  badgeDestacado: { fontSize: 14 },
  meta: { fontSize: 12, color: colors.textoSuave },
  envio: { fontSize: 12, color: colors.secundario, fontWeight: '700', marginTop: 3 },

  // Empty state
  vacio: { alignItems: 'center', padding: espacio.xl, marginTop: espacio.xl },
  vacioEmoji: { fontSize: 56 },
  vacioTxt: { fontSize: 16, color: colors.texto, marginTop: espacio.md, textAlign: 'center' },
  vacioSub: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },
});
