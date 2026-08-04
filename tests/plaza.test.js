/**
 * Pruebas de la detección de localidad. Se corre con:
 *   node tests/plaza.test.js
 * (la app no tiene jest; se transpila con babel-preset-expo y se ejecuta,
 * mismo patrón que tests/throttleRuta.test.js)
 *
 * Blindan el bug real del 2026-08-03: estando EN Santa María Zacatepec la
 * app decía "sin cobertura". La causa no fueron las coordenadas —están a
 * 2 km de las reales— sino que pedir el permiso manda la app a segundo
 * plano, al volver se disparaba una segunda detección encima de la primera,
 * y Android rechaza una petición de permiso con otra en curso.
 */
const path = require('path');
const babel = require('@babel/core');
const fs = require('fs');
const Module = require('module');

// ── Stubs mínimos de React Native / Expo para poder importar el contexto ──
const stubs = {
  'react-native': {
    AppState: { addEventListener: () => ({ remove() {} }) },
    Linking: { openSettings: () => Promise.resolve() },
    Platform: { OS: 'android' },
  },
  'expo-location': { Accuracy: { Balanced: 3, Lowest: 1 } },
  '../api/client': { pedidosAPI: { configPublica: async () => ({ data: { data: {} } }) } },
  react: require('react'),
};

const cargar = (rel) => {
  const archivo = path.resolve(__dirname, '..', rel);
  const { code } = babel.transformFileSync(archivo, { presets: ['babel-preset-expo'] });
  const m = new Module(archivo, null);
  m.filename = archivo;
  m.paths = Module._nodeModulePaths(path.dirname(archivo));
  const requireOriginal = m.require.bind(m);
  m.require = (id) => (id in stubs ? stubs[id] : requireOriginal(id));
  m._compile(code, archivo);
  return m.exports;
};

const { plazaDePunto, PLAZA_ESTADO } = cargar('src/context/PlazaContext.js');

// Las cuatro localidades, tal como las publica /api/config-publica.
const PLAZAS = [
  { slug: 'puerto_escondido', nombre: 'Puerto Escondido',           marca: 'VoyCorriendo',            latitud: 15.8631, longitud: -97.0676 },
  { slug: 'putla',            nombre: 'Putla Villa de Guerrero',    marca: 'VoyCorriendo Putla',      latitud: 17.0247, longitud: -97.9281 },
  { slug: 'zacatepec',        nombre: 'Santa María Zacatepec',      marca: 'VoyCorriendo Zacatepec',  latitud: 16.7833, longitud: -97.9833 },
  { slug: 'pinotepa',         nombre: 'Santiago Pinotepa Nacional', marca: 'VoyCorriendo Pinotepa',   latitud: 16.3417, longitud: -98.0533 },
];

let fallos = 0;
const test = (nombre, fn) => {
  try { fn(); console.log(`  ✅ ${nombre}`); }
  catch (e) { fallos++; console.log(`  🚨 ${nombre}\n      ${e.message}`); }
};
const igual = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, llegó ${JSON.stringify(a)}`);
};
const cierto = (v, msg) => { if (!v) throw new Error(msg || 'esperaba verdadero'); };

console.log('\n── Detección de localidad ──');

test('el centro de Santa María Zacatepec cae en zacatepec', () => {
  const r = plazaDePunto(PLAZAS, 16.7833, -97.9833, 25);
  igual(r.plaza.slug, 'zacatepec');
  cierto(r.dentro, 'debería tener cobertura');
});

test('las coordenadas REALES del pueblo (INEGI 16°45\'50"N 97°59\'24"W) también', () => {
  // 16.7639 / -97.99 — a ~2 km del punto de referencia que usa el sistema.
  const r = plazaDePunto(PLAZAS, 16.7639, -97.99, 25);
  igual(r.plaza.slug, 'zacatepec');
  cierto(r.dentro, 'debería tener cobertura');
  cierto(r.km < 3, `debería estar a menos de 3 km, está a ${r.km}`);
});

test('los alrededores de Zacatepec siguen siendo Zacatepec, no Putla', () => {
  // Putla está a ~28 km al norte: el punto medio no debe "saltar" de plaza
  // antes de tiempo.
  for (const [lat, lng] of [[16.83, -97.95], [16.72, -98.03], [16.90, -97.96]]) {
    const r = plazaDePunto(PLAZAS, lat, lng, 25);
    igual(r.plaza.slug, 'zacatepec', `${lat},${lng}:`);
    cierto(r.dentro, `${lat},${lng} debería tener cobertura`);
  }
});

test('cada localidad se reconoce a sí misma', () => {
  for (const p of PLAZAS) {
    const r = plazaDePunto(PLAZAS, p.latitud, p.longitud, 25);
    igual(r.plaza.slug, p.slug);
    cierto(r.dentro);
  }
});

test('lejos de todas NO hay cobertura', () => {
  for (const [lat, lng] of [[17.0732, -96.7266], [19.4326, -99.1332]]) {
    cierto(!plazaDePunto(PLAZAS, lat, lng, 25).dentro, `${lat},${lng} no debería tener cobertura`);
  }
});

test('sin coordenadas no se inventa una localidad', () => {
  for (const [lat, lng] of [[null, null], [undefined, undefined], ['', ''], ['x', 'y'], [NaN, NaN]]) {
    const r = plazaDePunto(PLAZAS, lat, lng, 25);
    igual(r.plaza, null);
    cierto(!r.dentro);
  }
});

test('los estados de "sin ubicación" están todos declarados y son distintos', () => {
  const claves = ['BUSCANDO', 'DENTRO', 'FUERA', 'SIN_PERMISO', 'PERMISO_BLOQUEADO',
                  'UBICACION_APAGADA', 'SIN_GPS', 'SIN_RED'];
  for (const k of claves) cierto(PLAZA_ESTADO[k], `falta PLAZA_ESTADO.${k}`);
  const valores = claves.map((k) => PLAZA_ESTADO[k]);
  igual(new Set(valores).size, valores.length, 'hay estados repetidos:');
});

console.log(fallos === 0 ? '\n✅ Todo en orden\n' : `\n🚨 ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
