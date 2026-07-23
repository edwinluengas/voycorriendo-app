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
// el resto — y su CVV es de 4 dígitos exactos (impreso al frente de la
// tarjeta); el resto de marcas usa 3 exactos (ver cvvEsperado abajo).
const formatearNumero = (v) => {
  const limpio = v.replace(/[^0-9]/g, '').slice(0, 19);
  if (/^3[47]/.test(limpio)) {
    return [limpio.slice(0, 4), limpio.slice(4, 10), limpio.slice(10, 15)].filter(Boolean).join(' ');
  }
  return limpio.replace(/(.{4})/g, '$1 ').trim();
};

const esAmex = (numero) => /^3[47]/.test(String(numero || '').replace(/\s+/g, ''));

// Longitud de CVV según la marca: Amex usa 4 dígitos (impreso al frente),
// todas las demás usan 3. Exportado para que las pantallas validen también
// el CVV de tarjetas guardadas (ahí la marca viene de payment_method_id).
export const cvvEsperado = (numero) => (esAmex(numero) ? 4 : 3);
export const cvvEsperadoPorMarca = (payment_method_id) => (payment_method_id === 'amex' ? 4 : 3);

// Algoritmo de Luhn — atrapa números mal tecleados antes de intentar
// tokenizar con Mercado Pago (que fallaría con un error menos claro).
const pasaLuhn = (numero) => {
  const digitos = String(numero || '').replace(/\s+/g, '');
  if (!/^\d+$/.test(digitos)) return false;
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
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
    if (bin.length < 6) {
      clearTimeout(timeoutRef.current);
      binVigenteRef.current = '';
      setMetodoDetectado(null);
      return;
    }
    // Mismo BIN que la búsqueda ya programada/en curso: salir SIN tocar el
    // timer. OJO: este efecto no debe tener cleanup ni un clearTimeout
    // incondicional al inicio — cada dígito que el usuario teclea después
    // del 6° re-corre el efecto, y cancelar aquí el timer pendiente lo
    // mataba sin que este early-return lo reprogramara jamás: tecleando de
    // corrido la detección nunca se disparaba y el pago quedaba bloqueado
    // en "no identificamos tu banco" (regresión introducida en v1.2.27).
    if (binVigenteRef.current === bin) return;
    clearTimeout(timeoutRef.current);
    binVigenteRef.current = bin;
    timeoutRef.current = setTimeout(async () => {
      try {
        const info = await buscarMetodoPago(bin);
        if (binVigenteRef.current !== bin) return;
        setMetodoDetectado(info);
        // Sin resultado: liberar el BIN para que una edición del número
        // (o el reintento de PagoScreen al confirmar) pueda volver a buscar.
        if (!info) binVigenteRef.current = '';
      } catch (_) {
        if (binVigenteRef.current === bin) {
          setMetodoDetectado(null);
          binVigenteRef.current = ''; // error de red: permitir reintento
        }
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.numero]);

  // El timer solo se limpia al desmontar el formulario.
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

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
          placeholder={esAmex(datos.numero) ? '1234' : '123'}
          keyboardType="numeric"
          maxLength={cvvEsperado(datos.numero)}
          value={datos.cvv}
          onChangeText={set('cvv')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

export const tarjetaCompleta = (d) => {
  const numeroLimpio = d.numero.replace(/\s+/g, '');
  if (numeroLimpio.length < 13 || d.nombre.trim().length < 3) return false;
  if (!pasaLuhn(numeroLimpio)) return false;
  if (d.mes.length !== 2 || d.anio.length !== 2) return false;
  if (d.cvv.length !== cvvEsperado(d.numero)) return false;
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
