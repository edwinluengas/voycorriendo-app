/**
 * Genera el icono de notificación de Android.
 *
 * Android IGNORA los colores de este icono: toma solo el canal alfa y lo
 * rellena con el color de acento. Por eso tiene que ser una silueta blanca
 * sobre transparente — si se le pasa el icono a color de la app (que es lo
 * que estaba pasando), el sistema lo aplasta a un cuadrado blanco sólido y
 * en la barra de estado no se distingue nada.
 *
 * DISEÑO — por qué dos chevrons y no una bolsa ni una moto:
 * la marca se llama "VoyCorriendo"; lo que la distingue no es la comida,
 * es la velocidad. Todas las apps de reparto ponen una bolsita o un casco,
 * y a 24 dp esas formas se convierten en una mancha. Dos chevrons gruesos
 * inclinados leen como marca de velocidad incluso en la barra de estado de
 * un teléfono viejo, y no se parecen a los de nadie más en Puerto Escondido.
 *
 * La restricción técnica (monocromo obligatorio) es justamente lo que hace
 * la marca reconocible: no hay adorno posible, solo la silueta.
 *
 *   node scripts/generar-icono-notificacion.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TAM = 192;                 // se escala solo a mdpi/hdpi/xhdpi
const MARGEN = TAM * 0.17;       // área segura: Android recorta los bordes
const SUPER = 3;                 // muestreo 3×3 para bordes suaves

// ─── Geometría ────────────────────────────────────────────
// Distancia de un punto a un segmento: sirve para dibujar trazos gruesos
// con las puntas redondeadas, que es lo que hace que el chevron se vea
// dibujado y no cortado con tijeras.
const distanciaASegmento = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
};

const util = TAM - MARGEN * 2;
const GROSOR = util * 0.17;                 // trazo grueso: legible a 24 dp
const ALTO   = util * 0.52;                 // apertura vertical del chevron
const ANCHO  = util * 0.30;                 // qué tanto "abre" hacia atrás

// Dos chevrons: el de adelante entero, el de atrás ligeramente menor para
// dar sensación de estela sin recurrir a líneas de movimiento (que a este
// tamaño se pierden).
// Las puntas se colocan de modo que el CONJUNTO quede centrado: el chevron
// abre hacia atras, asi que su ancho real se extiende a la izquierda de la
// punta y hay que compensarlo o la marca se recuesta sobre el borde.
const chevrons = [
  { x: MARGEN + util * 0.84, escala: 1.0 },
  { x: MARGEN + util * 0.48, escala: 0.86 },
];

const cy = TAM / 2;

const dentroDeLaMarca = (x, y) => {
  for (const c of chevrons) {
    const h = ALTO * c.escala, w = ANCHO * c.escala, g = GROSOR * c.escala;
    // Brazo superior y brazo inferior, unidos en la punta (c.x, cy).
    const d1 = distanciaASegmento(x, y, c.x - w, cy - h / 2, c.x, cy);
    const d2 = distanciaASegmento(x, y, c.x - w, cy + h / 2, c.x, cy);
    if (Math.min(d1, d2) <= g / 2) return true;
  }
  return false;
};

// ─── Rasterizado con antialiasing ─────────────────────────
const pixeles = Buffer.alloc(TAM * TAM * 4, 0);
for (let y = 0; y < TAM; y++) {
  for (let x = 0; x < TAM; x++) {
    let dentro = 0;
    for (let sy = 0; sy < SUPER; sy++) {
      for (let sx = 0; sx < SUPER; sx++) {
        const mx = x + (sx + 0.5) / SUPER;
        const my = y + (sy + 0.5) / SUPER;
        if (dentroDeLaMarca(mx, my)) dentro++;
      }
    }
    const alfa = Math.round((dentro / (SUPER * SUPER)) * 255);
    const i = (y * TAM + x) * 4;
    pixeles[i] = 255; pixeles[i + 1] = 255; pixeles[i + 2] = 255;  // blanco
    pixeles[i + 3] = alfa;                                          // la silueta
  }
}

// ─── Codificar PNG (sin dependencias) ─────────────────────
const crc32 = (buf) => {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const trozo = (tipo, datos) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TAM, 0); ihdr.writeUInt32BE(TAM, 4);
ihdr[8] = 8;    // 8 bits por canal
ihdr[9] = 6;    // RGBA
// filtro 0 por fila (sin predicción): el archivo es pequeño y así el
// generador se mantiene legible.
const crudo = Buffer.alloc(TAM * (TAM * 4 + 1));
for (let y = 0; y < TAM; y++) {
  crudo[y * (TAM * 4 + 1)] = 0;
  pixeles.copy(crudo, y * (TAM * 4 + 1) + 1, y * TAM * 4, (y + 1) * TAM * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  trozo('IHDR', ihdr),
  trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
  trozo('IEND', Buffer.alloc(0)),
]);

const destino = path.join(__dirname, '..', 'assets', 'notification-icon.png');
fs.writeFileSync(destino, png);
console.log(`Icono de notificación generado: assets/notification-icon.png (${TAM}×${TAM}, ${(png.length / 1024).toFixed(1)} KB)`);

// Vista previa en consola para revisar la silueta sin abrir el archivo.
console.log('\nVista previa:');
for (let y = 0; y < TAM; y += 6) {
  let fila = '  ';
  for (let x = 0; x < TAM; x += 3) {
    fila += pixeles[(y * TAM + x) * 4 + 3] > 128 ? '█' : '·';
  }
  console.log(fila);
}
