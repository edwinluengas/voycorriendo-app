"""Video promocional VoyCorriendo (9:16, 1080x1920, 30 fps) para Facebook/Reels.
Usa las capturas reales de tienda/capturas y el icono de la app."""
import math, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

W, H, FPS = 1080, 1920, 30
APP = r"C:/Users/edwin/voycorriendo-app/tienda"
OUT = sys.argv[1] if len(sys.argv) > 1 else "voycorriendo-promo.mp4"

NARANJA = (255, 92, 0)
NARANJA_OSC = (214, 70, 0)
VERDE = (0, 179, 65)
NEGRO = (20, 20, 24)
BLANCO = (255, 255, 255)
FONDO = (248, 249, 250)

F_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
F_BLACK = "C:/Windows/Fonts/seguibl.ttf"
F_REG = "C:/Windows/Fonts/segoeui.ttf"
_fc = {}
def font(path, size):
    k = (path, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, size)
    return _fc[k]

def ease(t):  # easeOutCubic, t en [0,1]
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3

def ease_io(t):
    t = max(0.0, min(1.0, t))
    return 3 * t * t - 2 * t * t * t

def texto_centrado(d, y, txt, f, color, alpha=255, max_w=960):
    # Parte en líneas si no cabe
    palabras, lineas, cur = txt.split(), [], ""
    for p in palabras:
        prueba = (cur + " " + p).strip()
        if d.textlength(prueba, font=f) <= max_w:
            cur = prueba
        else:
            lineas.append(cur); cur = p
    lineas.append(cur)
    lh = f.size * 1.18
    for i, l in enumerate(lineas):
        w = d.textlength(l, font=f)
        d.text(((W - w) / 2, y + i * lh), l, font=f, fill=color + (alpha,))
    return y + len(lineas) * lh

def redondear(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = im.convert("RGBA"); out.putalpha(m)
    return out

# ---------- Teléfono con captura real ----------
PH_W = 700
def telefono(captura):
    sc = Image.open(f"{APP}/capturas/{captura}").convert("RGB")
    ph_h = int(PH_W * sc.height / sc.width)
    pantalla = redondear(sc.resize((PH_W, ph_h), Image.LANCZOS), 46)
    b = 18
    cuerpo = Image.new("RGBA", (PH_W + 2 * b, ph_h + 2 * b), (0, 0, 0, 0))
    ImageDraw.Draw(cuerpo).rounded_rectangle([0, 0, cuerpo.width - 1, cuerpo.height - 1], 62, fill=(18, 18, 22, 255))
    cuerpo.alpha_composite(pantalla, (b, b))
    # sombra
    sombra = Image.new("RGBA", (cuerpo.width + 120, cuerpo.height + 120), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle([60, 80, 60 + cuerpo.width, 80 + cuerpo.height], 62, fill=(0, 0, 0, 110))
    sombra = sombra.filter(ImageFilter.GaussianBlur(30))
    sombra.alpha_composite(cuerpo, (60, 60))
    return sombra

PHONES = {n: telefono(n) for n in ["1-catalogo.png", "2-menu.png", "3-seguimiento.png", "4-codigo.png"]}
ICONO = Image.open(f"{APP}/icono-512.png").convert("RGBA")

def fondo_degradado(c1, c2):
    g = Image.new("RGB", (1, 2)); g.putpixel((0, 0), c1); g.putpixel((0, 1), c2)
    return g.resize((W, H), Image.BICUBIC).convert("RGBA")

BG_NARANJA = fondo_degradado(NARANJA, NARANJA_OSC)
BG_CLARO = fondo_degradado((255, 244, 236), FONDO)
BG_OSCURO = fondo_degradado((34, 34, 40), NEGRO)

# ---------- Escenas ----------
# Cada escena: (duración en s, función(t_local, dur) -> Image RGBA)

def esc_gancho(t, dur):
    im = BG_NARANJA.copy(); d = ImageDraw.Draw(im)
    a1 = int(255 * ease(t / 0.5))
    texto_centrado(d, 640 - 40 * (1 - ease(t / 0.5)), "¿Se te antoja algo…", font(F_BLACK, 100), BLANCO, a1)
    a2 = int(255 * ease((t - 0.9) / 0.5))
    texto_centrado(d, 900, "y no quieres salir?", font(F_BLACK, 100), NEGRO, a2)
    a3 = int(255 * ease((t - 1.8) / 0.4))
    texto_centrado(d, 1180, "Te mostramos cómo funciona 👇".replace("👇", ""), font(F_BOLD, 60), BLANCO, a3)
    return im

def esc_marca(t, dur):
    im = BG_OSCURO.copy(); d = ImageDraw.Draw(im)
    s = 0.6 + 0.4 * ease(t / 0.6)
    tam = int(360 * s)
    ic = redondear(ICONO.resize((tam, tam), Image.LANCZOS), int(tam * 0.22))
    im.alpha_composite(ic, ((W - tam) // 2, 560 - tam // 2 + 180))
    a = int(255 * ease((t - 0.5) / 0.5))
    texto_centrado(d, 980, "VoyCorriendo", font(F_BLACK, 120), NARANJA, a)
    texto_centrado(d, 1150, "Comida y mandados a domicilio, con los negocios de tu pueblo", font(F_BOLD, 54), BLANCO, a, 900)
    return im

def esc_paso(num, titulo, sub, captura, tap=None):
    def f(t, dur):
        im = BG_CLARO.copy(); d = ImageDraw.Draw(im)
        # Burbuja del número
        a = int(255 * ease(t / 0.4))
        cx, cy, r = W // 2, 170, 70
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=NARANJA + (a,))
        n = str(num); fw = d.textlength(n, font=font(F_BLACK, 90))
        d.text((cx - fw / 2, cy - 66), n, font=font(F_BLACK, 90), fill=BLANCO + (a,))
        y = texto_centrado(d, 270, titulo, font(F_BLACK, 76), NEGRO, a)
        texto_centrado(d, y + 6, sub, font(F_REG, 46), (90, 90, 100), int(255 * ease((t - 0.3) / 0.4)), 940)
        # Teléfono que sube
        ph = PHONES[captura]
        y0 = 560 + int(900 * (1 - ease((t - 0.1) / 0.7)))
        # leve zoom lento (Ken Burns)
        z = 1.0 + 0.03 * (t / dur)
        if z != 1.0:
            ph = ph.resize((int(ph.width * z), int(ph.height * z)), Image.BILINEAR)
        x0 = (W - ph.width) // 2
        im.alpha_composite(ph, (x0, y0))
        # Indicador de toque
        if tap and t > 1.6:
            tx, ty = tap  # coordenadas relativas a la captura 1080x1920
            k = PH_W / 1080 * z
            px = x0 + int((60 + 18 + tx * k))
            py = y0 + int((60 + 18 + ty * k))
            ph_t = ((t - 1.6) % 1.2) / 1.2
            rr = int(30 + 60 * ph_t)
            ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
            od.ellipse([px - rr, py - rr, px + rr, py + rr], outline=NARANJA + (int(255 * (1 - ph_t)),), width=10)
            od.ellipse([px - 26, py - 26, px + 26, py + 26], fill=(255, 255, 255, 200), outline=NARANJA + (255,), width=6)
            im.alpha_composite(ov)
        return im
    return f

def esc_precio(t, dur):
    im = BG_NARANJA.copy(); d = ImageDraw.Draw(im)
    texto_centrado(d, 260, "Sin sorpresas", font(F_BLACK, 104), BLANCO, int(255 * ease(t / 0.4)))
    filas = [("Envío", "$40", "fijo, a todo el pueblo"),
             ("Express", "$60", "tu pedido llega primero"),
             ("Recoger en tienda", "$0", "pasas tú, sin costo de envío")]
    for i, (k, v, s) in enumerate(filas):
        a = ease((t - 0.5 - i * 0.45) / 0.45)
        if a <= 0:
            continue
        y = 560 + i * 300
        x = 90 - int(200 * (1 - a))
        card = Image.new("RGBA", (W - 180, 250), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle([0, 0, card.width - 1, 249], 36, fill=(255, 255, 255, int(255 * a)))
        cd.text((50, 40), k, font=font(F_BOLD, 58), fill=NEGRO + (int(255 * a),))
        cd.text((50, 130), s, font=font(F_REG, 42), fill=(100, 100, 110, int(255 * a)))
        vw = cd.textlength(v, font=font(F_BLACK, 110))
        cd.text((card.width - 50 - vw, 50), v, font=font(F_BLACK, 110), fill=NARANJA + (int(255 * a),))
        im.alpha_composite(card, (x, y))
    texto_centrado(d, 1540, "Sin cargos por servicio ni tarifas en hora pico", font(F_BOLD, 52), BLANCO,
                   int(255 * ease((t - 2.2) / 0.5)), 900)
    return im

def esc_cierre(t, dur):
    im = BG_OSCURO.copy(); d = ImageDraw.Draw(im)
    a = int(255 * ease(t / 0.5))
    tam = 260
    ic = redondear(ICONO.resize((tam, tam), Image.LANCZOS), 58)
    im.alpha_composite(ic, ((W - tam) // 2, 220))
    texto_centrado(d, 530, "Ya estamos en", font(F_BOLD, 60), BLANCO, a)
    pueblos = ["Puerto Escondido", "Putla Villa de Guerrero", "Santa María Zacatepec", "Santiago Pinotepa Nacional"]
    for i, p in enumerate(pueblos):
        ap = ease((t - 0.4 - i * 0.3) / 0.4)
        if ap <= 0:
            continue
        y = 640 + i * 110
        pw = d.textlength(p, font=font(F_BOLD, 54)) + 80
        x = (W - pw) / 2
        d.rounded_rectangle([x, y, x + pw, y + 86], 43, fill=NARANJA + (int(255 * ap),))
        d.text((x + 40, y + 6), p, font=font(F_BOLD, 54), fill=BLANCO + (int(255 * ap),))
    ac = ease((t - 2.0) / 0.5)
    pulso = 1 + 0.04 * math.sin(max(0, t - 2.5) * 5)
    bw, bh = int(860 * pulso), int(170 * pulso)
    bx, by = (W - bw) // 2, 1240
    d.rounded_rectangle([bx, by, bx + bw, by + bh], bh // 2, fill=VERDE + (int(255 * ac),))
    txt = "Descarga VoyCorriendo"
    fw = d.textlength(txt, font=font(F_BLACK, 66))
    d.text(((W - fw) / 2, by + bh / 2 - 48), txt, font=font(F_BLACK, 66), fill=BLANCO + (int(255 * ac),))
    texto_centrado(d, 1480, "Descárgala hoy y no te pierdas las promociones especiales", font(F_BOLD, 46), BLANCO,
                   int(255 * ac), 900)
    texto_centrado(d, 1650, "WhatsApp 56 6952 4404", font(F_BLACK, 58), VERDE, int(255 * ac))
    texto_centrado(d, 1740, "voycorriendoadmin@gmail.com", font(F_BOLD, 44), NARANJA, int(255 * ac))
    return im

# ---------- Escenas de funcionalidades ----------
AZUL = (37, 99, 235)
MODOS = {"cliente": ("Cliente", NARANJA), "negocio": ("Negocio", AZUL), "repartidor": ("Repartidor", VERDE),
         "seguridad": ("Seguridad", NEGRO)}

def check(d, cx, cy, r, color, a):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    d.line([(cx - r * 0.45, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.38), (cx + r * 0.5, cy - r * 0.35)],
           fill=BLANCO + (a,), width=max(4, r // 5), joint="curve")

def esc_modos(t, dur):
    im = BG_OSCURO.copy(); d = ImageDraw.Draw(im)
    texto_centrado(d, 330, "Una sola app,", font(F_BLACK, 96), BLANCO, int(255 * ease(t / 0.4)))
    texto_centrado(d, 450, "tres maneras de usarla", font(F_BLACK, 84), NARANJA, int(255 * ease((t - 0.2) / 0.4)))
    items = [("cliente", "Pide comida y mandados"), ("negocio", "Vende a domicilio"), ("repartidor", "Gana dinero entregando")]
    for i, (k, s) in enumerate(items):
        a = ease((t - 0.7 - i * 0.35) / 0.4)
        if a <= 0:
            continue
        nombre, col = MODOS[k]
        y = 720 + i * 290 + int(60 * (1 - a))
        d.rounded_rectangle([110, y, W - 110, y + 240], 40, fill=col + (int(255 * a),))
        d.text((170, y + 38), nombre, font=font(F_BLACK, 80), fill=BLANCO + (int(255 * a),))
        d.text((170, y + 140), s, font=font(F_BOLD, 50), fill=(255, 255, 255, int(230 * a)))
    texto_centrado(d, 1640, "Cambia de modo con la misma cuenta", font(F_BOLD, 50), BLANCO,
                   int(255 * ease((t - 2.0) / 0.5)), 900)
    return im

def esc_capitulo(modo, titulo, sub):
    def f(t, dur):
        nombre, col = MODOS[modo]
        im = fondo_degradado(col, tuple(max(0, c - 45) for c in col)); d = ImageDraw.Draw(im)
        a = int(255 * ease(t / 0.4))
        chip = f"MODO {nombre.upper()}"
        cw = d.textlength(chip, font=font(F_BOLD, 46)) + 80
        d.rounded_rectangle([(W - cw) / 2, 700, (W + cw) / 2, 790], 45, fill=(255, 255, 255, a))
        d.text(((W - cw) / 2 + 40, 708), chip, font=font(F_BOLD, 46), fill=col + (a,))
        y = texto_centrado(d, 860 + 30 * (1 - ease(t / 0.5)), titulo, font(F_BLACK, 100), BLANCO, a)
        texto_centrado(d, y + 20, sub, font(F_BOLD, 52), BLANCO, int(255 * ease((t - 0.4) / 0.4)), 900)
        return im
    return f

def esc_funciones(modo, titulo, items):
    """items: lista de (titulo, descripcion); 3 o 4 tarjetas."""
    def f(t, dur):
        nombre, col = MODOS[modo]
        im = BG_CLARO.copy(); d = ImageDraw.Draw(im)
        a = int(255 * ease(t / 0.35))
        cw = d.textlength(nombre.upper(), font=font(F_BOLD, 40)) + 64
        d.rounded_rectangle([(W - cw) / 2, 150, (W + cw) / 2, 226], 38, fill=col + (a,))
        d.text(((W - cw) / 2 + 32, 156), nombre.upper(), font=font(F_BOLD, 40), fill=BLANCO + (a,))
        texto_centrado(d, 270, titulo, font(F_BLACK, 78), NEGRO, a)
        pocos = len(items) <= 3
        alto, y0 = (300, 520) if pocos else (250, 470)
        ft, fd = font(F_BOLD, 52), font(F_REG, 40)
        for i, (tt, ds) in enumerate(items):
            ai = ease((t - 0.45 - i * 0.4) / 0.4)
            if ai <= 0:
                continue
            A = int(255 * ai)
            y = y0 + i * (alto + 40)
            x = 80 + int(160 * (1 - ai))
            card = Image.new("RGBA", (W - 160, alto), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
            cd.rounded_rectangle([0, 0, card.width - 1, alto - 1], 36, fill=(255, 255, 255, A))
            cd.rounded_rectangle([0, 0, 14, alto - 1], 7, fill=col + (A,))
            check(cd, 95, alto // 2, 44, col, A)
            cd.text((170, 56 if pocos else 36), tt, font=ft, fill=NEGRO + (A,))
            pal, lin, cur = ds.split(), [], ""
            for p in pal:
                pr = (cur + " " + p).strip()
                if cd.textlength(pr, font=fd) <= card.width - 220:
                    cur = pr
                else:
                    lin.append(cur); cur = p
            lin.append(cur)
            for j, l in enumerate(lin[:3]):
                cd.text((170, (136 if pocos else 110) + j * 50), l, font=fd, fill=(95, 95, 105, A))
            im.alpha_composite(card, (x, y))
        return im
    return f

def estrella(cx, cy, r_ext, r_int, picos, giro):
    pts = []
    for i in range(picos * 2):
        r = r_ext if i % 2 == 0 else r_int
        ang = giro + math.pi * i / picos
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts

def esc_promos(t, dur):
    """Énfasis: habrá promociones especiales dentro de la app."""
    im = fondo_degradado((255, 120, 20), (200, 40, 0)); d = ImageDraw.Draw(im)
    a = int(255 * ease(t / 0.4))
    texto_centrado(d, 230, "MUY PRONTO", font(F_BLACK, 70), NEGRO, a)
    # Sello giratorio con %
    s = ease((t - 0.2) / 0.5)
    if s > 0:
        r = int(250 * (0.4 + 0.6 * s) * (1 + 0.03 * math.sin(t * 6)))
        d.polygon(estrella(W / 2, 640, r, r * 0.82, 18, t * 0.6), fill=(255, 214, 0, int(255 * s)))
        d.ellipse([W / 2 - r * 0.72, 640 - r * 0.72, W / 2 + r * 0.72, 640 + r * 0.72], fill=BLANCO + (int(255 * s),))
        fp = font(F_BLACK, int(220 * (0.4 + 0.6 * s)))
        pw = d.textlength("%", font=fp)
        d.text((W / 2 - pw / 2, 640 - fp.size * 0.68), "%", font=fp, fill=NARANJA + (int(255 * s),))
    a2 = int(255 * ease((t - 0.7) / 0.4))
    y = texto_centrado(d, 960, "PROMOCIONES ESPECIALES", font(F_BLACK, 92), BLANCO, a2, 960)
    a3 = int(255 * ease((t - 1.2) / 0.4))
    y = texto_centrado(d, y + 30, "Descuentos y ofertas exclusivas, solo dentro de la app", font(F_BOLD, 54), BLANCO, a3, 900)
    a4 = ease((t - 1.9) / 0.4)
    if a4 > 0:
        txt = "Descárgala y sé de los primeros"
        fw = d.textlength(txt, font=font(F_BLACK, 52))
        bw, bh = fw + 100, 120
        bx, by = (W - bw) / 2, y + 90
        d.rounded_rectangle([bx, by, bx + bw, by + bh], bh // 2, fill=NEGRO + (int(255 * a4),))
        d.text((bx + 50, by + 24), txt, font=font(F_BLACK, 52), fill=(255, 214, 0, int(255 * a4)))
    return im

def esc_impacto(modo, linea1, linea2, sub):
    """Frase grande de impacto en el color del modo."""
    def f(t, dur):
        nombre, col = MODOS[modo]
        im = fondo_degradado(col, tuple(max(0, c - 60) for c in col)); d = ImageDraw.Draw(im)
        a1 = int(255 * ease(t / 0.4))
        texto_centrado(d, 620 - 40 * (1 - ease(t / 0.4)), linea1, font(F_BLACK, 110), BLANCO, a1, 980)
        a2 = ease((t - 0.45) / 0.4)
        if a2 > 0:
            f2 = font(F_BLACK, int(150 * (0.85 + 0.15 * a2)))
            texto_centrado(d, 790, linea2, f2, (255, 214, 0), int(255 * a2), 1000)
        texto_centrado(d, 1100, sub, font(F_BOLD, 56), BLANCO, int(255 * ease((t - 1.0) / 0.4)), 900)
        return im
    return f

ESCENAS = [
    (3.2, esc_gancho),
    (3.0, esc_marca),
    (4.2, esc_modos),
    (2.4, esc_capitulo("cliente", "Pide lo que quieras", "Comida, tiendita, farmacia y Voy Store®")),
    (4.6, esc_paso(1, "Elige tu antojo", "Los restaurantes, tienditas y farmacias de tu pueblo", "1-catalogo.png", tap=(330, 1020))),
    (4.6, esc_paso(2, "Pide en segundos", "A tu gusto: sabores, extras y tu dirección", "2-menu.png", tap=(1033, 990))),
    (4.6, esc_paso(3, "Síguelo en vivo", "Ve a tu repartidor en el mapa, minuto a minuto", "3-seguimiento.png")),
    (4.6, esc_paso(4, "¡Llegó!", "Tu código de 4 dígitos: solo tú recibes tu pedido", "4-codigo.png", tap=(540, 1790))),
    (5.0, esc_funciones("cliente", "Paga como quieras", [
        ("Efectivo", "Paga al recibir. Tu repartidor lleva tu cambio"),
        ("Tarjeta", "Se aceptan pagos con tarjeta para tu facilidad"),
        ("Recoger en tienda", "¿Prefieres pasar tú? Cero costo de envío"),
    ])),
    (4.2, esc_precio),
    (5.6, esc_funciones("cliente", "Y hay más", [
        ("Tus direcciones guardadas", "Casa, trabajo… pide con un toque"),
        ("Califica y deja propina", "Premia el buen servicio"),
        ("Avisos en tu celular", "Sabes en qué va tu pedido, siempre"),
        ("Ayuda por WhatsApp", "Gente real que te responde"),
    ])),
    (4.6, esc_promos),
    (2.4, esc_capitulo("negocio", "¿Tienes un negocio?", "Llega a todo tu pueblo desde su celular")),
    (3.6, esc_impacto("negocio", "Incrementa", "TUS VENTAS", "Tu menú en el celular de todo el pueblo, las 24 horas")),
    (6.0, esc_funciones("negocio", "Más clientes, más pedidos", [
        ("Nuevos clientes cada día", "Te encuentran sin que gastes en publicidad"),
        ("Promociones especiales", "Súmate a las ofertas de la app y atrae más pedidos"),
        ("Tu menú que antoja", "Fotos, precios y opciones: sabores, extras, tamaños"),
        ("Pedidos en orden", "Nuevos, preparando, listos. Cero confusión"),
    ])),
    (5.4, esc_funciones("negocio", "Cuentas claras", [
        ("Solo $35 por pedido", "Comisión fija. Sin porcentajes ni cuota mensual"),
        ("Tu dinero cuando quieras", "Cobra el viernes gratis o adelántalo el mismo día"),
        ("Tú pones las reglas", "Tus horarios, tus precios, tu menú"),
    ])),
    (2.4, esc_capitulo("repartidor", "Gana dinero entregando", "En tus tiempos, en tu pueblo")),
    (5.4, esc_funciones("repartidor", "Tú eres tu jefe", [
        ("Conéctate y gana", "Un botón y empiezas a recibir pedidos"),
        ("Hasta 3 pedidos por viaje", "Más entregas, más dinero en cada ruta"),
        ("Propinas 100% tuyas", "Todo lo que te dan, es tuyo"),
    ])),
    (5.0, esc_funciones("repartidor", "Cobra fácil", [
        ("Depósito cada viernes", "Gratis, directo a tu cuenta"),
        ("¿Lo necesitas hoy?", "Retira el mismo día"),
        ("Tu historial a la mano", "Entregas, ganancias y calificación"),
    ])),
    (5.0, esc_funciones("seguridad", "Pide con confianza", [
        ("Código de entrega", "Sin tu código, nadie se queda con tu pedido"),
        ("Repartidores verificados", "Ves su nombre, foto y placas"),
        ("Pagos seguros", "Tu tarjeta protegida por Mercado Pago"),
    ])),
    (5.6, esc_cierre),
]
TRANS = 0.35  # fundido cruzado entre escenas

def frame_en(tg):
    acc = 0.0
    for i, (dur, fn) in enumerate(ESCENAS):
        if tg < acc + dur or i == len(ESCENAS) - 1:
            tl = tg - acc
            im = fn(tl, dur)
            if i + 1 < len(ESCENAS) and tl > dur - TRANS:
                k = ease_io((tl - (dur - TRANS)) / TRANS)
                sig = ESCENAS[i + 1][1](0.0, ESCENAS[i + 1][0])
                im = Image.blend(im, sig, k)
            # fundido final a negro
            total = sum(e[0] for e in ESCENAS)
            if tg > total - 0.6:
                im = Image.blend(im, Image.new("RGBA", im.size, (0, 0, 0, 255)), (tg - (total - 0.6)) / 0.6)
            return im.convert("RGB")
        acc += dur

def main():
    total = sum(e[0] for e in ESCENAS)
    n = int(total * FPS)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    p = subprocess.Popen([ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                          "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", OUT],
                         stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    for i in range(n):
        p.stdin.write(frame_en(i / FPS).tobytes())
        if i % 150 == 0:
            print(f"{i}/{n}", flush=True)
    p.stdin.close(); p.wait()
    print("OK", OUT, f"{total:.1f}s")

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "preview":
        acc = 0.0
        for i, (dur, _) in enumerate(ESCENAS):
            frame_en(acc + dur * 0.8).save(f"prev_{i:02d}.jpg", quality=75)
            acc += dur
    else:
        main()
