/**
 * Elegir localidad a mano.
 *
 * La plaza se detecta por GPS, pero hace falta una salida manual: el permiso
 * de ubicación puede estar denegado, el GPS puede fallar dentro de un local,
 * o la persona puede estar de viaje y querer pedir en su pueblo. Sin esto la
 * única forma de "cambiarse de plaza" era mudarse.
 */
import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, espacio, radio } from '../theme/colors';
import { usePlaza } from '../context/PlazaContext';

export default function SelectorPlaza({ visible, onCerrar }) {
  const { plazas, slug, cambiarPlaza, detectarDeNuevo } = usePlaza();

  const elegir = async (s) => {
    await cambiarPlaza(s);
    onCerrar?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={estilos.fondo} onPress={onCerrar}>
        {/* El Pressable interno para el panel: tocar dentro NO cierra. */}
        <Pressable style={estilos.panel} onPress={() => {}}>
          <View style={estilos.raya} />
          <Text style={estilos.titulo}>¿Dónde estás?</Text>
          <Text style={estilos.sub}>
            Verás los negocios y repartidores de la localidad que elijas.
          </Text>

          <ScrollView style={{ maxHeight: 360 }}>
            {plazas.map((p) => {
              const activa = p.slug === slug;
              return (
                <Pressable
                  key={p.slug}
                  style={[estilos.fila, activa && estilos.filaActiva]}
                  onPress={() => elegir(p.slug)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[estilos.nombre, activa && estilos.nombreActivo]}>{p.nombre}</Text>
                    <Text style={estilos.marca}>{p.marca} · {p.estado}</Text>
                  </View>
                  {activa && <Ionicons name="checkmark-circle" size={22} color={colors.primario} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={estilos.btnGps}
            onPress={async () => { await detectarDeNuevo(); onCerrar?.(); }}
          >
            <Ionicons name="navigate" size={16} color={colors.primario} />
            <Text style={estilos.btnGpsTxt}>Detectar con mi ubicación</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  panel: {
    backgroundColor: colors.superficie,
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    padding: espacio.lg,
    paddingBottom: espacio.xl,
  },
  raya: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.bordeOscuro,
    alignSelf: 'center', marginBottom: espacio.md,
  },
  titulo: { fontSize: 20, fontWeight: '900', color: colors.texto },
  sub: { fontSize: 13, color: colors.textoSuave, marginTop: 2, marginBottom: espacio.md },
  fila: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: espacio.md, paddingHorizontal: espacio.md,
    borderRadius: radio.md, borderWidth: 1, borderColor: colors.borde,
    marginBottom: espacio.sm,
  },
  filaActiva: { borderColor: colors.primario, backgroundColor: '#FF5C000D' },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  nombreActivo: { color: colors.primario },
  marca: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  btnGps: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: espacio.sm, paddingVertical: espacio.md,
    borderRadius: radio.md, borderWidth: 1, borderColor: colors.primario,
  },
  btnGpsTxt: { color: colors.primario, fontWeight: '800', fontSize: 14 },
});
