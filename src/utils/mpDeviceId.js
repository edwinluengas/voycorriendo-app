/**
 * Device ID de Mercado Pago (antifraude).
 *
 * MP exige una huella de dispositivo en cada llamada de tarjeta (tokenizar,
 * guardar, cobrar) para su motor de riesgo. Sin ella, TODA operación se
 * rechaza con PA_UNAUTHORIZED_RESULT_FROM_POLICIES — confirmado en
 * producción 2026-09-07, reproducido con dos tarjetas de países distintos
 * usando el mismo request "sin identificar".
 *
 * La huella se genera con el script oficial de MP (`security.js`), que
 * necesita correr en un navegador real. Como esta app no es web, se carga
 * en un WebView oculto apuntando a una página servida por NUESTRO backend
 * (`/mp-device-id.html`, ver server.js) — no como HTML inline, porque la
 * huella se asocia al origen que sirve el script.
 *
 * Se captura UNA VEZ por sesión de la app (montar <MPDeviceIdCollector />
 * cerca de la raíz, en App.js) y se reutiliza desde acá con
 * `obtenerDeviceId()`. Si nunca llega (sin red, WebView lento), resuelve
 * `null` a los 8s en vez de colgar el flujo de pago — la llamada a MP
 * simplemente sale sin el header, igual que antes de este fix.
 */
import React, { useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'https://voycorriendo-backend-production.up.railway.app';
const DEVICE_ID_URL = `${API_BASE}/mp-device-id.html`;
const TIMEOUT_MS = 8000;

let deviceIdCache = null;
let esperando = [];

const resolverEsperas = (id) => {
  deviceIdCache = id || deviceIdCache; // un timeout previo no debe pisar un id real que llegue después
  esperando.forEach((r) => r(id));
  esperando = [];
};

// Devuelve el device id ya capturado, o espera hasta TIMEOUT_MS a que el
// WebView lo entregue. Nunca rechaza — en el peor caso resuelve null.
export const obtenerDeviceId = () => {
  if (deviceIdCache) return Promise.resolve(deviceIdCache);
  return new Promise((resolve) => {
    esperando.push(resolve);
    setTimeout(() => resolve(null), TIMEOUT_MS);
  });
};

// Monta esto UNA VEZ cerca de la raíz de la app (App.js) — es invisible
// (0x0) y no participa del layout ni de la navegación.
export const MPDeviceIdCollector = () => {
  const yaCapturado = useRef(false);

  return (
    <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
      <WebView
        source={{ uri: DEVICE_ID_URL }}
        onMessage={(evento) => {
          if (yaCapturado.current) return;
          const id = evento.nativeEvent.data;
          if (id) {
            yaCapturado.current = true;
            resolverEsperas(id);
          }
        }}
        onError={() => resolverEsperas(null)}
        style={{ width: 1, height: 1 }}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
};
