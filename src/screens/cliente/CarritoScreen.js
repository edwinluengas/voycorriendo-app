import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCarrito, carritoRequiereINE } from './NegocioScreen';
import Boton from '../../components/Boton';
import { colors, espacio, radio } from '../../theme/colors';

const FEES = { standard: 35, express: 60 };
const PEDIDO_MINIMO = 100;
const TOKENS_POR_PESO = 10;

const TIPOS_ENVIO = [
  { id: 'standard', label: 'Estándar', sub: 'Entrega normal · mismo día', precio: 35 },
  { id: 'express',  label: 'Express',  sub: 'Prioridad máxima · llega primero', precio: 60 },
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
        <Text style={{ fontSize: 56 }}>🛒</Text>
        <Text style={estilos.vacioTxt}>Tu carrito está vacío</Text>
        <Boton titulo="Volver a los negocios" variante="secundario" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(it) => it._key || it.producto_id}
        ListHeaderComponent={
          <>
            <Text style={estilos.seccion}>{carrito.negocio?.nombre}</Text>

            {requiereINE && (
              <View style={estilos.avisoINE}>
                <Text style={estilos.avisoINEEmoji}>🔞</Text>
                <Text style={estilos.avisoINETxt}>
                  Tu carrito tiene productos con restricción de edad. Te pediremos una foto de tu INE al pagar.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={estilos.item}>
            <View style={{ flex: 1 }}>
              <View style={estilos.nombreFila}>
                <Text style={estilos.nombre}>{item.nombre}</Text>
                {item.requiere_id && <Text style={estilos.badgeEdad}>🔞 +18</Text>}
              </View>
              {!!item.opcion_elegida && (
                <Text style={estilos.opcionTxt}>🏷️ {item.opcion_elegida}</Text>
              )}
              {!!item.notas && (
                <Text style={estilos.notasTxt}>📝 {item.notas}</Text>
              )}
              <Text style={estilos.precio}>${item.precio_unitario.toFixed(2)} c/u</Text>
            </View>
            <View style={estilos.controles}>
              <Pressable style={estilos.btnCtrl} onPress={() => cambiarCantidad(item._key, -1)}>
                <Text style={estilos.btnCtrlTxt}>−</Text>
              </Pressable>
              <Text style={estilos.cant}>{item.cantidad}</Text>
              <Pressable style={estilos.btnCtrl} onPress={() => cambiarCantidad(item._key, +1)}>
                <Text style={estilos.btnCtrlTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
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
                <Text style={estilos.sugerenciaTitulo}>¿Se te antoja una bebida?</Text>
                <Text style={estilos.sugerenciaSub}>
                  Pide refrescos, cervezas o aguas frescas de Abarrotes La Esquina como pedido aparte →
                </Text>
              </View>
            </Pressable>
          ) : null
        }
      />

      <View style={estilos.resumen}>
        <Text style={estilos.tipoTitulo}>Tipo de entrega</Text>
        <View style={estilos.tipoFila}>
          {TIPOS_ENVIO.map((t) => (
            <Pressable
              key={t.id}
              style={[estilos.tipoBtn, tipoEnvio === t.id && estilos.tipoBtnActivo]}
              onPress={() => setTipoEnvio(t.id)}
            >
              <Text style={[estilos.tipoLabel, tipoEnvio === t.id && estilos.tipoLabelActivo]}>
                {t.label}
              </Text>
              <Text style={[estilos.tipoPrecio, tipoEnvio === t.id && estilos.tipoLabelActivo]}>
                ${t.precio} envío
              </Text>
              <Text style={estilos.tipoSub}>{t.sub}</Text>
            </Pressable>
          ))}
        </View>
        <Linea label="Subtotal" valor={subtotal} />
        <Linea label={`Envío ${tipoEnvio === 'express' ? 'Express' : 'Estándar'}`} valor={feeEnvio} />
        <View style={estilos.separador} />
        <Linea label="Total" valor={total} fuerte />

        {tokens > 0 && !debajo && (
          <View style={estilos.tokensRow}>
            <Text style={estilos.tokensTxt}>
              🪙 Ganarás <Text style={{ fontWeight: '800' }}>{tokens} VoyTokens</Text> con este pedido
              {tokens >= 35 ? '  ·  ¡Suficientes para 1 envío gratis!' : `  ·  necesitas ${35 - tokens} más para envío gratis`}
            </Text>
          </View>
        )}

        {debajo && (
          <Text style={estilos.aviso}>
            ⚠️ Pedido mínimo $100 en productos. Te faltan ${(PEDIDO_MINIMO - subtotal).toFixed(2)} MXN.
          </Text>
        )}

        {total > 500 && (
          <Text style={estilos.aviso}>
            ⚠️ Tu pedido supera $500 MXN. El pago en efectivo no estará disponible; elige tarjeta,
            transferencia o Mercado Pago en el siguiente paso.
          </Text>
        )}

        <View style={{ height: espacio.md }} />
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
    <Text style={[estilos.lineaLabel, fuerte && estilos.fuerte]}>{label}</Text>
    <Text style={[estilos.lineaValor, fuerte && estilos.fuerte]}>${valor.toFixed(2)}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  vacio: { flex: 1, backgroundColor: colors.fondo, alignItems: 'center', justifyContent: 'center', gap: espacio.md },
  vacioTxt: { fontSize: 18, color: colors.textoSuave, marginBottom: espacio.md },
  seccion: { padding: espacio.lg, fontSize: 18, fontWeight: '700', color: colors.texto },
  item: {
    flexDirection: 'row',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    marginHorizontal: espacio.md,
    marginVertical: espacio.xs,
    borderRadius: radio.md,
    alignItems: 'center',
  },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, flexWrap: 'wrap' },
  nombre: { fontSize: 15, fontWeight: '600', color: colors.texto, flexShrink: 1 },
  badgeEdad: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9B1C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radio.sm,
    overflow: 'hidden',
  },
  opcionTxt: { fontSize: 13, color: colors.secundario, marginTop: 2, fontWeight: '600' },
  notasTxt: { fontSize: 12, color: colors.textoSuave, marginTop: 2, fontStyle: 'italic' },
  precio: { fontSize: 13, color: colors.textoSuave, marginTop: 2 },

  // Aviso INE
  avisoINE: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: espacio.md,
    marginBottom: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  avisoINEEmoji: { fontSize: 24 },
  avisoINETxt: { flex: 1, fontSize: 13, color: '#7F1D1D', fontWeight: '600', lineHeight: 18 },

  // Sugerencia cruzada (bebidas/cervezas de otras tiendas)
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    marginHorizontal: espacio.md,
    marginTop: espacio.md,
    marginBottom: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    gap: espacio.md,
    borderWidth: 1,
    borderColor: '#FFD6A5',
  },
  sugerenciaEmoji: { fontSize: 32 },
  sugerenciaTitulo: { fontSize: 15, fontWeight: '800', color: colors.texto },
  sugerenciaSub: { fontSize: 12, color: colors.textoSuave, marginTop: 2, lineHeight: 16 },
  controles: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  btnCtrl: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCtrlTxt: { fontSize: 20, color: colors.primario, fontWeight: '700', lineHeight: 22 },
  cant: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  resumen: {
    backgroundColor: colors.superficie,
    padding: espacio.lg,
    borderTopLeftRadius: radio.lg,
    borderTopRightRadius: radio.lg,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: espacio.xs },
  lineaLabel: { fontSize: 15, color: colors.textoSuave },
  lineaValor: { fontSize: 15, color: colors.texto, fontWeight: '600' },
  fuerte: { fontSize: 18, fontWeight: '800', color: colors.texto },
  separador: { height: 1, backgroundColor: colors.borde, marginVertical: espacio.sm },
  aviso: {
    backgroundColor: '#FFF9E6', padding: espacio.sm, borderRadius: radio.sm,
    color: colors.texto, fontSize: 13, marginTop: espacio.md, lineHeight: 18,
  },
  tokensRow: {
    backgroundColor: '#FFFBEB',
    borderRadius: radio.sm,
    padding: espacio.sm,
    marginTop: espacio.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tokensTxt: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  tipoTitulo: { fontSize: 14, fontWeight: '700', color: colors.textoSuave, marginBottom: espacio.sm },
  tipoFila: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.md },
  tipoBtn: {
    flex: 1, padding: espacio.sm, borderRadius: radio.md,
    borderWidth: 1.5, borderColor: colors.borde,
    backgroundColor: colors.fondo, alignItems: 'center',
  },
  tipoBtnActivo: { borderColor: colors.primario, backgroundColor: '#FFF3E8' },
  tipoLabel: { fontSize: 14, fontWeight: '800', color: colors.textoSuave },
  tipoLabelActivo: { color: colors.primario },
  tipoPrecio: { fontSize: 16, fontWeight: '800', color: colors.textoSuave, marginTop: 2 },
  tipoSub: { fontSize: 10, color: colors.textoSuave, textAlign: 'center', marginTop: 2 },
});
