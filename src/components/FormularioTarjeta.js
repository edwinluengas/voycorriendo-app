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

// American Express (empieza con 34 o 37) se agrupa 4-6-5, no 4-4-4-4 como
// el resto — y su CVV es de 4 dígitos (impreso al frente de la tarjeta),
// ya soportado por el campo de abajo (maxLength=4, tarjetaCompleta acepta
// cvv.length >= 3).
const formatearNumero = (v) => {
  const limpio = v.replace(/[^0-9]/g, '').slice(0, 19);
  if (/^3[47]/.test(limpio)) {
    return [limpio.slice(0, 4), limpio.slice(4, 10), limpio.slice(10, 15)].filter(Boolean).join(' ');
  }
  return limpio.replace(/(.{4})/g, '$1 ').trim();
};

export default function FormularioTarjeta({ datos, setDatos, metodoDetectado, setMetodoDetectado }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  const timeoutRef = useRef(null);
  const binVigenteRef = useRef(''); // evita que una respuesta tardía de un BIN viejo pise el estado actual

  useEffect(() => {
    // El BIN/IIN estándar de la industria son exactamente 6 dígitos — mandar
    // 7 u 8 (como se hacía antes) podía devolver de Mercado Pago un banco o
    // marca distinto al real (reportado: Mastercard Banamex detectada como
    // American Express), y ese payment_method_id incorrecto hace que MP
    // rechace el cobro real porque no coincide con la tarjeta tokenizada.
    const numeroLimpio = datos.numero.replace(/\s+/g, '');
    const bin = numeroLimpio.slice(0, 6);
    clearTimeout(timeoutRef.current);
    if (bin.length < 6) {
      binVigenteRef.current = '';
      setMetodoDetectado(null);
      return;
    }
    // Ya se buscó este mismo BIN (el usuario sigue escribiendo dígitos
    // después del 6°) — no repetir la consulta, el banco no cambia.
    if (binVigenteRef.current === bin) return;
    binVigenteRef.current = bin;
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
