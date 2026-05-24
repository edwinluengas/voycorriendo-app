import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { negociosAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const CATEGORIAS = [
  { id: 'todos',                nombre: 'Todos',        emoji: '🏪' },
  { id: 'ahivoy store',         nombre: 'VoyCorriendo', emoji: '🛍️', esAhivoy: true },
  { id: 'restaurante',          nombre: 'Restaurantes', emoji: '🍽️' },
  { id: 'tienda_conveniencia',  nombre: 'Tiendita',     emoji: '🏪' },
  { id: 'farmacia',             nombre: 'Farmacia',     emoji: '💊' },
  { id: 'papeleria',            nombre: 'Papelería',    emoji: '✏️' },
  { id: 'panaderia',            nombre: 'Panadería',    emoji: '🥖' },
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
  const [negocios, setNegocios]     = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [categoria, setCategoria]   = useState('todos');
  const [refrescando, setRefrescar] = useState(false);

  // Si llegamos con un filtro (p.ej. desde la sugerencia "pide una bebida"),
  // lo aplicamos automáticamente. useFocusEffect dispara cada vez que el tab
  // recibe foco, lo que captura los params aunque el componente ya esté montado.
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.filtroCategoria) {
        setCategoria(route.params.filtroCategoria);
        // Limpiamos el param para que no se reaplique si el usuario cambia de filtro a mano
        navigation.setParams({ filtroCategoria: undefined });
      }
    }, [route?.params?.filtroCategoria])
  );

  const cargarNegocios = async () => {
    try {
      const { data } = await negociosAPI.listar();
      setNegocios(data.data?.negocios || []);
    } catch (_) {
      setNegocios([]);
    } finally {
      setCargando(false);
      setRefrescar(false);
    }
  };

  useEffect(() => { cargarNegocios(); }, []);

  const destacados   = negocios.filter((n) => n.destacado);
  const filtrados    = categoria === 'todos'
    ? negocios
    : negocios.filter((n) => n.categoria === categoria);
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
            <View style={estilos.saludo}>
              <Text style={estilos.hola}>¡Hola! 👋</Text>
              <Text style={estilos.pregunta}>¿Qué se te antoja hoy?</Text>
            </View>

            {/* Banner de Mi Tienda Ahívoy — con logo distintivo, no estrella */}
            {tiendaAhivoy && categoria === 'todos' && (
              <Pressable
                style={estilos.bannerAhivoy}
                onPress={() => navigation.navigate('Negocio', { id: tiendaAhivoy.id })}
              >
                <View style={estilos.bannerContenido}>
                  <View style={estilos.bannerLogo}>
                    <Text style={estilos.bannerLogoTxt}>VC</Text>
                    <Text style={estilos.bannerLogoBolsa}>🛍️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={estilos.bannerFila}>
                      <Text style={estilos.bannerTitulo}>Voy Corriendo</Text>
                      <View style={estilos.bannerBadge}>
                        <Text style={estilos.bannerBadgeTxt}>STORE CDMX</Text>
                      </View>
                    </View>
                    <Text style={estilos.bannerSubtitulo}>Productos de Ciudad de México a tu puerta 📦</Text>
                    <Text style={estilos.bannerCta}>Tocar para explorar →</Text>
                  </View>
                </View>
              </Pressable>
            )}

            {/* Categorías */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORIAS}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: espacio.md }}
              renderItem={({ item }) => (
                <Pressable
                  style={[estilos.cat, categoria === item.id && estilos.catActiva]}
                  onPress={() => setCategoria(item.id)}
                >
                  <Text style={estilos.catEmoji}>{item.emoji}</Text>
                  <Text style={[estilos.catTxt, categoria === item.id && estilos.catTxtActiva]}>{item.nombre}</Text>
                </Pressable>
              )}
            />

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
              {categoria === 'todos' ? 'Todos los negocios' : `Negocios — ${CATEGORIAS.find(c => c.id === categoria)?.nombre}`}
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
    ) : (
      <View style={[estilos.imagenPlaceholder, esAhivoy && estilos.imagenAhivoy]}>
        {esAhivoy ? (
          <View style={estilos.miniLogo}>
            <Text style={estilos.miniLogoA}>VC</Text>
          </View>
        ) : (
          <Text style={estilos.imagenEmoji}>
            {EMOJI_POR_CATEGORIA[negocio.categoria] || '🏪'}
          </Text>
        )}
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
        {negocio.tipo_entrega === 'paqueteria' ? 'Envío por paquetería' : 'Envío desde $25 MXN'}
      </Text>
    </View>
  </Pressable>
  );
};

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  saludo: { paddingHorizontal: espacio.lg, paddingTop: espacio.md },
  hola: { fontSize: 16, color: colors.textoSuave },
  pregunta: { fontSize: 24, fontWeight: '800', color: colors.texto, marginBottom: espacio.md },

  // Banner Ahívoy
  bannerAhivoy: {
    marginHorizontal: espacio.md,
    marginBottom: espacio.md,
    borderRadius: radio.md,
    backgroundColor: colors.primario,
    overflow: 'hidden',
  },
  bannerContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espacio.md,
    gap: espacio.md,
  },
  bannerEmoji: { fontSize: 48 },
  bannerTitulo: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  bannerSubtitulo: { color: '#FFF', fontSize: 13, opacity: 0.95, marginTop: 2 },
  bannerCta: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: espacio.xs, opacity: 0.9 },

  // Logo distintivo Ahívoy (círculo con letra "A" + bolsa)
  bannerLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    position: 'relative',
  },
  bannerLogoTxt: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primario,
    lineHeight: 26,
  },
  bannerLogoBolsa: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 22,
  },
  bannerFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
  },
  bannerBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radio.full,
  },
  bannerBadgeTxt: {
    color: '#6B4200',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Mini logo para tarjetas Ahívoy
  miniLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  miniLogoA: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primario,
    lineHeight: 22,
  },

  // Tabs de categoría
  cat: {
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderRadius: radio.full,
    backgroundColor: colors.superficie,
    marginRight: espacio.sm,
    borderWidth: 1,
    borderColor: colors.borde,
    alignItems: 'center',
    minWidth: 84,
  },
  catActiva: { backgroundColor: colors.primario, borderColor: colors.primario },
  catEmoji: { fontSize: 22 },
  catTxt: { fontSize: 13, color: colors.texto, marginTop: 2, fontWeight: '600' },
  catTxtActiva: { color: '#FFF' },

  // Sección
  seccion: {
    fontSize: 18, fontWeight: '700', color: colors.texto,
    paddingHorizontal: espacio.lg, paddingTop: espacio.lg, paddingBottom: espacio.sm,
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
    borderRadius: radio.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  imagenPlaceholder: {
    width: 90, height: 90,
    backgroundColor: '#FFE6D1',
    alignItems: 'center', justifyContent: 'center',
    resizeMode: 'cover',
  },
  imagenAhivoy: { backgroundColor: '#FFF3C4' },
  imagenEmoji: { fontSize: 40 },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.texto, marginBottom: 2, flexShrink: 1 },
  badgeDestacado: { fontSize: 14 },
  meta: { fontSize: 13, color: colors.textoSuave },
  envio: { fontSize: 13, color: colors.secundario, fontWeight: '600', marginTop: 2 },

  // Empty state
  vacio: { alignItems: 'center', padding: espacio.xl, marginTop: espacio.xl },
  vacioEmoji: { fontSize: 56 },
  vacioTxt: { fontSize: 16, color: colors.texto, marginTop: espacio.md, textAlign: 'center' },
  vacioSub: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },
});
