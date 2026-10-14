# Capturas de pantalla para Google Play

Cuatro capturas listas para subir, **1080×1920 px** (formato 9:16 vertical,
el que Play muestra en la ficha). Cumplen los requisitos: mínimo 320 px, ratio
entre 1:2 y 2:1, PNG.

| Archivo | Muestra |
|---|---|
| `1-catalogo.png` | Inicio: catálogo de la localidad con negocios, categorías y precio de envío |
| `2-menu.png` | Menú de un restaurante con la foto oficial, productos y precios |
| `3-seguimiento.png` | Seguimiento en vivo: negocio, repartidor y cliente en el mapa |
| `4-codigo.png` | Código de entrega de 4 dígitos — la seguridad del pedido |

## Qué son, con honestidad

**No son capturas crudas del teléfono.** Son representaciones construidas con
el **sistema de diseño real de la app** (los mismos colores de
`theme/colors.js`, la misma estructura de cada pantalla) y **datos reales del
catálogo** (Yard House y sus productos, con nombres y precios de verdad).
Salen visualmente idénticas a lo que se ve en la app.

Google Play acepta capturas "diseñadas" siempre que representen fielmente la
app —es lo que hacen la mayoría de las fichas profesionales—. Éstas lo hacen.

**La versión ideal**, cuando haya negocios reales operando: tomar capturas
del teléfono con la app instalada, después de que cada restaurante suba sus
fotos reales desde Negocio → Fotos. Esas serían capturas crudas con comida
real, aún mejores. Estas sirven perfectamente para lanzar mientras tanto.

## Cómo se regeneran

Los `.html` de este directorio son los generadores. Para cambiar un texto,
color o dato, edita el HTML y renderiza con Chrome sin interfaz:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size=1080,1920 `
  --screenshot="tienda\capturas\1-catalogo.png" `
  "file:///C:/Users/edwin/voycorriendo-app/tienda/capturas/_1-catalogo.html"
```

Las mismas dos trampas del gráfico destacado aplican: `<meta charset="utf-8">`
o los acentos salen rotos, y `--force-device-scale-factor=1` o la captura sale
al doble de tamaño en una pantalla con escalado.

## Orden recomendado en la ficha

1. Catálogo — es lo primero que engancha (comida cerca)
2. Menú — muestra que hay variedad y precios claros
3. Seguimiento — el diferenciador (mapa en vivo)
4. Código — transmite confianza y seguridad
