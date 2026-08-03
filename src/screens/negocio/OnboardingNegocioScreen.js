/**
 * Wizard de onboarding del negocio (estilo Rappi/DoorDash)
 *
 * 6 pasos:
 *   1. Datos basicos     (nombre, categoria, descripcion, telefono)
 *   2. Direccion         (calle, colonia)
 *   3. Horarios          (dias y horas de atencion)
 *   4. Documentos        (foto del local, comprobante de domicilio, INE del dueno, RFC opcional)
 *   5. Cuenta bancaria   (CLABE, banco)
 *   6. Resumen + enviar a revision
 *
 * Cada paso guarda al backend antes de avanzar para que no se pierda
 * el progreso si cierran la app.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { pedirImagen } from '../../utils/imagenes';
import * as Location from 'expo-location';
import { negocioOnboardingAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePlaza, plazaDePunto } from '../../context/PlazaContext';
import Boton from '../../components/Boton';
import Campo from '../../components/Campo';
import { colors, espacio, radio } from '../../theme/colors';

const TOTAL_PASOS = 6;

const CATEGORIAS = [
  { id: 'restaurante',         label: 'Restaurante',     icono: '🍽️' },
  { id: 'tienda_conveniencia', label: 'Tiendita',        icono: '🏪' },
  { id: 'farmacia',            label: 'Farmacia',        icono: '💊' },
  { id: 'panaderia',           label: 'Panaderia',       icono: '🥖' },
  { id: 'papeleria',           label: 'Papeleria',       icono: '📚' },
  { id: 'abarrotes',           label: 'Abarrotes',       icono: '🛒' },
  { id: 'distribuidora',       label: 'Distribuidora',   icono: '📦' },
  { id: 'otro',                label: 'Otro',            icono: '🏬' },
];

const DIAS = [
  { id: 'lun', label: 'Lunes' },
  { id: 'mar', label: 'Martes' },
  { id: 'mie', label: 'Miercoles' },
  { id: 'jue', label: 'Jueves' },
  { id: 'vie', label: 'Viernes' },
  { id: 'sab', label: 'Sabado' },
  { id: 'dom', label: 'Domingo' },
];

const BANCOS = ['BBVA', 'Banamex', 'Santander', 'Banorte', 'HSBC', 'Azteca', 'Mercado Pago', 'Otro'];

export default function OnboardingNegocioScreen({ navigation }) {
  const { cargarRoles } = useAuth();
  const [paso, setPaso]         = useState(1);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    telefono: '',
    direccion: '',
    colonia: '',
    latitud: null,
    longitud: null,
    horarios: {}, // { lun: {abre:'09:00', cierra:'21:00'}, ... }
    foto_portada: null,
    foto_local: null,
    comprobante_domicilio: null,
    documento_ine_dueno: null,
    documento_rfc: null,
    clabe_bancaria: '',
    banco: '',
  });

  // Activar modo negocio (idempotente) y precargar datos si ya hay fila
  useEffect(() => {
    (async () => {
      try {
        await negocioOnboardingAPI.activarModo();
        const { data } = await negocioOnboardingAPI.miNegocio();
        const n = data.data?.negocio;
        if (n) {
          setDatos((d) => ({
            ...d,
            nombre:               n.nombre               || '',
            categoria:            n.categoria            || '',
            descripcion:          n.descripcion          || '',
            telefono:             n.telefono             || '',
            direccion:            n.direccion            || '',
            colonia:              n.colonia              || '',
            latitud:              n.latitud              || null,
            longitud:             n.longitud             || null,
            horarios:             n.horarios             || {},
            foto_portada:          n.foto_portada,
            foto_local:           n.foto_local,
            comprobante_domicilio: n.comprobante_domicilio,
            documento_ine_dueno:  n.documento_ine_dueno,
            documento_rfc:        n.documento_rfc,
            clabe_bancaria:       n.clabe_bancaria       || '',
            banco:                n.banco                || '',
          }));
        }
      } catch (e) {
        Alert.alert('Error', e.mensajeAmigable || 'No pudimos abrir el formulario.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // ── Helpers ────────────────────────────────────────────
  const guardarParcial = async (campos) => {
    setGuardando(true);
    try {
      await negocioOnboardingAPI.actualizarPerfil(campos);
      return true;
    } catch (e) {
      Alert.alert('Error', e.mensajeAmigable || 'No pudimos guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const _subirDocConAsset = async (tipo, columnaLocal, asset) => {
    if (!asset?.base64) { Alert.alert('Error', 'No pudimos leer la foto.'); return; }
    setGuardando(true);
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const { data } = await negocioOnboardingAPI.subirDocumento(tipo, asset.base64, mime);
      setDatos((d) => ({ ...d, [columnaLocal]: data.data?.url }));
    } catch (e) {
      Alert.alert('Error al subir', e.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarYSubir = (tipo, columnaLocal) => {
    (async () => {
      const asset = await pedirImagen();
      if (asset) await _subirDocConAsset(tipo, columnaLocal, asset);
    })();
  };

  // ── Avanzar / retroceder ───────────────────────────────
  const irSiguiente = async () => {
    if (paso === 1) {
      if (!datos.nombre.trim()) return Alert.alert('Falta', 'Pon el nombre de tu negocio.');
      if (!datos.categoria)     return Alert.alert('Falta', 'Selecciona la categoria.');
      if (!datos.telefono.trim()) return Alert.alert('Falta', 'Pon el telefono del negocio.');
      const ok = await guardarParcial({
        nombre:      datos.nombre.trim(),
        categoria:   datos.categoria,
        descripcion: datos.descripcion,
        telefono:    datos.telefono,
      });
      if (!ok) return;
    }
    if (paso === 2) {
      if (!datos.direccion.trim()) return Alert.alert('Falta', 'Pon la direccion.');
      if (!datos.latitud || !datos.longitud) {
        return Alert.alert('Falta confirmar ubicación', 'Toca "Confirmar mi ubicación" parado en la puerta de tu negocio. Es obligatorio para que los repartidores puedan encontrarte.');
      }
      const ok = await guardarParcial({
        direccion: datos.direccion.trim(),
        colonia:   datos.colonia,
        latitud:   datos.latitud,
        longitud:  datos.longitud,
      });
      if (!ok) return;
    }
    if (paso === 3) {
      const diasAbiertos = Object.values(datos.horarios).filter(h => h?.abre && h?.cierra);
      if (diasAbiertos.length === 0) {
        return Alert.alert('Falta', 'Marca al menos un dia abierto.');
      }
      const ok = await guardarParcial({ horarios: datos.horarios });
      if (!ok) return;
    }
    if (paso === 4) {
      if (!datos.foto_portada) return Alert.alert('Faltan', 'Sube una foto de portada de tu negocio.');
      if (!datos.foto_local) return Alert.alert('Faltan', 'Sube una foto de tu local.');
      if (!datos.comprobante_domicilio) return Alert.alert('Faltan', 'Sube el comprobante de domicilio.');
      if (!datos.documento_ine_dueno) return Alert.alert('Faltan', 'Sube tu INE.');
    }
    if (paso === 5) {
      if (datos.clabe_bancaria.length !== 18) return Alert.alert('CLABE invalida', 'Debe tener 18 digitos.');
      if (!datos.banco) return Alert.alert('Falta', 'Selecciona tu banco.');
      const ok = await guardarParcial({
        clabe_bancaria: datos.clabe_bancaria,
        banco:          datos.banco,
      });
      if (!ok) return;
    }
    setPaso((p) => Math.min(p + 1, TOTAL_PASOS));
  };

  const irAtras = () => setPaso((p) => Math.max(p - 1, 1));

  // Si el backend rechaza el envío por un dato faltante, regresa al paso
  // donde vive ese dato en vez de dejar al usuario varado en el resumen
  // sin saber qué corregir ni dónde.
  const pasoDelCampoFaltante = (mensaje) => {
    const m = (mensaje || '').toLowerCase();
    if (m.includes('ubicación') || m.includes('gps') || m.includes('direccion')) return 2;
    if (m.includes('nombre') || m.includes('categoria') || m.includes('telefono')) return 1;
    if (m.includes('foto') || m.includes('comprobante') || m.includes('ine')) return 4;
    if (m.includes('clabe') || m.includes('banco')) return 5;
    return null;
  };

  const enviarSolicitud = async () => {
    setGuardando(true);
    try {
      const { data } = await negocioOnboardingAPI.enviarARevision();
      Alert.alert(
        '¡Listo! 🎉',
        data.mensaje || 'Tu negocio esta en revision. Te avisaremos en menos de 48 horas.',
        [{ text: 'Entendido', onPress: () => {
          cargarRoles();
          navigation.goBack();
        }}]
      );
    } catch (e) {
      const pasoProblema = pasoDelCampoFaltante(e.mensajeAmigable);
      Alert.alert(
        'No pudimos enviar',
        e.mensajeAmigable || 'Verifica que llenaste todo.',
        pasoProblema ? [{ text: 'Ir a corregir', onPress: () => setPaso(pasoProblema) }] : undefined
      );
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <BarraProgreso paso={paso} total={TOTAL_PASOS} />
        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="always"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={true}
        >
          {paso === 1 && <PasoBasico       datos={datos} setDatos={setDatos} />}
          {paso === 2 && <PasoDireccion    datos={datos} setDatos={setDatos} />}
          {paso === 3 && <PasoHorarios     datos={datos} setDatos={setDatos} />}
          {paso === 4 && <PasoDocumentos   datos={datos} seleccionar={seleccionarYSubir} />}
          {paso === 5 && <PasoBancario     datos={datos} setDatos={setDatos} />}
          {paso === 6 && <PasoResumen      datos={datos} />}
        </ScrollView>

        <View style={estilos.botones}>
          {paso > 1 && (
            <Boton
              titulo="Atras"
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
              titulo="Enviar a revision"
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

// ─── Componentes de cada paso ──────────────────────────────

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

function PasoBasico({ datos, setDatos }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  return (
    <View>
      <Text style={estilos.tituloPaso}>🏪 Tu negocio</Text>
      <Text style={estilos.subtitulo}>Cuentanos lo basico de tu tienda o restaurante.</Text>

      <Campo
        etiqueta="Nombre del negocio *"
        placeholder="Ej. Tacos Don Chendo"
        value={datos.nombre}
        onChangeText={set('nombre')}
      />
      <Text style={estilos.label}>Categoria *</Text>
      <View style={estilos.gridCategorias}>
        {CATEGORIAS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => set('categoria')(c.id)}
            style={[estilos.chipCategoria, datos.categoria === c.id && estilos.chipCategoriaActiva]}
          >
            <Text style={{ fontSize: 22 }}>{c.icono}</Text>
            <Text style={[estilos.chipCategoriaTxt, datos.categoria === c.id && { color: colors.primario }]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Campo
        etiqueta="Telefono del negocio *"
        placeholder="Ej. 9541234567"
        value={datos.telefono}
        onChangeText={(v) => set('telefono')(v.replace(/[^0-9]/g, ''))}
        keyboardType="phone-pad"
        maxLength={10}
      />
      <Campo
        etiqueta="Descripcion (opcional)"
        placeholder="Cuentale a tus clientes que vendes"
        value={datos.descripcion}
        onChangeText={set('descripcion')}
        multiline
      />
    </View>
  );
}

function PasoDireccion({ datos, setDatos }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  const [detectando, setDetectando] = useState(false);

  const confirmarUbicacion = async () => {
    setDetectando(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos tu ubicación para que los repartidores puedan encontrar tu negocio. Actívala en los ajustes del telefono.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDatos((d) => ({ ...d, latitud: loc.coords.latitude, longitud: loc.coords.longitude }));
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo?.[0] && !datos.direccion.trim()) {
        const g = geo[0];
        const partes = [g.street, g.streetNumber, g.district || g.subregion].filter(Boolean);
        if (partes.length > 0) set('direccion')(partes.join(' '));
      }
    } catch (e) {
      Alert.alert('No pudimos detectar tu ubicación', 'Verifica que el GPS esté activado e intenta de nuevo.');
    } finally {
      setDetectando(false);
    }
  };

  const ubicacionConfirmada = !!(datos.latitud && datos.longitud);

  // En qué plaza va a quedar el negocio. La decide el servidor a partir de
  // estas mismas coordenadas, así que se le dice AQUÍ: es la diferencia entre
  // enterarse ahora o hasta el final del wizard con un error rojo. Y si queda
  // fuera de toda plaza hay que decirlo claro — no hay servicio ahí.
  const { plazas, radioKm } = usePlaza();
  const destino = ubicacionConfirmada
    ? plazaDePunto(plazas, datos.latitud, datos.longitud, radioKm)
    : null;

  return (
    <View>
      <Text style={estilos.tituloPaso}>📍 Tu direccion</Text>
      <Text style={estilos.subtitulo}>
        Aqui es donde el repartidor va a recoger los pedidos.
      </Text>
      <Campo
        etiqueta="Direccion (calle y numero) *"
        placeholder="Ej. Av. Hidalgo #123"
        value={datos.direccion}
        onChangeText={set('direccion')}
      />
      <Campo
        etiqueta="Colonia / barrio"
        placeholder="Ej. Centro"
        value={datos.colonia}
        onChangeText={set('colonia')}
      />

      <Boton
        titulo={detectando ? 'Detectando...' : ubicacionConfirmada ? '📍 Ubicación confirmada — volver a detectar' : '📍 Confirmar mi ubicación (obligatorio)'}
        variante={ubicacionConfirmada ? 'secundario' : 'primario'}
        onPress={confirmarUbicacion}
        cargando={detectando}
        estilo={{ marginTop: espacio.md }}
      />

      {ubicacionConfirmada && destino?.plaza && !destino.dentro ? (
        <View style={[estilos.aviso, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[estilos.avisoTxt, { color: colors.error }]}>
            🚫 Sin cobertura en este lugar. La localidad más cercana donde operamos
            ({destino.plaza.nombre}) queda a unos {Math.round(destino.km)} km, y damos
            servicio hasta {radioKm} km. Todavía no podemos dar de alta tu negocio aquí.
          </Text>
        </View>
      ) : ubicacionConfirmada ? (
        <View style={[estilos.aviso, { backgroundColor: '#E8F8EE' }]}>
          <Text style={[estilos.avisoTxt, { color: colors.secundario }]}>
            ✅ Ubicación confirmada ({datos.latitud.toFixed(5)}, {datos.longitud.toFixed(5)}). Los repartidores podrán encontrarte con precisión.
            {destino?.plaza ? `\n\n🏘️ Tu negocio aparecerá en ${destino.plaza.nombre} (${destino.plaza.marca}). Solo lo verán —y le pedirán— los clientes de esa localidad.` : ''}
          </Text>
        </View>
      ) : (
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTxt}>
            ⚠️ Párate en la puerta de tu negocio y toca "Confirmar mi ubicación". Es obligatorio — sin esto no podremos aprobar tu negocio, porque los repartidores no sabrían a dónde ir.
          </Text>
        </View>
      )}
    </View>
  );
}

function PasoHorarios({ datos, setDatos }) {
  const setHora = (dia, campo, valor) => {
    setDatos((d) => ({
      ...d,
      horarios: {
        ...d.horarios,
        [dia]: { ...d.horarios[dia], [campo]: valor },
      },
    }));
  };
  const togglearDia = (dia) => {
    setDatos((d) => {
      const actual = d.horarios[dia];
      if (actual?.abre && actual?.cierra) {
        // estaba abierto → cerrar
        const { [dia]: _, ...resto } = d.horarios;
        return { ...d, horarios: resto };
      }
      // abrir con default
      return {
        ...d,
        horarios: { ...d.horarios, [dia]: { abre: '09:00', cierra: '21:00' } },
      };
    });
  };
  return (
    <View>
      <Text style={estilos.tituloPaso}>⏰ Horarios de atencion</Text>
      <Text style={estilos.subtitulo}>
        Marca los dias que abres. Despues podras editar los horarios desde el dashboard.
      </Text>

      {DIAS.map((d) => {
        const h = datos.horarios[d.id];
        const abierto = !!(h?.abre && h?.cierra);
        return (
          <View key={d.id} style={estilos.filaHorario}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.diaNombre}>{d.label}</Text>
              {abierto && (
                <Text style={estilos.diaHoras}>
                  {h.abre} – {h.cierra}
                </Text>
              )}
              {!abierto && <Text style={estilos.diaCerrado}>Cerrado</Text>}
            </View>
            <Switch
              value={abierto}
              onValueChange={() => togglearDia(d.id)}
              trackColor={{ false: '#CCC', true: colors.exito }}
              thumbColor="#FFF"
            />
          </View>
        );
      })}
    </View>
  );
}

function PasoDocumentos({ datos, seleccionar }) {
  const docs = [
    { tipo: 'foto_portada',          columna: 'foto_portada',          label: 'Foto de portada *', desc: 'Esta foto aparece en la app cuando los clientes buscan tu negocio. Que se vea bien.' },
    { tipo: 'foto_local',            columna: 'foto_local',            label: 'Foto del local *', desc: 'Frente o entrada de tu tienda.' },
    { tipo: 'comprobante_domicilio', columna: 'comprobante_domicilio', label: 'Comprobante de domicilio *', desc: 'Recibo de luz, agua o predial reciente.' },
    { tipo: 'documento_ine_dueno',   columna: 'documento_ine_dueno',   label: 'INE del dueno *', desc: 'Frente de la credencial.' },
    { tipo: 'documento_rfc',         columna: 'documento_rfc',         label: 'Constancia RFC (opcional)', desc: 'Si tienes RFC, ayuda a la facturacion.' },
  ];
  return (
    <View>
      <Text style={estilos.tituloPaso}>📄 Documentos</Text>
      <Text style={estilos.subtitulo}>Necesitamos verificar tu negocio antes de publicarlo.</Text>

      {docs.map((doc) => (
        <View key={doc.tipo} style={estilos.cuadroFoto}>
          <Text style={estilos.fotoLabel}>{doc.label}</Text>
          <Text style={estilos.fotoDesc}>{doc.desc}</Text>
          {datos[doc.columna] ? (
            <Image source={{ uri: datos[doc.columna] }} style={estilos.fotoPreview} />
          ) : (
            <View style={estilos.fotoPlaceholder}>
              <Text style={{ fontSize: 40 }}>📷</Text>
              <Text style={estilos.fotoPlaceholderTxt}>Sin foto</Text>
            </View>
          )}
          <Pressable style={[estilos.fotoBoton, { alignSelf: 'stretch' }]} onPress={() => seleccionar(doc.tipo, doc.columna)}>
            <Text style={estilos.fotoBotonTxt}>
              {datos[doc.columna] ? '🔄 Cambiar foto' : '📷 Subir foto'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function PasoBancario({ datos, setDatos }) {
  const set = (k) => (v) => setDatos((d) => ({ ...d, [k]: v }));
  return (
    <View>
      <Text style={estilos.tituloPaso}>💳 Cuenta bancaria</Text>
      <Text style={estilos.subtitulo}>
        Aqui te depositamos las ventas (descontando la comision) cada semana.
      </Text>
      <Campo
        etiqueta="CLABE interbancaria (18 digitos) *"
        placeholder="012345678901234567"
        value={datos.clabe_bancaria}
        onChangeText={(v) => set('clabe_bancaria')(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={18}
      />
      <Text style={[estilos.subtitulo, { marginTop: espacio.sm, marginBottom: espacio.sm }]}>
        Banco
      </Text>
      <View style={estilos.bancosFila}>
        {BANCOS.map((b) => (
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

function PasoResumen({ datos }) {
  const diasAbiertos = DIAS.filter((d) => datos.horarios[d.id]?.abre).length;
  return (
    <View>
      <Text style={estilos.tituloPaso}>✅ Revisa tu negocio</Text>
      <Text style={estilos.subtitulo}>
        Confirma que todo este correcto antes de enviar.
      </Text>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Datos basicos</Text>
        <Item label="Nombre"     valor={datos.nombre} />
        <Item label="Categoria"  valor={CATEGORIAS.find(c => c.id === datos.categoria)?.label || datos.categoria} />
        <Item label="Telefono"   valor={datos.telefono} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Direccion</Text>
        <Item label="Direccion" valor={datos.direccion} />
        <Item label="Colonia"   valor={datos.colonia} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Horarios</Text>
        <Item label="Dias abiertos" valor={`${diasAbiertos} dia(s) a la semana`} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Documentos</Text>
        <Item label="Foto de portada"        valor={datos.foto_portada ? '✅ Subida' : '❌ Falta'} />
        <Item label="Foto del local"         valor={datos.foto_local ? '✅ Subida' : '❌ Falta'} />
        <Item label="Comprobante domicilio"  valor={datos.comprobante_domicilio ? '✅ Subida' : '❌ Falta'} />
        <Item label="INE del dueno"          valor={datos.documento_ine_dueno ? '✅ Subida' : '❌ Falta'} />
        <Item label="RFC"                    valor={datos.documento_rfc ? '✅ Subida' : '— Opcional'} />
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.resumenSeccion}>Cuenta bancaria</Text>
        <Item label="Banco" valor={datos.banco} />
        <Item label="CLABE" valor={datos.clabe_bancaria ? `••••${datos.clabe_bancaria.slice(-4)}` : ''} />
      </View>

      <View style={estilos.aviso}>
        <Text style={estilos.avisoTxt}>
          🔒 Revisaremos tu negocio en menos de 48 horas. Te enviaremos
          una notificacion cuando este aprobado y puedas empezar a recibir pedidos.
        </Text>
      </View>
    </View>
  );
}

const Item = ({ label, valor }) => (
  <View style={estilos.itemFila}>
    <Text style={estilos.itemLabel}>{label}</Text>
    <Text style={estilos.itemValor}>{valor || '—'}</Text>
  </View>
);

// ─── Estilos ────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },
  scroll: { padding: espacio.lg, paddingBottom: 280 },

  barra: {
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.md, paddingBottom: espacio.sm,
    backgroundColor: colors.superficie,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  barraTxt: { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.xs, fontWeight: '600' },
  barraTrack: { height: 6, backgroundColor: colors.borde, borderRadius: radio.full },
  barraFill:  { height: 6, backgroundColor: colors.primario, borderRadius: radio.full },

  tituloPaso: { fontSize: 22, fontWeight: '800', color: colors.texto, marginBottom: espacio.xs },
  subtitulo:  { fontSize: 14, color: colors.textoSuave, marginBottom: espacio.lg, lineHeight: 20 },
  label:      { fontSize: 14, color: colors.texto, marginBottom: espacio.xs, fontWeight: '600' },

  // Categorias grid
  gridCategorias: {
    flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm,
    marginBottom: espacio.md,
  },
  chipCategoria: {
    width: '48%',
    backgroundColor: colors.superficie,
    paddingVertical: espacio.md,
    borderRadius: radio.md,
    alignItems: 'center',
    borderWidth: 2, borderColor: colors.borde,
  },
  chipCategoriaActiva: { borderColor: colors.primario, backgroundColor: '#FFF4EB' },
  chipCategoriaTxt: { fontSize: 13, fontWeight: '700', color: colors.texto, marginTop: 4 },

  // Horarios
  filaHorario: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.superficie,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.xs,
    borderWidth: 1, borderColor: colors.borde,
  },
  diaNombre: { fontSize: 15, fontWeight: '700', color: colors.texto },
  diaHoras:  { fontSize: 13, color: colors.exito, marginTop: 2, fontWeight: '600' },
  diaCerrado:{ fontSize: 13, color: colors.textoSuave, marginTop: 2 },

  // Fotos
  cuadroFoto: {
    backgroundColor: colors.superficie,
    padding: espacio.md, borderRadius: radio.md,
    marginBottom: espacio.md,
    borderWidth: 1, borderColor: colors.borde,
  },
  fotoLabel: { fontSize: 14, fontWeight: '700', color: colors.texto },
  fotoDesc:  { fontSize: 12, color: colors.textoSuave, marginBottom: espacio.sm, marginTop: 2 },
  fotoPreview: {
    width: '100%', height: 180, borderRadius: radio.sm,
    backgroundColor: colors.borde, marginBottom: espacio.sm,
  },
  fotoPlaceholder: {
    height: 140, backgroundColor: '#F3F4F6', borderRadius: radio.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: espacio.sm,
  },
  fotoPlaceholderTxt: { fontSize: 13, color: colors.textoSuave, marginTop: espacio.xs },
  fotoBotones: { flexDirection: 'row', gap: espacio.sm },
  fotoBoton: {
    flex: 1, paddingVertical: espacio.sm,
    backgroundColor: '#FFF4EB', borderRadius: radio.sm,
    alignItems: 'center',
  },
  fotoBotonTxt: { fontSize: 13, fontWeight: '600', color: colors.primario },

  // Bancos
  bancosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  bancoChip: {
    paddingHorizontal: espacio.md, paddingVertical: espacio.sm,
    borderRadius: radio.full,
    backgroundColor: colors.superficie,
    borderWidth: 1, borderColor: colors.borde,
  },
  bancoChipActivo: { backgroundColor: colors.primario, borderColor: colors.primario },
  bancoChipTxt: { fontSize: 13, fontWeight: '600', color: colors.texto },

  // Resumen
  tarjetaResumen: {
    backgroundColor: colors.superficie,
    padding: espacio.md, borderRadius: radio.md,
    marginBottom: espacio.md,
    borderWidth: 1, borderColor: colors.borde,
  },
  resumenSeccion: {
    fontSize: 14, fontWeight: '800', color: colors.primario,
    marginBottom: espacio.sm, textTransform: 'uppercase',
  },
  itemFila: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: espacio.xs,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  itemLabel: { fontSize: 13, color: colors.textoSuave },
  itemValor: { fontSize: 13, color: colors.texto, fontWeight: '600' },

  aviso: {
    backgroundColor: '#FEF3C7',
    padding: espacio.md, borderRadius: radio.md,
    marginTop: espacio.sm,
  },
  avisoTxt: { fontSize: 13, color: '#92400E', lineHeight: 19 },

  botones: {
    flexDirection: 'row',
    padding: espacio.md,
    backgroundColor: colors.superficie,
    borderTopWidth: 1, borderTopColor: colors.borde,
  },
});
