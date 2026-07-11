/**
 * Wizard de onboarding del repartidor (estilo Uber/Rappi)
 *
 * 5 pasos:
 *   1. Vehiculo  (tipo, marca, modelo, año, placa, color)
 *   2. INE frente + reverso (fotos)
 *   3. Licencia + tarjeta de circulacion (fotos)
 *   4. Cuenta bancaria (CLABE, banco)
 *   5. Resumen + enviar a revision
 *
 * Cada paso guarda al backend antes de avanzar para que el usuario
 * no pierda datos si cierra la app.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { repartidoresAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import { colors, espacio, radio } from '../../theme/colors';

const TOTAL_PASOS = 5;

export default function OnboardingRepartidorScreen({ navigation }) {
  const { cargarRoles } = useAuth();
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState({
    tipo_vehiculo: 'motocicleta',
    marca_vehiculo: '',
    modelo_vehiculo: '',
    anio_vehiculo: '',
    placa_vehiculo: '',
    color_vehiculo: '',
    clabe_bancaria: '',
    banco: '',
    foto_ine_frente: null,
    foto_ine_reverso: null,
    foto_licencia: null,
    foto_tarjeta_circulacion: null,
  });

  // Activamos modo repartidor al abrir (idempotente: si ya existe, no truena)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await repartidoresAPI.activarModo();
        const r = data.data?.repartidor;
        if (r) {
          setDatos((d) => ({
            ...d,
            tipo_vehiculo:    r.tipo_vehiculo    || d.tipo_vehiculo,
            marca_vehiculo:   r.marca_vehiculo   || '',
            modelo_vehiculo:  r.modelo_vehiculo  || '',
            anio_vehiculo:    r.anio_vehiculo ? String(r.anio_vehiculo) : '',
            placa_vehiculo:   r.placa_vehiculo   || '',
            color_vehiculo:   r.color_vehiculo   || '',
            clabe_bancaria:   r.clabe_bancaria   || '',
            banco:            r.banco            || '',
            foto_ine_frente:  r.foto_ine_frente,
            foto_ine_reverso: r.foto_ine_reverso,
            foto_licencia:    r.foto_licencia,
            foto_tarjeta_circulacion: r.foto_tarjeta_circulacion,
          }));
        }
      } catch (e) {
        Alert.alert('Error', e.mensajeAmigable || 'No pudimos abrir el formulario.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // ── Helpers para guardar paso a paso ──────────────────────
  const guardarParcial = async (campos) => {
    setGuardando(true);
    try {
      await repartidoresAPI.actualizarPerfil(campos);
      return true;
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Picker + subida de fotos ──────────────────────────────
  const _subirFotoConAsset = async (tipo, columnaLocal, asset) => {
    if (!asset?.base64) { Alert.alert('Error', 'No pudimos leer la foto.'); return; }
    setGuardando(true);
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const { data } = await repartidoresAPI.subirFoto(tipo, asset.base64, mime);
      setDatos((d) => ({ ...d, [columnaLocal]: data.data?.url }));
    } catch (e) {
      Alert.alert('Error al subir', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarYSubir = (tipo, columnaLocal) => {
    Alert.alert('Seleccionar imagen', '¿De dónde quieres subir la foto?', [
      {
        text: '📷 Tomar foto',
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, allowsEditing: false });
          if (!r.canceled && r.assets?.length) await _subirFotoConAsset(tipo, columnaLocal, r.assets[0]);
        },
      },
      {
        text: '🖼️ Elegir de galería',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6, allowsEditing: false,
          });
          if (!r.canceled && r.assets?.length) await _subirFotoConAsset(tipo, columnaLocal, r.assets[0]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Avanzar / retroceder ──────────────────────────────────
  const irSiguiente = async () => {
    if (paso === 1) {
      if (!datos.placa_vehiculo) {
        return Alert.alert('Falta', 'Captura la placa de tu vehículo.');
      }
      const ok = await guardarParcial({
        tipo_vehiculo:   datos.tipo_vehiculo,
        marca_vehiculo:  datos.marca_vehiculo,
        modelo_vehiculo: datos.modelo_vehiculo,
        anio_vehiculo:   datos.anio_vehiculo ? Number(datos.anio_vehiculo) : null,
        placa_vehiculo:  datos.placa_vehiculo.toUpperCase(),
        color_vehiculo:  datos.color_vehiculo,
      });
      if (!ok) return;
    }
    if (paso === 2) {
      if (!datos.foto_ine_frente || !datos.foto_ine_reverso) {
        return Alert.alert('Faltan fotos', 'Sube ambas caras de tu INE.');
      }
    }
    if (paso === 3) {
      if (!datos.foto_licencia) {
        return Alert.alert('Falta foto', 'Sube tu licencia de conducir.');
      }
    }
    if (paso === 4) {
      if (datos.clabe_bancaria.length !== 18) {
        return Alert.alert('CLABE inválida', 'La CLABE debe tener exactamente 18 dígitos.');
      }
      if (!datos.banco) {
        return Alert.alert('Falta', 'Selecciona o escribe tu banco.');
      }
      const ok = await guardarParcial({
        clabe_bancaria: datos.clabe_bancaria,
        banco:          datos.banco,
      });
      if (!ok) return;
    }
    setPaso((p) => Math.min(p + 1, TOTAL_PASOS));
  };

  const irAtras = () => setPaso((p) => Math.max(p - 1, 1));

  const enviarSolicitud = async () => {
    setGuardando(true);
    try {
      const { data } = await repartidoresAPI.enviarARevision();
      Alert.alert(
        '¡Listo! 🎉',
        data.mensaje || 'Tu solicitud está en revisión. Te avisaremos en menos de 48 horas.',
        [{ text: 'Entendido', onPress: () => {
          cargarRoles();
          navigation.goBack();
        }}]
      );
    } catch (e) {
      Alert.alert('No pudimos enviar', e.mensajeAmigable || 'Verifica que llenaste todo.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[estilos.contenedor, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
      >
        <BarraProgreso paso={paso} total={TOTAL_PASOS} />

        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={true}
        >
          {paso === 1 && <PasoVehiculo datos={datos} setDatos={setDatos} />}
          {paso === 2 && (
            <PasoFotos
              titulo="Identificación oficial (INE)"
              subtitulo="Necesitamos las dos caras claras y completas."
              fotos={[
                { tipo: 'ine_frente',  columna: 'foto_ine_frente',  label: 'INE - Frente' },
                { tipo: 'ine_reverso', columna: 'foto_ine_reverso', label: 'INE - Reverso' },
              ]}
              datos={datos}
              seleccionar={seleccionarYSubir}
            />
          )}
          {paso === 3 && (
            <PasoFotos
              titulo="Licencia y tarjeta de circulación"
              subtitulo="La licencia es obligatoria. La tarjeta es opcional pero ayuda."
              fotos={[
                { tipo: 'licencia',            columna: 'foto_licencia',            label: 'Licencia de conducir' },
                { tipo: 'tarjeta_circulacion', columna: 'foto_tarjeta_circulacion', label: 'Tarjeta de circulación (opcional)' },
              ]}
              datos={datos}
              seleccionar={seleccionarYSubir}
            />
          )}
          {paso === 4 && <PasoBancario datos={datos} setDatos={setDatos} />}
          {paso === 5 && <PasoResumen datos={datos} />}
        </ScrollView>

        <View style={estilos.botones}>
          {paso > 1 && (
            <Boton
              titulo="Atrás"
              variante="secundario"
              onPress={irAtras}
              estilo={{ flex: 1, marginRight: espacio.sm }}
              deshabilitado={guardando}
            />
          )}
          {paso < TOTAL_PASOS ? (
            <Boton
              titulo={guardando ? 'Guardando...' : 'Continuar'}
              onPress={irSiguiente}
              estilo={{ flex: 2 }}
              cargando={guardando}
            />
          ) : (
            <Boton
              titulo="Enviar a revisión"
              onPress={enviarSolicitud}
              estilo={{ flex: 2 }}
              cargando={guardando}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Barra de progreso ──────────────────────────────────────
function BarraProgreso({ paso, total }) {
  return (
    <View style={estilos.barra}>
      <Text style={estilos.barraTxt}>Paso {paso} de {total}</Text>
      <View style={estilos.barraTrack}>
        <View style={[estilos.barraFill, { width: `${(paso / total) * 100}%` }]} />
      </View>
    </View>
  );
}

// ─── Paso 1: Vehiculo ───────────────────────────────────────
function PasoVehiculo({ datos, setDatos }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  return (
    <View>
      <Text style={estilos.tituloPaso}>🛵 Tu vehículo</Text>
      <Text style={estilos.subtitulo}>
        ¿Con qué vas a entregar los pedidos?
      </Text>

      <View style={estilos.opcionesFila}>
        <OpcionTipo
          activo={datos.tipo_vehiculo === 'motocicleta'}
          icono="🛵"
          label="Motocicleta"
          onPress={() => set('tipo_vehiculo')('motocicleta')}
        />
        <OpcionTipo
          activo={datos.tipo_vehiculo === 'bicicleta'}
          icono="🚲"
          label="Bicicleta"
          onPress={() => set('tipo_vehiculo')('bicicleta')}
        />
      </View>

      <Campo
        etiqueta="Placa *"
        placeholder="Ej. ABC123"
        value={datos.placa_vehiculo}
        onChangeText={set('placa_vehiculo')}
        autoCapitalize="characters"
        maxLength={10}
      />
      <Campo
        etiqueta="Marca"
        placeholder="Ej. Italika"
        value={datos.marca_vehiculo}
        onChangeText={set('marca_vehiculo')}
      />
      <Campo
        etiqueta="Modelo"
        placeholder="Ej. FT-150"
        value={datos.modelo_vehiculo}
        onChangeText={set('modelo_vehiculo')}
      />
      <Campo
        etiqueta="Año"
        placeholder="Ej. 2022"
        value={datos.anio_vehiculo}
        onChangeText={set('anio_vehiculo')}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Campo
        etiqueta="Color"
        placeholder="Ej. Rojo"
        value={datos.color_vehiculo}
        onChangeText={set('color_vehiculo')}
      />
    </View>
  );
}

function OpcionTipo({ activo, icono, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[estilos.opcionTarjeta, activo && estilos.opcionTarjetaActiva]}
    >
      <Text style={{ fontSize: 36 }}>{icono}</Text>
      <Text style={[estilos.opcionTexto, activo && { color: colors.primario }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Paso 2 y 3: Fotos genericas ────────────────────────────
function PasoFotos({ titulo, subtitulo, fotos, datos, seleccionar }) {
  return (
    <View>
      <Text style={estilos.tituloPaso}>📸 {titulo}</Text>
      <Text style={estilos.subtitulo}>{subtitulo}</Text>

      {fotos.map((f) => (
        <View key={f.tipo} style={estilos.cuadroFoto}>
          <Text style={estilos.fotoLabel}>{f.label}</Text>
          {datos[f.columna] ? (
            <Image source={{ uri: datos[f.columna] }} style={estilos.fotoPreview} />
          ) : (
            <View style={estilos.fotoPlaceholder}>
              <Text style={{ fontSize: 40 }}>📷</Text>
              <Text style={estilos.fotoPlaceholderTxt}>Sin foto aún</Text>
            </View>
          )}
          <Pressable style={[estilos.fotoBoton, { alignSelf: 'stretch' }]} onPress={() => seleccionar(f.tipo, f.columna)}>
            <Text style={estilos.fotoBotonTxt}>
              {datos[f.columna] ? '🔄 Cambiar foto' : '📷 Subir foto'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ─── Paso 4: Cuenta bancaria ────────────────────────────────
function PasoBancario({ datos, setDatos }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  const bancos = ['BBVA', 'Banamex', 'Santander', 'Banorte', 'HSBC', 'Azteca', 'Mercado Pago', 'Otro'];
  return (
    <View>
      <Text style={estilos.tituloPaso}>💳 Cuenta bancaria</Text>
      <Text style={estilos.subtitulo}>
        Aquí te depositamos tus ganancias cada semana. Debe estar a tu nombre.
      </Text>

      <Campo
        etiqueta="CLABE interbancaria (18 dígitos) *"
        placeholder="012345678901234567"
        value={datos.clabe_bancaria}
        onChangeText={(v) => set('clabe_bancaria')(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={18}
      />

      <Text style={[estilos.subtitulo, { marginTop: espacio.sm, marginBottom: espacio.sm }]}>
        ¿Con qué banco?
      </Text>
      <View style={estilos.bancosFila}>
        {bancos.map((b) => (
          <Pressable
            key={b}
            onPress={() => set('banco')(b)}
            style={[estilos.bancoChip, datos.banco === b && estilos.bancoChipActivo]}
          >
            <Text style={[estilos.bancoChipTxt, datos.banco === b && { color: '#FFF' }]}>{b}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Paso 5: Resumen ────────────────────────────────────────
function PasoResumen({ datos }) {
  return (
    <View>
      <Text style={estilos.tituloPaso}>✅ Revisa tus datos</Text>
      <Text style={estilos.subtitulo}>
        Confirma que todo esté correcto antes de enviar.
      </Text>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Vehículo</Text>
        <Item label="Tipo"   valor={datos.tipo_vehiculo} />
        <Item label="Marca"  valor={datos.marca_vehiculo} />
        <Item label="Modelo" valor={datos.modelo_vehiculo} />
        <Item label="Año"    valor={datos.anio_vehiculo} />
        <Item label="Placa"  valor={datos.placa_vehiculo} />
        <Item label="Color"  valor={datos.color_vehiculo} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Documentos</Text>
        <Item label="INE frente"     valor={datos.foto_ine_frente ? '✅ Subida' : '❌ Falta'} />
        <Item label="INE reverso"    valor={datos.foto_ine_reverso ? '✅ Subida' : '❌ Falta'} />
        <Item label="Licencia"       valor={datos.foto_licencia ? '✅ Subida' : '❌ Falta'} />
        <Item label="Tarjeta circ."  valor={datos.foto_tarjeta_circulacion ? '✅ Subida' : '— Opcional'} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Cuenta bancaria</Text>
        <Item label="Banco" valor={datos.banco} />
        <Item label="CLABE" valor={datos.clabe_bancaria ? `••••${datos.clabe_bancaria.slice(-4)}` : ''} />
      </View>

      <View style={estilos.aviso}>
        <Text style={estilos.avisoTxt}>
          🔒 Revisaremos tu información en menos de 48 horas. Te enviaremos
          una notificación cuando tu cuenta sea aprobada y puedas empezar
          a recibir pedidos.
        </Text>
      </View>
    </View>
  );
}

function Item({ label, valor }) {
  return (
    <View style={estilos.itemFila}>
      <Text style={estilos.itemLabel}>{label}</Text>
      <Text style={estilos.itemValor}>{valor || '—'}</Text>
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  // paddingBottom alto para que el ultimo campo (Color/Año) no quede
  // tapado por el teclado al hacer focus.
  scroll: { padding: espacio.lg, paddingBottom: 280 },

  barra: {
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.md,
    paddingBottom: espacio.sm,
    backgroundColor: colors.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  barraTxt: { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.xs, fontWeight: '600' },
  barraTrack: { height: 6, backgroundColor: colors.borde, borderRadius: radio.full },
  barraFill:  { height: 6, backgroundColor: colors.primario, borderRadius: radio.full },

  tituloPaso: { fontSize: 22, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  subtitulo:  { fontSize: 14, color: colors.textoSuave, marginBottom: espacio.lg, lineHeight: 20 },

  opcionesFila: { flexDirection: 'row', gap: espacio.md, marginBottom: espacio.lg },
  opcionTarjeta: {
    flex: 1,
    backgroundColor: colors.superficie,
    paddingVertical: espacio.lg,
    borderRadius: radio.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borde,
  },
  opcionTarjetaActiva: { borderColor: colors.primario, backgroundColor: '#FFF4EB' },
  opcionTexto: { fontSize: 14, fontWeight: '700', color: colors.texto, marginTop: espacio.xs },

  cuadroFoto: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.md,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  fotoLabel: { fontSize: 14, fontWeight: '700', color: colors.texto, marginBottom: espacio.sm },
  fotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: radio.sm,
    backgroundColor: colors.borde,
    marginBottom: espacio.sm,
  },
  fotoPlaceholder: {
    height: 140,
    backgroundColor: '#F3F4F6',
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.sm,
  },
  fotoPlaceholderTxt: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  fotoBotones: { flexDirection: 'row', gap: espacio.sm },
  fotoBoton: {
    flex: 1,
    paddingVertical: espacio.sm,
    backgroundColor: '#FFF4EB',
    borderRadius: radio.sm,
    alignItems: 'center',
  },
  fotoBotonTxt: { fontSize: 13, fontWeight: '600', color: colors.primario },

  bancosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  bancoChip: {
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderRadius: radio.full,
    backgroundColor: colors.superficie,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  bancoChipActivo: { backgroundColor: colors.primario, borderColor: colors.primario },
  bancoChipTxt: { fontSize: 13, fontWeight: '600', color: colors.texto },

  tarjetaResumen: {
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.md,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  resumenSeccion: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primario,
    marginBottom: espacio.sm,
    textTransform: 'uppercase',
  },
  itemFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: espacio.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  itemLabel: { fontSize: 13, color: colors.textoSuave },
  itemValor: { fontSize: 13, color: colors.texto, fontWeight: '600' },

  aviso: {
    backgroundColor: '#FEF3C7',
    padding: espacio.md,
    borderRadius: radio.md,
    marginTop: espacio.sm,
  },
  avisoTxt: { fontSize: 13, color: '#92400E', lineHeight: 19 },

  botones: {
    flexDirection: 'row',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderTopWidth: 1,
    borderTopColor: colors.borde,
  },
});
