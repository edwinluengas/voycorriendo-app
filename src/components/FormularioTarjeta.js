/**
 * Formulario de tarjeta nueva — captura número/nombre/vencimiento/CVV y
 * detecta el banco/marca por el BIN (primeros dígitos) contra Mercado Pago.
 * El número de tarjeta y el CVV NUNCA se mandan a nuestro backend: solo se
 * usan para tokenizar directo con MP (ver src/api/mercadoPago.js) desde la
 * pantalla que use este formulario.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Campo from './Campo';
import { buscarMetodoPago } from '../api/mercadoPago';
import { colors, espacio, radio } from '../theme/colors';

const formatearNumero = (v) => v.replace(/[^0-9]/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

export default function FormularioTarjeta({ datos, setDatos, metodoDetectado, setMetodoDetectado }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  const timeoutRef = useRef(null);
  const binVigenteRef = useRef(''); // evita que una respuesta tardía de un BIN viejo pise el estado actual

  useEffect(() => {
    const bin = datos.numero.replace(/\s+/g, '').slice(0, 8);
    binVigenteRef.current = bin;
    clearTimeout(timeoutRef.current);
    if (bin.length < 6) {
      setMetodoDetectado(null);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      try {
        const info = await buscarMetodoPago(bin);
        if (binVigenteRef.current === bin) setMetodoDetectado(info);
      } catch (_) {
        if (binVigenteRef.current === bin) setMetodoDetectado(null);
      }
    }, 400);
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.numero]);

  return (
    <View>
      <Campo
        etiqueta="Número de tarjeta"
        placeholder="0000 0000 0000 0000"
        keyboardType="numeric"
        value={datos.numero}
        onChangeText={(v) => set('numero')(formatearNumero(v))}
        maxLength={23}
      />
      {metodoDetectado && (
        <View style={s.metodoDetectado}>
          {!!metodoDetectado.logo && <Image source={{ uri: metodoDetectado.logo }} style={s.logo} />}
          <Text style={s.metodoTxt}>{metodoDetectado.nombre}</Text>
        </View>
      )}
      <Campo
        etiqueta="Nombre del titular"
        placeholder="Como aparece en la tarjeta"
        autoCapitalize="characters"
        value={datos.nombre}
        onChangeText={set('nombre')}
      />
      <View style={{ flexDirection: 'row', gap: espacio.sm }}>
        <Campo
          etiqueta="Mes"
          placeholder="MM"
          keyboardType="numeric"
          maxLength={2}
          value={datos.mes}
          onChangeText={set('mes')}
          style={{ flex: 1 }}
        />
        <Campo
          etiqueta="Año"
          placeholder="AA"
          keyboardType="numeric"
          maxLength={2}
          value={datos.anio}
          onChangeText={set('anio')}
          style={{ flex: 1 }}
        />
        <Campo
          etiqueta="CVV"
          placeholder="123"
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
          value={datos.cvv}
          onChangeText={set('cvv')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

export const tarjetaCompleta = (d) => {
  if (d.numero.replace(/\s+/g, '').length < 13 || d.nombre.trim().length < 3) return false;
  if (d.mes.length !== 2 || d.anio.length !== 2 || d.cvv.length < 3) return false;
  const mes = Number(d.mes);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
  const anio = 2000 + Number(d.anio);
  const ahora = new Date();
  const vencida = anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1);
  return !vencida;
};

const s = StyleSheet.create({
  metodoDetectado: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.xs,
    marginTop: -espacio.sm, marginBottom: espacio.sm,
  },
  logo: { width: 28, height: 18, resizeMode: 'contain' },
  metodoTxt: { fontSize: 12, color: colors.textoSuave, fontWeight: '700' },
});
