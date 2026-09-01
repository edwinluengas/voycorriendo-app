import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usuariosAPI, tarjetasAPI, pedidosAPI } from '../../api/client';
import { tokenizarTarjetaNueva, mpConfigurado } from '../../api/mercadoPago';
import Boton from '../../components/Boton';
import FormularioTarjeta, { tarjetaCompleta } from '../../components/FormularioTarjeta';
import { colors, espacio, radio } from '../../theme/colors';
import { LIMITE_EFECTIVO, METODOS_PAGO_ACTIVOS_DEFAULT } from '../../config/businessRules';

const METODOS = [
  { id: 'efectivo', icono: '💵', titulo: 'Efectivo', desc: `Paga al recibir tu pedido. Máx. $${LIMITE_EFECTIVO} en productos.` },
  { id: 'tarjeta',   icono: '💳', titulo: 'Tarjeta',  desc: '🔒 Débito o crédito — pago 100% seguro.' },
];

const MARCA_EMOJI = { visa: '💳', master: '💳', mastercard: '💳', amex: '💳' };

export default function MetodosPagoScreen() {
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando]         = useState(true);
  const [guardando, setGuardando]       = useState(false);

  const [tarjetas, setTarjetas]           = useState([]);
  const [cargandoTarjetas, setCargandoTarjetas] = useState(true);
  const [mostrarForm, setMostrarForm]     = useState(false);
  const [datosTarjeta, setDatosTarjeta]   = useState({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
  const [metodoDetectado, setMetodoDetectado] = useState(null);
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);

  const cargarTarjetas = useCallback(async () => {
    try {
      const { data } = await tarjetasAPI.listar();
      setTarjetas(data.data?.tarjetas || []);
    } catch (_) {} finally {
      setCargandoTarjetas(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargarTarjetas(); }, [cargarTarjetas]));

  // Métodos habilitados hoy por la plataforma. Si la tarjeta está apagada, se
  // avisa arriba y se esconde el formulario en vez de dejar al cliente
  // teclear una tarjeta completa para que el servidor la rechace al final.
  const [metodosActivos, setMetodosActivos] = useState(METODOS_PAGO_ACTIVOS_DEFAULT);
  useFocusEffect(useCallback(() => {
    let vivo = true;
    pedidosAPI.configPublica()
      .then(({ data }) => {
        const lista = data?.data?.metodos_pago_activos;
        if (vivo && Array.isArray(lista) && lista.length) setMetodosActivos(lista);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []));
  const tarjetaActiva = metodosActivos.includes('tarjeta');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usuariosAPI.getMetodoPagoDefault();
        setSeleccionado(data.data?.metodo_pago_default || null);
      } catch (_) {}
      finally { setCargando(false); }
    })();
  }, []);

  const guardar = async (metodo) => {
    setGuardando(true);
    try {
      await usuariosAPI.setMetodoPagoDefault(metodo);
      setSeleccionado(metodo);
    } catch (_) {
      Alert.alert('Error', 'No se pudo guardar la preferencia.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarTarjetaNueva = async () => {
    if (!mpConfigurado()) {
      Alert.alert('No disponible', 'El pago con tarjeta aún no está configurado. Intenta más tarde.');
      return;
    }
    if (!tarjetaCompleta(datosTarjeta)) {
      Alert.alert('Datos incompletos', 'Revisa el número, nombre, vencimiento y CVV de tu tarjeta.');
      return;
    }
    setGuardandoTarjeta(true);
    try {
      const token = await tokenizarTarjetaNueva(datosTarjeta);
      await tarjetasAPI.agregar(token);
      setDatosTarjeta({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
      setMetodoDetectado(null);
      setMostrarForm(false);
      await cargarTarjetas();
      Alert.alert('¡Listo!', 'Tu tarjeta quedó guardada para tus próximos pedidos.');
    } catch (e) {
      const msg = e?.message === 'MP_PUBLIC_KEY_FALTANTE'
        ? 'El pago con tarjeta aún no está configurado.'
        : e?.response?.data?.message || e?.mensajeAmigable || 'No pudimos validar tu tarjeta. Revisa los datos.';
      Alert.alert('No se pudo guardar', msg);
    } finally {
      setGuardandoTarjeta(false);
    }
  };

  const eliminarTarjeta = (tarjeta) => {
    Alert.alert('Eliminar tarjeta', `¿Quitar la tarjeta terminada en ${tarjeta.ultimos_4}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await tarjetasAPI.eliminar(tarjeta.id);
          setTarjetas((t) => t.filter((x) => x.id !== tarjeta.id));
        } catch (_) {
          Alert.alert('Error', 'No se pudo eliminar la tarjeta.');
        }
      }},
    ]);
  };

  if (cargando) {
    return <View style={s.centrado}><ActivityIndicator color={colors.primario} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.contenedor} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets={true}
      >
        <Text style={s.subtitulo}>
          Elige tu método preferido. Siempre puedes cambiarlo al hacer un pedido.
        </Text>

        {!tarjetaActiva && (
          <View style={s.avisoSoloEfectivo}>
            <Text style={s.avisoSoloEfectivoTxt}>
              💵 Por ahora estamos cobrando solo en efectivo al entregar. El pago
              con tarjeta se activa muy pronto.
            </Text>
          </View>
        )}

        {METODOS.filter((m) => tarjetaActiva || m.id !== 'tarjeta').map(m => {
          const activo = seleccionado === m.id;
          return (
            <Pressable
              key={m.id}
              style={[s.card, activo && s.cardActiva]}
              onPress={() => guardar(m.id)}
              disabled={guardando}
            >
              <View style={[s.cardIcono, { backgroundColor: activo ? colors.primario + '20' : colors.fondo }]}>
                <Text style={{ fontSize: 26 }}>{m.icono}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTit, activo && { color: colors.primario }]}>{m.titulo}</Text>
                <Text style={s.cardDesc}>{m.desc}</Text>
              </View>
              <View style={[s.radio, activo && s.radioActivo]}>
                {activo && <View style={s.radioInner} />}
              </View>
            </Pressable>
          );
        })}

        {/* Con la tarjeta apagada, la sección solo se muestra si el cliente
            ya tiene tarjetas guardadas (para que pueda verlas o borrarlas).
            El botón de agregar se esconde: el servidor lo rechaza. */}
        {(tarjetaActiva || tarjetas.length > 0) && (
        <>
        <Text style={s.seccion}>Mis tarjetas</Text>

        {cargandoTarjetas ? (
          <ActivityIndicator color={colors.primario} style={{ marginVertical: espacio.md }} />
        ) : tarjetas.length === 0 && !mostrarForm ? (
          <Text style={s.sinTarjetas}>No tienes tarjetas guardadas.</Text>
        ) : (
          tarjetas.map((t) => (
            <View key={t.id} style={s.tarjetaRow}>
              <Text style={{ fontSize: 22 }}>{MARCA_EMOJI[t.marca?.toLowerCase()] || '💳'}</Text>
              <View style={{ flex: 1, marginLeft: espacio.sm }}>
                <Text style={s.tarjetaNombre}>
                  {(t.marca || 'Tarjeta').toUpperCase()} •••• {t.ultimos_4}
                  {t.predeterminada && <Text style={s.tarjetaDefault}>  · Predeterminada</Text>}
                </Text>
                {!!t.exp_mes && <Text style={s.tarjetaVenc}>Vence {String(t.exp_mes).padStart(2, '0')}/{t.exp_anio}</Text>}
              </View>
              <Pressable onPress={() => eliminarTarjeta(t)} hitSlop={10}>
                <Text style={s.eliminarTxt}>Eliminar</Text>
              </Pressable>
            </View>
          ))
        )}

        {mostrarForm ? (
          <View style={s.formBox}>
            <FormularioTarjeta
              datos={datosTarjeta}
              setDatos={setDatosTarjeta}
              metodoDetectado={metodoDetectado}
              setMetodoDetectado={setMetodoDetectado}
            />
            <Boton
              titulo={guardandoTarjeta ? 'Guardando...' : 'Guardar tarjeta'}
              onPress={guardarTarjetaNueva}
              cargando={guardandoTarjeta}
              estilo={{ marginTop: espacio.sm }}
            />
            <Pressable
              onPress={() => {
                setMostrarForm(false);
                setMetodoDetectado(null);
                // Limpia los campos — si vuelve a presionar "Agregar
                // tarjeta" no deben reaparecer los datos que había
                // tecleado antes de arrepentirse.
                setDatosTarjeta({ numero: '', nombre: '', mes: '', anio: '', cvv: '' });
              }}
              style={{ marginTop: espacio.sm, alignItems: 'center' }}
            >
              <Text style={s.cancelarTxt}>Cancelar</Text>
            </Pressable>
          </View>
        ) : tarjetaActiva ? (
          <Pressable style={s.agregarBtn} onPress={() => setMostrarForm(true)}>
            <Text style={s.agregarTxt}>+ Agregar tarjeta</Text>
          </Pressable>
        ) : null}

        {tarjetaActiva && (
          <View style={s.aviso}>
            <Text style={s.avisoTxt}>
              🔒 El número y CVV de tu tarjeta se envían directo y cifrados a Mercado Pago —
              VoyCorriendo nunca los recibe ni los almacena.
            </Text>
          </View>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  centrado:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: espacio.lg },
  subtitulo:  { fontSize: 14, color: colors.textoSuave, marginBottom: espacio.lg, lineHeight: 20 },
  seccion:    { fontSize: 16, fontWeight: '800', color: colors.texto, marginTop: espacio.lg, marginBottom: espacio.sm },

  card: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  cardActiva:  { borderColor: colors.primario, backgroundColor: '#FFF4EB' },
  cardIcono:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: espacio.md },
  cardTit:     { fontSize: 16, fontWeight: '800', color: colors.texto },
  cardDesc:    { fontSize: 13, color: colors.textoSuave, marginTop: 2 },

  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borde, alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: colors.primario },
  radioInner:  { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primario },

  sinTarjetas: { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.sm },
  tarjetaRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.sm,
  },
  tarjetaNombre: { fontSize: 14, fontWeight: '700', color: colors.texto },
  tarjetaDefault: { fontSize: 12, color: colors.primario, fontWeight: '700' },
  tarjetaVenc: { fontSize: 12, color: colors.textoSuave, marginTop: 2 },
  eliminarTxt: { fontSize: 12, color: colors.error, fontWeight: '700' },

  agregarBtn: {
    borderWidth: 1.5, borderColor: colors.primario, borderStyle: 'dashed',
    borderRadius: radio.md, padding: espacio.md, alignItems: 'center', marginBottom: espacio.md,
  },
  agregarTxt: { color: colors.primario, fontWeight: '800', fontSize: 14 },
  formBox: { backgroundColor: colors.superficie, borderRadius: radio.md, padding: espacio.md, marginBottom: espacio.md },
  cancelarTxt: { color: colors.textoSuave, fontWeight: '700', fontSize: 13 },

  aviso:    { backgroundColor: '#F0FDF4', padding: espacio.md, borderRadius: radio.md, marginTop: espacio.md },
  avisoTxt: { fontSize: 13, color: '#166534', lineHeight: 19 },
  // Aviso de "solo efectivo por ahora" — tono de información, no de error
  avisoSoloEfectivo: {
    backgroundColor: '#E8F5E9', borderRadius: radio.md,
    borderWidth: 1, borderColor: '#A5D6A7',
    padding: espacio.md, marginBottom: espacio.md,
  },
  avisoSoloEfectivoTxt: { fontSize: 13, color: '#1B5E20', fontWeight: '700', lineHeight: 19 },
});
