import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, Alert, Modal,
  ActivityIndicator, StyleSheet, RefreshControl,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { adminAPI } from '../../api/client';
import { colors, espacio, radio } from '../../theme/colors';

const TABS_PRINCIPALES = [
  { key: 'pendientes', label: '⏳ Pendientes' },
  { key: 'revenue',    label: '📊 Revenue' },
  { key: 'usuarios',   label: '👥 Usuarios' },
];

const TABS_PENDIENTES = [
  { key: 'negocios',     label: '🏪 Negocios' },
  { key: 'repartidores', label: '🛵 Repartidores' },
];

const PERIODOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: '7 días' },
  { key: 'mes',    label: 'Mes' },
];

const fmt = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return null; }
};

const fmtMXN = (n) => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

// ─── Modal de rechazo ────────────────────────────────────────
function ModalRechazo({ visible, titulo, onCancelar, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);

  const confirmar = async () => {
    const texto = motivo.trim();
    if (texto.length < 5) {
      Alert.alert('Motivo requerido', 'Escribe al menos 5 caracteres explicando el rechazo.');
      return;
    }
    setCargando(true);
    try {
      await onConfirmar(texto);
      setMotivo('');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={estilos.modalOverlay}
      >
        <View style={estilos.modalBox}>
          <Text style={estilos.modalTitulo}>Rechazar</Text>
          <Text style={estilos.modalSub}>{titulo}</Text>
          <TextInput
            style={estilos.modalInput}
            placeholder="Motivo del rechazo (documentos incompletos, datos incorrectos...)"
            placeholderTextColor={colors.textoSuave}
            multiline
            numberOfLines={3}
            value={motivo}
            onChangeText={setMotivo}
            autoFocus
          />
          <View style={estilos.modalBotones}>
            <Pressable
              style={[estilos.modalBtn, estilos.modalBtnCancelar]}
              onPress={() => { setMotivo(''); onCancelar(); }}
              disabled={cargando}
            >
              <Text style={estilos.modalBtnCancelarTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[estilos.modalBtn, estilos.modalBtnRechazar, cargando && estilos.btnDis]}
              onPress={confirmar}
              disabled={cargando}
            >
              {cargando
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={estilos.modalBtnRechazarTxt}>Rechazar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Modal de documentos (foto/INE/licencia/etc) ─────────────
function FotoDoc({ label, url }) {
  if (!url) {
    return (
      <View style={estilos.docFalta}>
        <Text style={estilos.docFaltaTxt}>❌ {label} — no subida</Text>
      </View>
    );
  }
  return (
    <View style={estilos.docBox}>
      <Text style={estilos.docLabel}>{label}</Text>
      <Image source={{ uri: url }} style={estilos.docImagen} resizeMode="cover" />
    </View>
  );
}

function ModalDocumentos({ visible, cargando, tipo, data, onCerrar }) {
  const docs = data?.documentos_firmados || {};
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={estilos.docContenedor} edges={['top', 'bottom']}>
        <View style={estilos.docHeader}>
          <Text style={estilos.docTitulo}>
            {tipo === 'negocio' ? `🏪 ${data?.nombre || ''}` : `🛵 ${data?.usuario?.nombre || ''}`}
          </Text>
          <Pressable onPress={onCerrar}><Text style={estilos.docCerrar}>✕</Text></Pressable>
        </View>
        {cargando ? (
          <ActivityIndicator size="large" color={colors.primario} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: espacio.md }}>
            {tipo === 'repartidor' ? (
              <>
                <FotoDoc label="Selfie de perfil" url={data?.usuario?.foto_perfil} />
                <FotoDoc label="INE — frente" url={docs.ine_frente} />
                <FotoDoc label="INE — reverso" url={docs.ine_reverso} />
                <FotoDoc label="Licencia de conducir" url={docs.licencia} />
                <FotoDoc label="Tarjeta de circulación" url={docs.tarjeta_circulacion} />
              </>
            ) : (
              <>
                <FotoDoc label="Foto de portada" url={docs.foto_portada} />
                <FotoDoc label="Foto del local" url={docs.foto_local} />
                <FotoDoc label="Comprobante de domicilio" url={docs.comprobante_domicilio} />
                <FotoDoc label="INE del dueño" url={docs.documento_ine_dueno} />
                <FotoDoc label="RFC" url={docs.documento_rfc} />
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Pantalla principal ──────────────────────────────────────
export default function AprobacionesScreen() {
  const [tabMain, setTabMain]         = useState('pendientes');
  const [tabPend, setTabPend]         = useState('negocios');
  const [periodoRev, setPeriodoRev]   = useState('semana');
  const [dash, setDash]               = useState({});
  const [revenue, setRevenue]         = useState(null);
  const [usuarios, setUsuarios]       = useState([]);
  const [buscarUser, setBuscarUser]   = useState('');
  const [cargando, setCargando]       = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [accionando, setAccionando]   = useState(null);
  const [rechazo, setRechazo]         = useState(null); // { id, nombre, tipo }
  const [verDoc, setVerDoc]           = useState(null); // { tipo }
  const [docData, setDocData]        = useState(null);
  const [cargandoDoc, setCargandoDoc] = useState(false);
  const buscarTimer                   = useRef(null);

  const abrirDocumentos = async (tipo, id) => {
    setVerDoc({ tipo });
    setDocData(null);
    setCargandoDoc(true);
    try {
      const { data } = tipo === 'negocio'
        ? await adminAPI.obtenerNegocio(id)
        : await adminAPI.obtenerRepartidor(id);
      setDocData(data.data?.negocio || data.data?.repartidor || null);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudieron cargar los documentos.');
      setVerDoc(null);
    } finally {
      setCargandoDoc(false);
    }
  };

  const cargarDash = useCallback(async () => {
    const { data } = await adminAPI.dashboard();
    setDash(data.data || data || {});
  }, []);

  const cargarRevenue = useCallback(async (periodo) => {
    const p = periodo || periodoRev;
    const { data } = await adminAPI.revenue(p);
    setRevenue(data.data || null);
  }, [periodoRev]);

  const cargarUsuarios = useCallback(async (buscar) => {
    const { data } = await adminAPI.usuarios(buscar);
    setUsuarios(data.data?.usuarios || []);
  }, []);

  const cargar = useCallback(async () => {
    try {
      await cargarDash();
      if (tabMain === 'revenue') await cargarRevenue();
      if (tabMain === 'usuarios') await cargarUsuarios(buscarUser);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'No se pudo cargar el panel.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [tabMain, cargarDash, cargarRevenue, cargarUsuarios, buscarUser]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Cuando cambia de tab, carga datos del nuevo tab
  const cambiarTab = async (key) => {
    setTabMain(key);
    if (key === 'revenue' && !revenue) {
      try { await cargarRevenue(); } catch (_) {}
    }
    if (key === 'usuarios' && usuarios.length === 0) {
      try { await cargarUsuarios(''); } catch (_) {}
    }
  };

  // Revenue: cambia período
  const cambiarPeriodo = async (p) => {
    setPeriodoRev(p);
    try { await cargarRevenue(p); } catch (_) {}
  };

  // Búsqueda de usuarios con debounce
  const buscarUsuarios = (txt) => {
    setBuscarUser(txt);
    clearTimeout(buscarTimer.current);
    buscarTimer.current = setTimeout(() => cargarUsuarios(txt), 400);
  };

  const negsP = (dash.negocios_pendientes || []);
  const repsP = (dash.repartidores_pendientes || []);
  const negStats  = dash.negocios    || {};
  const repStats  = dash.repartidores || {};

  // ── Aprobar negocio ─────────────────────────────────────────
  const aprobarNeg = (id, nombre) => {
    Alert.alert('Aprobar negocio', `¿Aprobar "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar ✅', onPress: async () => {
        setAccionando(id);
        try { await adminAPI.aprobarNegocio(id); await cargarDash(); }
        catch (e) { Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.'); }
        finally { setAccionando(null); }
      }},
    ]);
  };

  // ── Rechazar negocio ────────────────────────────────────────
  const rechazarNegConMotivo = async (motivo) => {
    setAccionando(rechazo.id);
    try {
      await adminAPI.rechazarNegocio(rechazo.id, motivo);
      await cargarDash();
      setRechazo(null);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setAccionando(null);
    }
  };

  // ── Aprobar repartidor ──────────────────────────────────────
  const aprobarRep = (id, nombre) => {
    Alert.alert('Aprobar repartidor', `¿Aprobar a "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar ✅', onPress: async () => {
        setAccionando(id);
        try { await adminAPI.aprobarRepartidor(id); await cargarDash(); }
        catch (e) { Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.'); }
        finally { setAccionando(null); }
      }},
    ]);
  };

  // ── Rechazar repartidor ─────────────────────────────────────
  const rechazarRepConMotivo = async (motivo) => {
    setAccionando(rechazo.id);
    try {
      await adminAPI.rechazarRepartidor(rechazo.id, motivo);
      await cargarDash();
      setRechazo(null);
    } catch (e) {
      Alert.alert('Error', e?.mensajeAmigable || 'Intenta de nuevo.');
    } finally {
      setAccionando(null);
    }
  };

  if (cargando) {
    return <ActivityIndicator size="large" color={colors.primario} style={{ flex: 1 }} />;
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['bottom']}>

      {/* Stats bar siempre visible */}
      <View style={estilos.statsBar}>
        <Stat label="Pedidos hoy"  valor={dash.pedidosHoy ?? '—'} />
        <View style={estilos.div} />
        <Stat label="Abiertos"     valor={negStats.abiertos ?? '—'} />
        <View style={estilos.div} />
        <Stat label="En ruta"      valor={repStats.conectados ?? '—'} />
        <View style={estilos.div} />
        <Stat label="Usuarios"     valor={dash.totalUsuarios ?? '—'} />
      </View>

      {/* Tabs principales */}
      <View style={estilos.tabs}>
        {TABS_PRINCIPALES.map((t) => {
          const badge =
            t.key === 'pendientes' ? (negsP.length + repsP.length) : 0;
          return (
            <Pressable
              key={t.key}
              style={[estilos.tab, tabMain === t.key && estilos.tabActiva]}
              onPress={() => cambiarTab(t.key)}
            >
              <Text style={[estilos.tabTxt, tabMain === t.key && estilos.tabTxtActiva]}>
                {t.label}
              </Text>
              {badge > 0 && (
                <View style={estilos.badge}><Text style={estilos.badgeTxt}>{badge}</Text></View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Tab: Pendientes ──────────────────────────────────── */}
      {tabMain === 'pendientes' && (
        <>
          <View style={estilos.subTabs}>
            {TABS_PENDIENTES.map((t) => {
              const n = t.key === 'negocios' ? negsP.length : repsP.length;
              return (
                <Pressable
                  key={t.key}
                  style={[estilos.subTab, tabPend === t.key && estilos.subTabActiva]}
                  onPress={() => setTabPend(t.key)}
                >
                  <Text style={[estilos.subTabTxt, tabPend === t.key && estilos.subTabTxtActiva]}>
                    {t.label} {n > 0 ? `(${n})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FlatList
            data={tabPend === 'negocios' ? negsP : repsP}
            keyExtractor={(it) => it.id}
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} />
            }
            contentContainerStyle={
              (tabPend === 'negocios' ? negsP : repsP).length === 0
                ? { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl }
                : { padding: espacio.md, paddingBottom: espacio.xl }
            }
            ListEmptyComponent={
              <>
                <Text style={{ fontSize: 56, textAlign: 'center' }}>✅</Text>
                <Text style={estilos.vacioTxt}>
                  No hay {tabPend === 'negocios' ? 'negocios' : 'repartidores'} pendientes
                </Text>
              </>
            }
            renderItem={({ item }) =>
              tabPend === 'negocios' ? (
                <TarjetaNegocio
                  negocio={item}
                  enProceso={accionando === item.id}
                  onVerDocumentos={() => abrirDocumentos('negocio', item.id)}
                  onAprobar={() => aprobarNeg(item.id, item.nombre)}
                  onRechazar={() => setRechazo({ id: item.id, nombre: item.nombre, tipo: 'negocio' })}
                />
              ) : (
                <TarjetaRepartidor
                  repartidor={item}
                  enProceso={accionando === item.id}
                  onVerDocumentos={() => abrirDocumentos('repartidor', item.id)}
                  onAprobar={() => aprobarRep(item.id, item.usuario?.nombre || 'Sin nombre')}
                  onRechazar={() => setRechazo({ id: item.id, nombre: item.usuario?.nombre || 'Sin nombre', tipo: 'repartidor' })}
                />
              )
            }
          />
        </>
      )}

      {/* ── Tab: Revenue ─────────────────────────────────────── */}
      {tabMain === 'revenue' && (
        <ScrollView
          contentContainerStyle={{ padding: espacio.md, paddingBottom: espacio.xl }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} />
          }
        >
          {/* Selector de período */}
          <View style={estilos.periodoRow}>
            {PERIODOS.map((p) => (
              <Pressable
                key={p.key}
                style={[estilos.periodoBtn, periodoRev === p.key && estilos.periodoBtnActivo]}
                onPress={() => cambiarPeriodo(p.key)}
              >
                <Text style={[estilos.periodoBtnTxt, periodoRev === p.key && estilos.periodoBtnTxtActivo]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {!revenue ? (
            <ActivityIndicator color={colors.primario} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Tarjetas de totales */}
              <View style={estilos.revenueGrid}>
                <RevCard titulo="Pedidos" valor={revenue.totales.entregas} unidad="" color="#3B82F6" />
                <RevCard titulo="GMV" valor={fmtMXN(revenue.por_tipo_envio.reduce((s, t) => s + t.gmv, 0))} unidad="" color="#8B5CF6" />
              </View>
              <View style={estilos.revenueGrid}>
                <RevCard titulo="Fees cobrados" valor={fmtMXN(revenue.totales.fees_cliente)} unidad="" color={colors.primario} />
                <RevCard titulo="Pagos repartidores" valor={fmtMXN(revenue.totales.pagos_repartidores)} unidad="" color="#EF4444" />
              </View>
              <View style={[estilos.revenueGrid]}>
                <RevCard titulo="Neto plataforma" valor={fmtMXN(revenue.totales.neto)} unidad="" color="#10B981" grande />
              </View>

              {/* Por tipo de envío */}
              {revenue.por_tipo_envio.length > 0 && (
                <>
                  <Text style={estilos.seccionTxt}>Por tipo de envío</Text>
                  {revenue.por_tipo_envio.map((t) => (
                    <View key={t.tipo} style={estilos.rowItem}>
                      <Text style={estilos.rowItemLabel}>
                        {t.tipo === 'express' ? '⚡ Express' : '📦 Standard'}
                      </Text>
                      <Text style={estilos.rowItemVal}>{t.total} pedidos · {fmtMXN(t.gmv)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Por día */}
              {revenue.por_dia.length > 0 && (
                <>
                  <Text style={estilos.seccionTxt}>Por día</Text>
                  {revenue.por_dia.slice().reverse().map((d) => (
                    <View key={d.fecha} style={estilos.rowItem}>
                      <Text style={estilos.rowItemLabel}>{d.fecha}</Text>
                      <Text style={estilos.rowItemVal}>{d.entregas} entregas · {fmtMXN(d.neto)}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Tab: Usuarios ────────────────────────────────────── */}
      {tabMain === 'usuarios' && (
        <>
          <View style={estilos.buscadorBox}>
            <TextInput
              style={estilos.buscador}
              placeholder="Buscar por nombre, teléfono o email..."
              placeholderTextColor={colors.textoSuave}
              value={buscarUser}
              onChangeText={buscarUsuarios}
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={usuarios}
            keyExtractor={(u) => u.id}
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} />
            }
            contentContainerStyle={
              usuarios.length === 0
                ? { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl }
                : { padding: espacio.md, paddingBottom: espacio.xl }
            }
            ListEmptyComponent={
              <Text style={estilos.vacioTxt}>No se encontraron usuarios</Text>
            }
            renderItem={({ item: u }) => (
              <View style={estilos.userRow}>
                <View style={estilos.userAvatar}>
                  <Text style={estilos.userAvatarTxt}>
                    {(u.nombre || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.userNombre}>{u.nombre} {u.apellido || ''}</Text>
                  <Text style={estilos.userSub}>📱 {u.telefono}</Text>
                  {u.email && <Text style={estilos.userSub}>✉️ {u.email}</Text>}
                </View>
                <View>
                  <RolPill rol={u.rol} />
                  <Text style={estilos.userFecha}>{fmt(u.creado_en)}</Text>
                </View>
              </View>
            )}
          />
        </>
      )}

      {/* Modal de rechazo */}
      <ModalRechazo
        visible={!!rechazo}
        titulo={rechazo ? `${rechazo.tipo === 'negocio' ? '🏪' : '🛵'} ${rechazo.nombre}` : ''}
        onCancelar={() => setRechazo(null)}
        onConfirmar={rechazo?.tipo === 'negocio' ? rechazarNegConMotivo : rechazarRepConMotivo}
      />

      {/* Modal de documentos */}
      <ModalDocumentos
        visible={!!verDoc}
        cargando={cargandoDoc}
        tipo={verDoc?.tipo}
        data={docData}
        onCerrar={() => { setVerDoc(null); setDocData(null); }}
      />
    </SafeAreaView>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────

function Stat({ label, valor, resaltado }) {
  return (
    <View style={estilos.stat}>
      <Text style={[estilos.statVal, resaltado && estilos.statValAlert]}>{valor}</Text>
      <Text style={estilos.statLbl}>{label}</Text>
    </View>
  );
}

function RevCard({ titulo, valor, color, grande }) {
  return (
    <View style={[estilos.revCard, grande && estilos.revCardGrande, { borderLeftColor: color }]}>
      <Text style={estilos.revCardTitulo}>{titulo}</Text>
      <Text style={[estilos.revCardValor, { color }]}>{valor}</Text>
    </View>
  );
}

function RolPill({ rol }) {
  const cfg = {
    admin:      { color: '#7C3AED', label: 'Admin' },
    negocio:    { color: colors.primario, label: 'Negocio' },
    repartidor: { color: '#0891B2', label: 'Repartidor' },
    cliente:    { color: colors.textoSuave, label: 'Cliente' },
  }[rol] || { color: colors.textoSuave, label: rol };

  return (
    <View style={[estilos.rolPill, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
      <Text style={[estilos.rolPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    pendiente:   { color: colors.advertencia, txt: 'Pendiente' },
    en_revision: { color: '#0891B2',          txt: 'En revisión' },
    rechazado:   { color: colors.error,       txt: 'Rechazado' },
  }[estado] || { color: colors.textoSuave, txt: estado };

  return (
    <View style={[estilos.pill, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
      <Text style={[estilos.pillTxt, { color: cfg.color }]}>{cfg.txt}</Text>
    </View>
  );
}

function TarjetaNegocio({ negocio, enProceso, onVerDocumentos, onAprobar, onRechazar }) {
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabFila}>
        <Text style={estilos.nombre} numberOfLines={1}>🏪 {negocio.nombre}</Text>
        <EstadoBadge estado={negocio.verificacion_estado} />
      </View>
      <Text style={estilos.sub}>{negocio.categoria}  ·  📞 {negocio.telefono || 'Sin tel'}</Text>
      {negocio.dueno?.nombre && <Text style={estilos.sub}>👤 {negocio.dueno.nombre}</Text>}
      {negocio.dueno?.email  && <Text style={estilos.sub}>✉️ {negocio.dueno.email}</Text>}
      {negocio.direccion     && <Text style={estilos.sub}>📍 {negocio.direccion}</Text>}
      {negocio.enviado_revision_en && (
        <Text style={estilos.ts}>📤 {fmt(negocio.enviado_revision_en)}</Text>
      )}
      {negocio.verificacion_nota && (
        <Text style={estilos.nota}>📝 {negocio.verificacion_nota}</Text>
      )}
      <Pressable style={estilos.btnVerDocs} onPress={onVerDocumentos}>
        <Text style={estilos.btnVerDocsTxt}>📄 Ver documentos</Text>
      </Pressable>
      <View style={estilos.botonesRow}>
        <Pressable
          style={[estilos.btnRechazar, enProceso && estilos.btnDis]}
          onPress={onRechazar}
          disabled={enProceso}
        >
          <Text style={estilos.btnRechazarTxt}>✕ Rechazar</Text>
        </Pressable>
        <Pressable
          style={[estilos.btnAprobar, enProceso && estilos.btnDis]}
          onPress={onAprobar}
          disabled={enProceso}
        >
          {enProceso
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={estilos.btnAprobarTxt}>✅ Aprobar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function TarjetaRepartidor({ repartidor, enProceso, onVerDocumentos, onAprobar, onRechazar }) {
  const nombre = repartidor.usuario?.nombre || 'Sin nombre';
  const tel    = repartidor.usuario?.telefono || '';
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.encabFila}>
        <Text style={estilos.nombre} numberOfLines={1}>🛵 {nombre}</Text>
        <EstadoBadge estado={repartidor.verificacion_estado} />
      </View>
      {tel                         && <Text style={estilos.sub}>📞 {tel}</Text>}
      {repartidor.tipo_vehiculo    && <Text style={estilos.sub}>🏍️ {repartidor.tipo_vehiculo}</Text>}
      {repartidor.placa_vehiculo   && <Text style={estilos.sub}>🪪 Placa: {repartidor.placa_vehiculo}</Text>}
      {repartidor.marca_vehiculo   && <Text style={estilos.sub}>🚗 {repartidor.marca_vehiculo} {repartidor.color_vehiculo}</Text>}
      {repartidor.enviado_revision_en && (
        <Text style={estilos.ts}>📤 {fmt(repartidor.enviado_revision_en)}</Text>
      )}
      {repartidor.verificacion_nota && (
        <Text style={estilos.nota}>📝 {repartidor.verificacion_nota}</Text>
      )}
      <Pressable style={estilos.btnVerDocs} onPress={onVerDocumentos}>
        <Text style={estilos.btnVerDocsTxt}>📄 Ver documentos</Text>
      </Pressable>
      <View style={estilos.botonesRow}>
        <Pressable
          style={[estilos.btnRechazar, enProceso && estilos.btnDis]}
          onPress={onRechazar}
          disabled={enProceso}
        >
          <Text style={estilos.btnRechazarTxt}>✕ Rechazar</Text>
        </Pressable>
        <Pressable
          style={[estilos.btnAprobar, enProceso && estilos.btnDis]}
          onPress={onAprobar}
          disabled={enProceso}
        >
          {enProceso
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={estilos.btnAprobarTxt}>✅ Aprobar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.fondo },

  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primario, paddingVertical: espacio.sm, paddingHorizontal: espacio.md,
  },
  stat:         { flex: 1, alignItems: 'center' },
  statVal:      { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statValAlert: { color: '#FFD700' },
  statLbl:      { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  div:          { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Tabs principales
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.superficie,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: espacio.sm, gap: 4,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActiva:    { borderBottomColor: colors.primario },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: colors.textoSuave },
  tabTxtActiva: { color: colors.primario, fontWeight: '800' },
  badge: {
    backgroundColor: colors.primario, borderRadius: radio.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  badgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // Sub-tabs (dentro de Pendientes)
  subTabs: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  subTab: {
    flex: 1, paddingVertical: espacio.xs + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabActiva:    { borderBottomColor: colors.secundario },
  subTabTxt:       { fontSize: 13, fontWeight: '600', color: colors.textoSuave },
  subTabTxtActiva: { color: colors.secundario, fontWeight: '800' },

  // Tarjetas
  tarjeta: {
    backgroundColor: colors.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.sm,
    borderLeftWidth: 4, borderLeftColor: colors.advertencia,
  },
  encabFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.xs },
  nombre:    { fontSize: 16, fontWeight: '800', color: colors.texto, flex: 1, marginRight: espacio.sm },
  sub:       { fontSize: 13, color: colors.textoSuave, marginTop: 2 },
  ts:        { fontSize: 12, color: colors.textoSuave, marginTop: espacio.xs },
  nota:      { fontSize: 12, color: colors.advertencia, marginTop: espacio.xs, fontStyle: 'italic' },

  pill: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radio.full, borderWidth: 1,
  },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  btnVerDocs: {
    marginTop: espacio.sm, paddingVertical: 8, borderRadius: radio.sm,
    borderWidth: 1.5, borderColor: colors.primario, alignItems: 'center',
  },
  btnVerDocsTxt: { color: colors.primario, fontWeight: '700', fontSize: 13 },

  botonesRow: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.md },
  btnRechazar: {
    flex: 1, paddingVertical: 10, borderRadius: radio.sm,
    borderWidth: 1.5, borderColor: colors.error, alignItems: 'center',
  },
  btnRechazarTxt: { color: colors.error, fontWeight: '700', fontSize: 14 },
  btnAprobar: {
    flex: 2, paddingVertical: 10, borderRadius: radio.sm,
    backgroundColor: '#10B981', alignItems: 'center',
  },
  btnAprobarTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  btnDis: { opacity: 0.5 },

  vacioTxt: {
    fontSize: 16, color: colors.textoSuave,
    marginTop: espacio.md, textAlign: 'center',
  },

  // Revenue
  periodoRow: {
    flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.md,
  },
  periodoBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radio.md,
    backgroundColor: colors.superficie, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.borde,
  },
  periodoBtnActivo:    { borderColor: colors.primario, backgroundColor: colors.primario + '15' },
  periodoBtnTxt:       { fontSize: 14, fontWeight: '600', color: colors.textoSuave },
  periodoBtnTxtActivo: { color: colors.primario, fontWeight: '800' },

  revenueGrid: { flexDirection: 'row', gap: espacio.sm, marginBottom: espacio.sm },
  revCard: {
    flex: 1, backgroundColor: colors.superficie,
    borderRadius: radio.md, padding: espacio.md,
    borderLeftWidth: 4,
  },
  revCardGrande: { flex: 1 },
  revCardTitulo: { fontSize: 11, color: colors.textoSuave, fontWeight: '600', marginBottom: 4 },
  revCardValor:  { fontSize: 22, fontWeight: '800' },

  seccionTxt: {
    fontSize: 13, fontWeight: '800', color: colors.textoSuave,
    marginTop: espacio.md, marginBottom: espacio.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rowItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.superficie, borderRadius: radio.sm,
    paddingVertical: 10, paddingHorizontal: espacio.md, marginBottom: 4,
  },
  rowItemLabel: { fontSize: 14, color: colors.texto, fontWeight: '600' },
  rowItemVal:   { fontSize: 13, color: colors.textoSuave },

  // Usuarios
  buscadorBox: {
    padding: espacio.md, paddingBottom: 0,
    backgroundColor: colors.superficie, borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  buscador: {
    backgroundColor: colors.fondo, borderRadius: radio.md,
    paddingHorizontal: espacio.md, paddingVertical: 10,
    fontSize: 14, color: colors.texto,
    borderWidth: 1, borderColor: colors.borde,
    marginBottom: espacio.sm,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    backgroundColor: colors.superficie, borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.xs,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primario,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarTxt: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  userNombre:    { fontSize: 15, fontWeight: '700', color: colors.texto },
  userSub:       { fontSize: 12, color: colors.textoSuave, marginTop: 1 },
  userFecha:     { fontSize: 11, color: colors.textoSuave, marginTop: 4, textAlign: 'right' },

  rolPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radio.full, borderWidth: 1, alignSelf: 'flex-end',
  },
  rolPillTxt: { fontSize: 10, fontWeight: '700' },

  // Modal de rechazo
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: espacio.xl,
  },
  modalBox: {
    backgroundColor: colors.superficie,
    borderRadius: radio.lg, padding: espacio.lg, width: '100%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: colors.texto, marginBottom: 4 },
  modalSub:    { fontSize: 13, color: colors.textoSuave, marginBottom: espacio.md },
  modalInput:  {
    backgroundColor: colors.fondo, borderRadius: radio.sm,
    borderWidth: 1, borderColor: colors.borde,
    padding: espacio.md, fontSize: 14, color: colors.texto,
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: espacio.md,
  },
  modalBotones:       { flexDirection: 'row', gap: espacio.sm },
  modalBtn:           { flex: 1, paddingVertical: 12, borderRadius: radio.md, alignItems: 'center' },
  modalBtnCancelar:   { borderWidth: 1.5, borderColor: colors.borde },
  modalBtnRechazar:   { backgroundColor: colors.error },
  modalBtnCancelarTxt: { fontSize: 15, fontWeight: '700', color: colors.textoSuave },
  modalBtnRechazarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Modal de documentos
  docContenedor: { flex: 1, backgroundColor: colors.fondo },
  docHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: espacio.md, backgroundColor: colors.superficie,
    borderBottomWidth: 1, borderBottomColor: colors.borde,
  },
  docTitulo: { fontSize: 17, fontWeight: '800', color: colors.texto },
  docCerrar: { fontSize: 22, color: colors.textoSuave, paddingHorizontal: espacio.sm },
  docBox: { marginBottom: espacio.lg },
  docLabel: { fontSize: 14, fontWeight: '700', color: colors.texto, marginBottom: espacio.xs },
  docImagen: {
    width: '100%', height: 220, borderRadius: radio.md,
    backgroundColor: colors.borde,
  },
  docFalta: {
    backgroundColor: '#FEF2F2', borderRadius: radio.md, padding: espacio.md,
    marginBottom: espacio.lg, borderWidth: 1, borderColor: '#FCA5A5',
  },
  docFaltaTxt: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
});
