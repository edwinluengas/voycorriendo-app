/**
 * CampoTelefono — número con selector de país.
 *
 * Puerto Escondido recibe mucho turismo y residentes extranjeros, así que el
 * teléfono dejó de ser "10 dígitos mexicanos": se captura (lada, número
 * nacional) y el backend lo guarda como par único.
 *
 * Uso:
 *   <CampoTelefono lada={lada} onChangeLada={setLada}
 *                  telefono={tel} onChangeTelefono={setTel} />
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  FlatList, StyleSheet, Pressable,
} from 'react-native';
import { colors, espacio, radio } from '../theme/colors';

// Países con presencia real en Puerto Escondido (turismo y residentes),
// México primero. `dig` = [mín, máx] dígitos del número nacional; debe
// coincidir con RANGOS en el backend (src/utils/telefono.js).
export const PAISES = [
  { iso: 'MX', lada: '52',  bandera: '🇲🇽', nombre: 'México',            dig: [10, 10] },
  { iso: 'US', lada: '1',   bandera: '🇺🇸', nombre: 'Estados Unidos',    dig: [10, 10] },
  { iso: 'CA', lada: '1',   bandera: '🇨🇦', nombre: 'Canadá',            dig: [10, 10] },
  { iso: 'AR', lada: '54',  bandera: '🇦🇷', nombre: 'Argentina',         dig: [10, 11] },
  { iso: 'BR', lada: '55',  bandera: '🇧🇷', nombre: 'Brasil',            dig: [10, 11] },
  { iso: 'CL', lada: '56',  bandera: '🇨🇱', nombre: 'Chile',             dig: [9, 9]   },
  { iso: 'CO', lada: '57',  bandera: '🇨🇴', nombre: 'Colombia',          dig: [10, 10] },
  { iso: 'PE', lada: '51',  bandera: '🇵🇪', nombre: 'Perú',              dig: [9, 9]   },
  { iso: 'ES', lada: '34',  bandera: '🇪🇸', nombre: 'España',            dig: [9, 9]   },
  { iso: 'FR', lada: '33',  bandera: '🇫🇷', nombre: 'Francia',           dig: [9, 9]   },
  { iso: 'DE', lada: '49',  bandera: '🇩🇪', nombre: 'Alemania',          dig: [6, 12]  },
  { iso: 'IT', lada: '39',  bandera: '🇮🇹', nombre: 'Italia',            dig: [6, 11]  },
  { iso: 'GB', lada: '44',  bandera: '🇬🇧', nombre: 'Reino Unido',       dig: [9, 10]  },
  { iso: 'NL', lada: '31',  bandera: '🇳🇱', nombre: 'Países Bajos',      dig: [9, 9]   },
  { iso: 'CH', lada: '41',  bandera: '🇨🇭', nombre: 'Suiza',             dig: [9, 9]   },
  { iso: 'AT', lada: '43',  bandera: '🇦🇹', nombre: 'Austria',           dig: [7, 13]  },
  { iso: 'SE', lada: '46',  bandera: '🇸🇪', nombre: 'Suecia',            dig: [7, 13]  },
  { iso: 'NO', lada: '47',  bandera: '🇳🇴', nombre: 'Noruega',           dig: [8, 8]   },
  { iso: 'DK', lada: '45',  bandera: '🇩🇰', nombre: 'Dinamarca',         dig: [8, 8]   },
  { iso: 'AU', lada: '61',  bandera: '🇦🇺', nombre: 'Australia',         dig: [9, 9]   },
  { iso: 'NZ', lada: '64',  bandera: '🇳🇿', nombre: 'Nueva Zelanda',     dig: [8, 10]  },
  { iso: 'JP', lada: '81',  bandera: '🇯🇵', nombre: 'Japón',             dig: [10, 11] },
  { iso: 'KR', lada: '82',  bandera: '🇰🇷', nombre: 'Corea del Sur',     dig: [9, 11]  },
  { iso: 'IL', lada: '972', bandera: '🇮🇱', nombre: 'Israel',            dig: [9, 9]   },
];

export const paisPorIso  = (iso)  => PAISES.find((p) => p.iso === iso) || PAISES[0];
export const paisPorLada = (lada) => PAISES.find((p) => p.lada === String(lada)) || PAISES[0];

// Validación local — evita mandar al servidor un número que ya sabemos malo
export const validarTelefono = (telefono, pais) => {
  const digitos = String(telefono || '').replace(/\D/g, '');
  const [min, max] = pais?.dig || [6, 15];
  if (!digitos) return 'Escribe tu número de celular.';
  if (digitos.length < min || digitos.length > max) {
    return min === max
      ? `Para ${pais.nombre} el número debe tener ${min} dígitos (llevas ${digitos.length}).`
      : `Para ${pais.nombre} el número debe tener entre ${min} y ${max} dígitos (llevas ${digitos.length}).`;
  }
  return null;
};

export default function CampoTelefono({
  pais, onChangePais,
  telefono, onChangeTelefono,
  label = 'CELULAR',
  editable = true,
  onSubmitEditing,
  autoFocus = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const paisActual = pais || PAISES[0];
  const maxLen = useMemo(() => paisActual.dig[1], [paisActual]);

  return (
    <>
      {!!label && <Text style={estilos.label}>{label}</Text>}
      <View style={estilos.fila}>
        <TouchableOpacity
          style={estilos.selectorPais}
          onPress={() => setAbierto(true)}
          disabled={!editable}
          activeOpacity={0.7}
        >
          <Text style={estilos.bandera}>{paisActual.bandera}</Text>
          <Text style={estilos.ladaTxt}>+{paisActual.lada}</Text>
          <Text style={estilos.flecha}>▾</Text>
        </TouchableOpacity>

        <TextInput
          style={estilos.input}
          placeholder={paisActual.dig[0] === paisActual.dig[1]
            ? `${paisActual.dig[0]} dígitos`
            : 'Tu número'}
          placeholderTextColor="#A0A0A8"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={(v) => onChangeTelefono(v.replace(/\D/g, ''))}
          maxLength={maxLen}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
        />
      </View>

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <Pressable style={estilos.fondoModal} onPress={() => setAbierto(false)}>
          <Pressable style={estilos.hojaModal} onPress={(e) => e.stopPropagation()}>
            <View style={estilos.asa} />
            <Text style={estilos.tituloModal}>Elige tu país</Text>
            <FlatList
              data={PAISES}
              keyExtractor={(p) => p.iso}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => {
                const activo = item.iso === paisActual.iso;
                return (
                  <TouchableOpacity
                    style={[estilos.filaPais, activo && estilos.filaPaisActiva]}
                    onPress={() => { onChangePais(item); setAbierto(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={estilos.banderaLista}>{item.bandera}</Text>
                    <Text style={[estilos.nombrePais, activo && estilos.nombrePaisActivo]}>{item.nombre}</Text>
                    <Text style={estilos.ladaLista}>+{item.lada}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 7, letterSpacing: 0.8 },
  fila: { flexDirection: 'row', gap: 8, marginBottom: espacio.md },
  selectorPais: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: radio.md, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 16,
  },
  bandera: { fontSize: 18 },
  ladaTxt: { fontSize: 16, fontWeight: '700', color: '#111827' },
  flecha:  { fontSize: 11, color: '#6B7280' },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radio.md, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: espacio.md, paddingVertical: 16,
    fontSize: 16, color: '#111827',
  },
  fondoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  hojaModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl,
    paddingTop: espacio.sm, paddingBottom: espacio.xl,
    maxHeight: '75%',
  },
  asa: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: espacio.md },
  tituloModal: { fontSize: 18, fontWeight: '800', color: '#111827', paddingHorizontal: espacio.lg, marginBottom: espacio.sm },
  filaPais: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: espacio.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  filaPaisActiva: { backgroundColor: '#FFF4ED' },
  banderaLista: { fontSize: 22 },
  nombrePais: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '600' },
  nombrePaisActivo: { color: colors.primario, fontWeight: '800' },
  ladaLista: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
});
