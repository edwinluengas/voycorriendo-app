import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCarrito, carritoRequiereINE } from './NegocioScreen';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

const FEES = { standard: 35, express: 60 };
const PEDIDO_MINIMO = 500;
const TOKENS_POR_PESO = 10;

const TIPOS_ENVIO = [
  { id: 'standard', label: 'Estándar', emoji: '🚚', sub: 'Mismo día', precio: 35 },
  { id: 'express',  label: 'Express',  emoji: '⚡', sub: 'Primero en llegar', precio: 60 },
];

export default function CarritoScreen({ navigation }) {
  const carrito = getCarrito();
  const [items, setItems]         = useState(carrito.items);
  const [tipoEnvio, setTipoEnvio] = useState('standard');

  const subtotal  = items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0);
  const feeEnvio  = FEES[tipoEnvio];
  const total     = subtotal + feeEnvio;
  const tokens    = Math.floor(subtotal / TOKENS_POR_PESO);
  const debajo    = subtotal < PEDIDO_MINIMO;
  const requiereINE = items.some((it) => it.requiere_id);
  const esRestaurante = carrito.negocio?.categoria === 'restaurante';

  const cambiarCantidad = (key, delta) => {
    const nuevos = items
      .map((it) => it._key === key ? { ...it, cantidad: it.cantidad + delta } : it)
      .filter((it) => it.cantidad > 0);
    setItems(nuevos);
    carrito.items = nuevos;
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
              <Text style={estilos.negocioNombre}>{carrito.negocio?.nombre}</Text>
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
                  Refrescos, cervezas o aguas frescas de Abarrotes La Esquina →
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
        <View style={estilos.tipoFila}>
          {TIPOS_ENVIO.map((t) => {
            const activo = tipoEnvio === t.id;
            return (
              <Pressable
                key={t.id}
                style={[estilos.tipoBtn, activo && estilos.tipoBtnActivo]}
                onPress={() => setTipoEnvio(t.id)}
              >
                <Text style={estilos.tipoEmoji}>{t.emoji}</Text>
                <View>
                  <Text style={[estilos.tipoLabel, activo && estilos.tipoLabelActivo]}>
                    {t.label}
                  </Text>
                  <Text style={estilos.tipoSub}>{t.sub}</Text>
                </View>
                <Text style={[estilos.tipoPrecio, activo && estilos.tipoLabelActivo]}>
                  ${t.precio}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Desglose de costos */}
        <View style={estilos.costos}>
          <Linea label="Subtotal" valor={subtotal} />
          <Linea label={`Envío ${tipoEnvio === 'express' ? 'Express ⚡' : 'Estándar'}`} valor={feeEnvio} />
          <View style={estilos.separadorTotal} />
          <Linea label="Total" valor={total} fuerte />
        </View>

        {/* VoyTokens */}
        {tokens > 0 && !debajo && (
          <View style={estilos.tokensRow}>
            <Text style={estilos.tokensEmoji}>🪙</Text>
            <Text style={estilos.tokensTxt}>
              Ganarás <Text style={estilos.tokensBold}>{tokens} VoyTokens</Text>
              {tokens >= 50
                ? ' — ¡suficientes para envío gratis!'
                : ` · te faltan ${50 - tokens} para envío gratis`}
            </Text>
          </View>
        )}

        {/* Avisos */}
        {debajo && (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTxt}>
              ⚠️  Pedido mínimo $500 en productos. Te faltan ${(PEDIDO_MINIMO - subtotal).toFixed(2)} MXN.
            </Text>
          </View>
        )}
        {total > 500 && (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTxt}>
              ⚠️  Pedido mayor a $500 MXN. El pago en efectivo no estará disponible.
            </Text>
          </View>
        )}

        <Boton
          titulo={debajo ? `Mínimo $${PEDIDO_MINIMO} en productos` : 'Continuar al pago →'}
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
  negocioNombre: { fontSize: 20, fontWeight: '800', color: colors.texto },

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
  tipoFila: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.md },
  tipoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    padding: espacio.sm,
    borderRadius: radio.md,
    borderWidth: 1.5,
    borderColor: colors.borde,
    backgroundColor: colors.fondo,
  },
  tipoBtnActivo: {
    borderColor: colors.primario,
    backgroundColor: '#FFF3E8',
  },
  tipoEmoji: { fontSize: 20 },
  tipoLabel: { fontSize: 13, fontWeight: '800', color: colors.textoSuave },
  tipoLabelActivo: { color: colors.primario },
  tipoSub: { fontSize: 10, color: colors.textoSuave },
  tipoPrecio: { fontSize: 14, fontWeight: '800', color: colors.textoSuave, marginLeft: 'auto' },

  costos: { marginBottom: espacio.sm },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  lineaLabel: { fontSize: 14, color: colors.textoSuave },
  lineaValor: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  lineaFuerte: { fontSize: 18, fontWeight: '900', color: colors.texto },
  lineaFuerteValor: { fontSize: 22, fontWeight: '900', color: colors.primario },
  separadorTotal: { height: 1, backgroundColor: colors.borde, marginVertical: espacio.sm },

  tokensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: radio.sm,
    padding: espacio.sm,
    marginBottom: espacio.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: espacio.xs,
  },
  tokensEmoji: { fontSize: 16 },
  tokensTxt: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  tokensBold: { fontWeight: '800' },

  aviso: {
    backgroundColor: '#FFF9E6',
    padding: espacio.sm,
    borderRadius: radio.sm,
    marginBottom: espacio.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avisoTxt: { fontSize: 12, color: '#78350F', lineHeight: 18 },
});
