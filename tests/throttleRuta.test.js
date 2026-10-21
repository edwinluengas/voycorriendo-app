/**
 * Test del freno de llamadas a la ruta (useRutaPedido).
 *
 * Corre sin jest: `node tests/throttleRuta.test.js`. La app no tiene runner
 * configurado, así que se transpila el módulo real con babel-preset-expo y
 * se ejecuta — se prueba el CÓDIGO DE PRODUCCIÓN, no una copia.
 *
 * Qué blinda: cada llamada a la ruta es una llamada FACTURABLE a Google.
 * El bug original hacía que el guard nunca aplicara (exigía tener ya una
 * polyline, y con Google apagado la respuesta era siempre null), así que
 * el GPS del repartidor —que late cada 15 s— disparaba una llamada cada
 * vez, por cada una de las 3 pantallas que montan el mapa.
 */
const babel = require('@babel/core');
const path = require('path');
const Module = require('module');

// ─── Cargar el módulo real, aislando sus imports de React/red ────────
const cargarHook = () => {
  const archivo = path.join(__dirname, '..', 'src', 'hooks', 'useRutaPedido.js');
  const { code } = babel.transformFileSync(archivo, {
    presets: ['babel-preset-expo'],
    configFile: false,
    babelrc: false,
  });

  const stubs = {
    react: { useState: () => [null, () => {}], useRef: () => ({ current: null }), useEffect: () => {} },
    '../api/client': { pedidosAPI: { ruta: () => Promise.resolve({ data: {} }) } },
  };
  const requireOriginal = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (stubs[id]) return stubs[id];
    return requireOriginal.apply(this, arguments);
  };

  const modulo = { exports: {} };
  try {
    new Function('module', 'exports', 'require', code)(modulo, modulo.exports, require);
  } finally {
    Module.prototype.require = requireOriginal;
  }
  return modulo.exports;
};

const { debeRecalcular } = cargarHook();

// ─── Mini runner ──────────────────────────────────────────────────────
let pasaron = 0, fallaron = 0;
const test = (nombre, fn) => {
  try { fn(); console.log('  OK   ' + nombre); pasaron++; }
  catch (e) { console.log('  FALLA ' + nombre + '\n        ' + e.message); fallaron++; }
};
const igual = (real, esperado, msg) => {
  if (real !== esperado) throw new Error(`${msg || ''} esperado ${esperado}, recibido ${real}`);
};

console.log('\nFreno de recálculo de ruta (useRutaPedido)\n');

// Repartidor quieto en el semáforo: el GPS sigue latiendo cada 15 s pero
// las lecturas varían solo unos metros (ruido normal del sensor).
test('GPS cada 15s SIN moverse durante 10 min → 1 sola llamada', () => {
  const base = { lat: 15.8631, lng: -97.0676 };
  let ultimo = { pos: null, ts: 0 };
  let llamadas = 0;

  for (let i = 0; i < 40; i++) {          // 40 lecturas × 15 s = 10 minutos
    const ahora = i * 15_000;
    // Ruido del GPS: ±5 m aprox (0.00005° ≈ 5.5 m)
    const pos = { lat: base.lat + (i % 2 ? 0.00005 : -0.00005), lng: base.lng };
    if (debeRecalcular(ultimo, pos, ahora)) {
      llamadas++;
      ultimo = { pos, ts: ahora };
    }
  }
  igual(llamadas, 1, 'quieto 10 min:');
});

test('moverse mucho pero en menos de 1 min → NO recalcula', () => {
  const ultimo = { pos: { lat: 15.8631, lng: -97.0676 }, ts: 100_000 };
  const lejos   = { lat: 15.8731, lng: -97.0676 };        // ~1.1 km
  igual(debeRecalcular(ultimo, lejos, 100_000 + 30_000), false, '30s después:');
});

test('pasar 1 min pero sin moverse → NO recalcula', () => {
  const ultimo = { pos: { lat: 15.8631, lng: -97.0676 }, ts: 100_000 };
  const casi   = { lat: 15.86315, lng: -97.0676 };        // ~5 m
  igual(debeRecalcular(ultimo, casi, 100_000 + 120_000), false, '2 min parado:');
});

test('moverse >150m Y pasar >1min → SÍ recalcula', () => {
  const ultimo = { pos: { lat: 15.8631, lng: -97.0676 }, ts: 100_000 };
  const lejos  = { lat: 15.8651, lng: -97.0676 };         // ~222 m
  igual(debeRecalcular(ultimo, lejos, 100_000 + 61_000), true, 'movió y pasó tiempo:');
});

test('primera lectura siempre pide la ruta', () => {
  igual(debeRecalcular({ pos: null, ts: 0 }, { lat: 15.8631, lng: -97.0676 }, 0), true, 'primera:');
});

test('sin posición del repartidor no se llama nunca', () => {
  igual(debeRecalcular({ pos: null, ts: 0 }, null, 0), false, 'sin GPS:');
});

// El bug original: la respuesta venía null (Google apagado) y el guard
// dependía de tener polyline, así que el freno no entraba jamás. Ahora el
// estado que manda es el del INTENTO, así que da igual qué respondió.
test('aunque la ruta responda null, el freno sigue aplicando', () => {
  const base = { lat: 15.8631, lng: -97.0676 };
  let ultimo = { pos: null, ts: 0 };
  let llamadas = 0;
  for (let i = 0; i < 20; i++) {
    const ahora = i * 15_000;
    if (debeRecalcular(ultimo, base, ahora)) {
      llamadas++;
      ultimo = { pos: base, ts: ahora };   // el intento se registra igual
    }
  }
  igual(llamadas, 1, 'respuesta null 20 veces:');
});

// Las 3 pantallas montan el hook por separado (cliente, negocio,
// repartidor). Cada una tiene su propio estado, así que en el peor caso
// son 3 llamadas por ciclo — nunca 3 por lectura de GPS.
test('las 3 pantallas juntas: 3 llamadas en 10 min, no 120', () => {
  const base = { lat: 15.8631, lng: -97.0676 };
  const pantallas = ['cliente', 'negocio', 'repartidor']
    .map(() => ({ ultimo: { pos: null, ts: 0 }, llamadas: 0 }));

  for (let i = 0; i < 40; i++) {
    const ahora = i * 15_000;
    for (const p of pantallas) {
      if (debeRecalcular(p.ultimo, base, ahora)) {
        p.llamadas++;
        p.ultimo = { pos: base, ts: ahora };
      }
    }
  }
  igual(pantallas.reduce((s, p) => s + p.llamadas, 0), 3, 'total 3 pantallas:');
});

// Un turno realista: el repartidor avanza ~200 m entre lectura y lectura.
test('repartidor en movimiento constante: 1 llamada por minuto, no 4', () => {
  let ultimo = { pos: null, ts: 0 };
  let llamadas = 0;
  for (let i = 0; i < 40; i++) {                 // 10 minutos
    const ahora = i * 15_000;
    const pos = { lat: 15.8631 + i * 0.0018, lng: -97.0676 };  // ~200 m por lectura
    if (debeRecalcular(ultimo, pos, ahora)) {
      llamadas++;
      ultimo = { pos, ts: ahora };
    }
  }
  // 10 min de viaje: como mucho una por minuto (más la primera).
  if (llamadas > 11) throw new Error(`esperado <= 11, recibido ${llamadas}`);
  console.log(`        (${llamadas} llamadas en 10 min de viaje continuo)`);
});

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
