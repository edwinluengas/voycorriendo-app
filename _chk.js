const parser = require('@babel/parser');
const fs = require('fs');
let bad = 0;
for (const f of process.argv.slice(2)) {
  try {
    parser.parse(fs.readFileSync(f, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator', 'classProperties', 'objectRestSpread', 'optionalCatchBinding', 'dynamicImport'],
    });
  } catch (e) { bad++; console.log('FALLA', f, '→', e.message); }
}
console.log(bad === 0 ? `OK — ${process.argv.length - 2} archivos sin errores de sintaxis` : `${bad} con error`);
