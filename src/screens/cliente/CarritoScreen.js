import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getCarrito, carritoRequiereINE, vaciarCarrito } from './NegocioScreen';
import { pedidosAPI } from '../../api/client';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FEE_ENVIO, PEDIDO_MINIMO, LIMITE_EFECTIVO, TIPOS_ENVIO } from '../../config/businessRules';

// Iconos vectoriales, no emoji. Los emoji se renderizan con el tipo de letra
// del sistema: cada uno trae su propio tamaño, peso y color, y una fila de
// tres queda visualmente desalineada. Se usa la misma familia que la barra de
// tabs (Ionicons) y solo se sale de ella la moto, que Ionicons no tiene.
function IconoEnvio({ tipo, activo }) {
  const color = activo ? colors.primario : colors.textoSuave;
  if (tipo === 'express') return <Ionicons name="flash" size={22} color={color} />;
  if (tipo === 'pickup')  return <Ionicons name={activo ? 'storefront' : 'storefront-outline'} size={22} color={color} />;
  return <MaterialCommunityIcons name="motorbike" size={23} color={color} />;
}

export default function CarritoScreen({ navigation }) {
  const carrito = getCarrito();
  const [items, setItems]         = useState(carrito.items);
  const [tipoEnvio, setTipoEnvio] = useState('standard');
  // Qué tipos de entrega se pueden ofrecer AHORA. Si no hay ningún repartidor
  // en línea con cupo, el backend responde solo 'pickup' + un mensaje que lo
  // presenta como beneficio (te ahorras el envío), nunca como una falla.
  const [tiposDisponibles, setTiposDisponibles] = useState(null);   // null = aún no se sabe
  const [avisoEnvio, setAvisoEnvio]             = useState(null);

  useFocusEffect(useCallback(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await pedidosAPI.disponibilidadEnvio(carrito.negocio?.id);
        if (!vivo) return;
        const tipos = data?.data?.tipos_disponibles || null;
        setTiposDisponibles(tipos);
        setAvisoEnvio(data?.data?.mensaje || null);
        // Si el tipo elegido ya no se ofrece, se mueve solo a pickup
        if (tipos && !tipos.includes(tipoEnvio)) setTipoEnvio(tipos[0] || 'pickup');
      } catch (_) {
        // Sin respuesta: se ofrecen todos y el candado real queda en el
        // backend al crear el pedido.
        if (vivo) setTiposDisponibles(null);
      }
    })();
    return () => { vivo = false; };
  }, [carrito.negocio?.id, tipoEnvio]));

  const opcionesEnvio = tiposDisponibles
    ? TIPOS_ENVIO.filter((t) => tiposDisponibles.includes(t.id))
    : TIPOS_ENVIO;

  const subtotal = items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0);
  const feeEnvio = tipoEnvio === 'pickup' ? 0 : FEE_ENVIO[tipoEnvio];
  const total    = subtotal + feeEnvio;
  const debajo   = subtotal < PEDIDO_MINIMO;
  const requiereINE = items.some((it) => it.requiere_id);
  const esRestaurante = carrito.negocio?.categoria === 'restaurante';

  const cambiarCantidad = (key, delta) => {
    const nuevos = items
      .map((it) => it._key === key ? { ...it, cantidad: it.cantidad + delta } : it)
      .filter((it) => it.cantidad > 0);
    setItems(nuevos);
    carrito.items = nuevos;
  };

  const confirmarVaciar = () => {
    Alert.alert(
      'Vaciar carrito',
      `¿Seguro que quieres quitar todos los productos de "${carrito.negocio?.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Vaciar', style: 'destructive', onPress: () => { vaciarCarrito(); setItems([]); } },
      ],
    );
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={estilos.vacio}>
        <Text style={estilos.vacioEmoji}>🛒</Text>
        <Text style={estilos.vacioTxt}>Tu carrito está vacío</Text>
        <Text style={estilos.vacioSub}>Agrega productos de un negocio para continuar</Text>
        <View style={{ marginTop: espacio.lg, width: '70%' }}>
          <Boton titulo="Ver negocios" variante="secundario" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(it) => it._key || it.producto_id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Nombre del negocio */}
            <View style={estilos.negocioHeader}>
              <View style={estilos.negocioAccent} />
              <Text style={estilos.negocioNombre} numberOfLines={1}>{carrito.negocio?.nombre}</Text>
              <Pressable onPress={confirmarVaciar} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <Text style={estilos.vaciarTxt}>Vaciar carrito</Text>
              </Pressable>
            </View>

            {requiereINE && (
              <View style={estilos.avisoINE}>
                <Text style={estilos.avisoINEEmoji}>🔞</Text>
                <Text style={estilos.avisoINETxt}>
                  Uno o más productos requieren verificación de edad. Ten tu INE a la mano al recibir.
                </Text>
              </View>
            )}

            <Text style={estilos.seccionTit}>Tus productos</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={[estilos.item, index === 0 && estilos.itemPrimero]}>
            <View style={{ flex: 1 }}>
              <View style={estilos.nombreFila}>
                <Text style={estilos.nombre} numberOfLines={2}>{item.nombre}</Text>
                {item.requiere_id && <View style={estilos.badgeEdad}><Text style={estilos.badgeEdadTxt}>+18</Text></View>}
              </View>
              {!!item.opcion_elegida && (
                <Text style={estilos.opcionTxt}>{item.opcion_elegida}</Text>
              )}
              {!!item.notas && (
                <Text style={estilos.notasTxt}>{item.notas}</Text>
              )}
              <Text style={estilos.precioUnit}>${item.precio_unitario.toFixed(2)} c/u</Text>
            </View>

            <View style={estilos.controles}>
              <Pressable
                style={estilos.btnMenos}
                onPress={() => cambiarCantidad(item._key, -1)}
              >
                <Text style={estilos.btnCtrlTxt}>−</Text>
              </Pressable>
              <Text style={estilos.cant}>{item.cantidad}</Text>
              <Pressable
                style={estilos.btnMas}
                onPress={() => cambiarCantidad(item._key, +1)}
              >
                <Text style={estilos.btnMasTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={estilos.separadorItem} />}
        ListFooterComponent={
          esRestaurante ? (
            <Pressable
              style={estilos.sugerencia}
              onPress={() =>
                navigation.navigate('Home', { screen: 'Inicio', params: { filtroCategoria: 'tienda_conveniencia' } })
              }
            >
              <Text style={estilos.sugerenciaEmoji}>🥤</Text>
              <View style={{ flex: 1 }}>
                <Text style={estilos.sugerenciaTitulo}>¿Le agregas una bebida?</Text>
                <Text style={estilos.sugerenciaSub}>
                  Refrescos, cervezas o aguas frescas de una tienda cercana →
                </Text>
              </View>
            </Pressable>
          ) : <View style={{ height: espacio.xl }} />
        }
      />

      {/* Panel de resumen inferior */}
      <View style={estilos.panel}>
        {/* Selector de tipo de envío */}
        <Text style={estilos.panelLabel}>Tipo de entrega</Text>
        {!!avisoEnvio && (
          <View style={estilos.avisoPickup}>
            <Text style={estilos.avisoPickupTxt}>{avisoEnvio}</Text>
          </View>
        )}

        {/* Una fila por opción — mismo patrón que el selector de método de
            pago de la pantalla siguiente, para que el checkout se lea como
            una sola pieza. Iconos vectoriales (no emoji): a 3 opciones los
            emoji se veían de tamaños distintos y el bloque quedaba sucio. */}
        <View style={estilos.tipoLista}>
          {opcionesEnvio.map((t) => {
            const activo = tipoEnvio === t.id;
            const gratis = t.precio === 0;
            return (
              <Pressable
                key={t.id}
                style={[estilos.tipoFila2, activo && estilos.tipoFilaActiva]}
                onPress={() => setTipoEnvio(t.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`${t.label}. ${t.sub}. ${gratis ? 'Sin costo' : `$${t.precio} pesos`}`}
              >
                <View style={[estilos.tipoIcono, activo && estilos.tipoIconoActivo]}>
                  <IconoEnvio tipo={t.id} activo={activo} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[estilos.tipoNombre, activo && estilos.tipoNombreActivo]}>{t.label}</Text>
                  <Text style={estilos.tipoDesc}>{t.sub}</Text>
                </View>

                <Text style={[estilos.tipoPrecio2, gratis && estilos.tipoPrecioGratis]}>
                  {gratis ? 'Gratis' : `$${t.precio}`}
                </Text>
                <View style={[estilos.radio, activo && estilos.radioActivo]} />
              </Pressable>
            );
          })}
        </View>

        {/* Desglose de costos */}
        <View style={estilos.costos}>
          <Linea label="Subtotal" valor={subtotal} />
          <Linea
            label={tipoEnvio === 'pickup'
              ? 'Recoges en tienda 🛍️'
              : `Envío ${tipoEnvio === 'express' ? 'Express ⚡' : 'Estándar'}`}
            valor={feeEnvio}
          />
          <View style={estilos.separadorTotal} />
          <Linea label="Total" valor={total} fuerte />
        </View>

        {/* Avisos */}
        {debajo && (
          <View style={estilos.aviso}>
            <View style={estilos.progresoBarra}>
              <View style={[estilos.progresoRelleno, { width: `${Math.min(100, (subtotal / PEDIDO_MINIMO) * 100)}%` }]} />
            </View>
            <Text style={estilos.avisoTxt}>
              ⚠️  Pedido mínimo ${PEDIDO_MINIMO} en productos. Te faltan ${(PEDIDO_MINIMO - subtotal).toFixed(2)} MXN.
            </Text>
          </View>
        )}
        {subtotal > LIMITE_EFECTIVO && (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTxt}>
              ⚠️  Subtotal mayor a ${LIMITE_EFECTIVO} MXN. El pago en efectivo no estará disponible.
            </Text>
          </View>
        )}

        <Boton
          titulo={debajo ? `Mínimo $${PEDIDO_MINIMO} MXN en productos` : 'Continuar al pago →'}
          deshabilitado={debajo}
          onPress={() => navigation.navigate('Pago', { total, tipo_envio: tipoEnvio })}
        />
      </View>
    </SafeAreaView>
  );
}

const Linea = ({ label, valor, fuerte }) => (
  <View style={estilos.linea}>
    <Text style={[estilos.lineaLabel, fuerte && estilos.lineaFuerte]}>{label}</Text>
    <Text style={[estilos.lineaValor, fuerte && estilos.lineaFuerteValor]}>${valor.toFixed(2)}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  vacio: {
    flex: 1, backgroundColor: colors.fondo,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: espacio.xl,
  },
  vacioEmoji: { fontSize: 64, marginBottom: espacio.md },
  vacioTxt: { fontSize: 22, fontWeight: '800', color: colors.texto, textAlign: 'center' },
  vacioSub: { fontSize: 14, color: colors.textoSuave, marginTop: espacio.xs, textAlign: 'center' },

  negocioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    paddingBottom: espacio.md,
    gap: espacio.sm,
  },
  negocioAccent: {
    width: 4, height: 22, borderRadius: 2,
    backgroundColor: colors.primario,
  },
  negocioNombre: { fontSize: 20, fontWeight: '800', color: colors.texto, flexShrink: 1 },
  vaciarTxt: { fontSize: 12, color: colors.error, fontWeight: '700' },

  avisoINE: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: espacio.lg,
    marginBottom: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  avisoINEEmoji: { fontSize: 22 },
  avisoINETxt: { flex: 1, fontSize: 13, color: '#7F1D1D', fontWeight: '600', lineHeight: 18 },

  seccionTit: {
    paddingHorizontal: espacio.lg,
    paddingBottom: espacio.xs,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textoSuave,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  item: {
    flexDirection: 'row',
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.md,
    backgroundColor: colors.superficie,
    alignItems: 'center',
  },
  itemPrimero: { borderTopLeftRadius: radio.md, borderTopRightRadius: radio.md },
  separadorItem: {
    height: 1,
    backgroundColor: colors.fondo,
    marginLeft: espacio.lg,
  },

  nombreFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs, flexWrap: 'wrap', marginBottom: 3 },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.texto, flex: 1 },
  badgeEdad: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeEdadTxt: { fontSize: 10, fontWeight: '800', color: '#9B1C1C' },
  opcionTxt: { fontSize: 12, color: colors.secundario, fontWeight: '600', marginBottom: 2 },
  notasTxt: { fontSize: 12, color: colors.textoSuave, fontStyle: 'italic', marginBottom: 2 },
  precioUnit: { fontSize: 13, color: colors.textoSuave, fontWeight: '500' },

  controles: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, marginLeft: espacio.md },
  btnMenos: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.fondo,
    borderWidth: 1.5, borderColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
  },
  btnMas: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primario,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  btnCtrlTxt: { fontSize: 20, color: colors.primario, fontWeight: '700', lineHeight: 22 },
  btnMasTxt: { fontSize: 20, color: '#FFF', fontWeight: '700', lineHeight: 22 },
  cant: { minWidth: 28, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.texto },

  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    marginHorizontal: espacio.lg,
    marginTop: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    gap: espacio.md,
    borderWidth: 1,
    borderColor: '#FFD6A5',
  },
  sugerenciaEmoji: { fontSize: 28 },
  sugerenciaTitulo: { fontSize: 14, fontWeight: '800', color: colors.texto },
  sugerenciaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2, lineHeight: 16 },

  // Panel inferior
  panel: {
    backgroundColor: colors.superficie,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    paddingBottom: espacio.md,
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  panelLabel: {
    fontSize: 11, fontWeight: '800', color: colors.textoSuave,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: espacio.sm,
  },
  // ── Selector de tipo de entrega ──
  // Una fila por opción (no tres tarjetas apretadas): con tres opciones el
  // texto se cortaba y el precio quedaba encimado. Mismo idioma visual que
  // el selector de método de pago de la pantalla siguiente.
  tipoLista: { marginBottom: espacio.md, gap: espacio.xs },
  tipoFila2: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    borderWidth: 1.5, borderColor: colors.borde,
    paddingVertical: espacio.sm + 2, paddingHorizontal: espacio.md,
  },
  tipoFilaActiva: { borderColor: colors.primario, backgroundColor: '#FFF7F2' },
  tipoIcono: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.fondo,
    alignItems: 'center', justifyContent: 'center',
  },
  tipoIconoActivo: { backgroundColor: '#FFE8D9' },
  tipoNombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  tipoNombreActivo: { color: colors.primario },
  tipoDesc: { fontSize: 12, color: colors.textoSuave, marginTop: 1 },
  tipoPrecio2: {
    fontSize: 15, fontWeight: '800', color: colors.texto,
    fontVariant: ['tabular-nums'],
  },
  tipoPrecioGratis: { color: colors.secundario, fontSize: 13, fontWeight: '800' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.bordeOscuro,
  },
  radioActivo: { borderColor: colors.primario, backgroundColor: colors.primario },


  costos: { marginBottom: espacio.sm },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  lineaLabel: { fontSize: 14, color: colors.textoSuave },
  lineaValor: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  lineaFuerte: { fontSize: 18, fontWeight: '900', color: colors.texto },
  lineaFuerteValor: { fontSize: 22, fontWeight: '900', color: colors.primario },
  separadorTotal: { height: 1, backgroundColor: colors.borde, marginVertical: espacio.sm },

  aviso: {
    backgroundColor: '#FFF9E6',
    padding: espacio.sm,
    borderRadius: radio.sm,
    marginBottom: espacio.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avisoTxt: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  // Aviso de "solo pickup": verde y en tono de oferta, no de error
  avisoPickup: {
    backgroundColor: '#E8F5E9',
    borderRadius: radio.sm,
    borderWidth: 1, borderColor: '#A5D6A7',
    paddingVertical: espacio.sm, paddingHorizontal: espacio.md,
    marginBottom: espacio.sm,
  },
  avisoPickupTxt: { fontSize: 13, color: '#1B5E20', fontWeight: '700', lineHeight: 19 },

  progresoBarra: {
    height: 6, borderRadius: 3, backgroundColor: '#FDE68A',
    overflow: 'hidden', marginBottom: espacio.xs,
  },
  progresoRelleno: {
    height: '100%', backgroundColor: colors.primario, borderRadius: 3,
  },
});
