# Recursos de la tienda

## `feature-graphic.png` — gráfico destacado (1024×500)

Listo para subir. Cumple los requisitos de Google Play: 1024×500 exactos,
PNG de 24 bits **sin canal alfa** (Play rechaza transparencia) y 135 KB.

Se genera desde `feature-graphic.html` con Chrome, sin instalar nada:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size=1024,500 `
  --screenshot="tienda\feature-graphic.png" `
  "file:///C:/Users/edwin/voycorriendo-app/tienda/feature-graphic.html"
```

Para cambiar el texto o los colores, edita el HTML y vuelve a correr eso.

**Dos cosas que cuestan un intento si se olvidan:** el HTML necesita
`<meta charset="utf-8">` o Chrome adivina la codificación del sistema y los
acentos salen como "EnvÃ­o"; y `--force-device-scale-factor=1`, o en una
pantalla con escalado la captura sale a 1536×750 y Play la rechaza.

Los iconos son SVG en línea, no emojis: en Windows los emojis se dibujan con
la fuente del sistema y salen con colores planos que no combinan con la
paleta.

## Lo que falta armar a mano

**Capturas de pantalla** (mínimo 2, idealmente 4–8). Se toman del teléfono
con la app instalada — no se pueden generar desde aquí. Las que más venden,
en este orden:

1. El catálogo de tu localidad (se ve el nombre del pueblo y los negocios)
2. El menú de un restaurante con las fotos de los platillos
3. El seguimiento con el mapa y el repartidor en camino
4. Ganancias del repartidor, o el alta de un negocio

Antes de tomarlas, sube las fotos reales de cada negocio desde
**Negocio → Fotos**: las que hay ahora son de relleno.

**Icono 512×512**: sale de `assets/icon.png`, que ya está en 1024×1024.
Play lo reescala solo, o puedes exportarlo a 512 con cualquier editor.
