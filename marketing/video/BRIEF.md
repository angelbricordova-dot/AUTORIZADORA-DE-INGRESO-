# Brief del video comercial · Tu Día en Tucacas

> **Para pegar en el otro chat de Claude Code** (el que tiene la API de ElevenLabs).
> Todo lo que se menciona está en el repositorio `angelbricordova-dot/AUTORIZADORA-DE-INGRESO-`, rama `claude/sweet-darwin-vs9ng7`, carpeta `marketing/video/`.

---

## 0. Instrucciones para el otro chat

Eres el productor de un video comercial corto para un apartamento vacacional en Tucacas, Venezuela. Con la API de ElevenLabs y las piezas de este brief:

1. **Lee este documento completo** y revisa las carpetas:
   - `marketing/video/capturas/`
   - `marketing/video/grabaciones/`
   - `marketing/video/marca/`
   - `public/fotos/`
2. **Voz.** Genera la locución de los dos guiones (30 s y 60 s) con la voz descrita en la sección 6.1. Guárdala en `marketing/video/salida/voz-30s.mp3` y `voz-60s.mp3`. Si la duración no cuadra, ajusta la velocidad (entre 0,95 y 1,05) antes de recortar texto.
3. **Música.** Genera la pista con el prompt de la sección 6.2 en dos duraciones (30 s y 60 s): `musica-30s.mp3` y `musica-60s.mp3`.
4. **Efectos.** Genera los efectos de la sección 6.3: `sfx-*.mp3`.
5. **Montaje.** Arma el video con ffmpeg (o la herramienta que tengas) siguiendo la tabla del guion y la sección 7:
   - versión vertical 9:16 (1080×1920) para Reels y TikTok;
   - si sobra tiempo, 1:1 y 16:9.
   - Salida: `marketing/video/salida/tudia-30s-vertical.mp4`, `tudia-60s-vertical.mp4`.
6. **Mezcla.**
   - Música a −18 dB debajo de la voz (ducking), subiendo a −10 dB donde no hay voz.
   - Efectos a −14 dB.
   - Loudness final −14 LUFS (redes sociales).
7. **Subtítulos.** Quemados, con el estilo de la sección 7.
8. **No inventes datos.** Usa solo lo que dice este brief. Lo que esté marcado **[COMPLETAR]** pregúntaselo al usuario.

**Seguridad:**
- La API key de ElevenLabs va en una variable de entorno (`ELEVENLABS_API_KEY`). Nunca en el código, en un archivo del repo ni en el chat.
- No subas los audios ni videos generados al repositorio sin preguntar: pesan mucho.

---

## 1. Datos del negocio

| Dato | Valor |
|---|---|
| Marca | **Tu Día en Tucacas** |
| Lema de la página | "Tu día en Tucacas **empieza aquí**" |
| Qué es | Apartamento vacacional por día / por noche |
| Dónde | Apartamento N°30, piso 1, Conjunto Residencial Pescadores I, Tucacas, estado Falcón, Venezuela |
| Ubicación clave | A 5 min de los muelles, para ir a los cayos; a 20 min en carro del Parque Nacional Morrocoy |
| Capacidad | Hasta 7 personas · 2 habitaciones (una matrimonial y una con litera y cama nido) · 5 camas · 2 baños |
| Lo que lo diferencia | Tanque de agua propio ("cero estrés: no dependemos solo del edificio") · WiFi de fibra óptica · aire acondicionado en todos los ambientes |
| Del conjunto | Piscina con tobogán, churuata iluminada de noche, áreas recreativas, estacionamiento, seguridad |
| Público | Familias y grupos de amigos venezolanos que quieren ir a los cayos sin gastar de más |
| Promesa | "Comodidad real para 7 personas sin romper el presupuesto. Ideal para ahorrar para tus paseos a los cayos." |
| Precio | Desde $90 la noche (valor del panel). Confirmar con el usuario antes de ponerlo en el video **[COMPLETAR]** |
| WhatsApp | +58 424-270-3482 |
| Web | tudiaentucacas.netlify.app |
| Instagram | @aribnb.tucacas |
| TikTok | **[COMPLETAR]** |
| Airbnb | airbnb.com/rooms/1622130249785584357 |
| Anfitriona | Oniris Rojas (dueña). No mostrar su nombre ni su cara sin permiso. |

---

## 2. Identidad de marca

### Colores exactos

**Tema claro (principal):**

| Uso | Nombre | Hex |
|---|---|---|
| Color de marca (botones, títulos) | Verde Tucacas | `#1d7f68` |
| Verde mar (degradados) | Verde 2 | `#14706c` |
| Verde profundo | Verde profundo | `#0e4f4a` |
| Texto sobre claro / tinta de marca | Tinta | `#0b3a36` |
| Turquesa del mar | Mar | `#17a3a0` |
| Sol (acentos, botón "Buscar fechas") | Sol | `#f4b63f` |
| Fondo cálido del sol | Sol suave | `#fdf1d6` |
| Acento coral (poco uso) | Coral | `#d8613c` |
| Fondo general | Arena clara | `#f4f7f6` |
| Tarjetas | Blanco | `#ffffff` |
| Texto principal | Tinta 1 | `#0f2724` |

**Tema oscuro (para escenas nocturnas):** fondo `#0a1513` · tarjetas `#111f1d` · marca `#22947a` · sol `#f6c158` · texto `#e6f1ee` · verde claro para texto `#8fe0c6`.

**Degradados:**
- Portada (hero): `linear-gradient(160deg, #1d7f68 0%, #14706c 50%, #0e4f4a 100%)`.
- Ícono de la app: vertical `#35b58f → #17807a → #0a4440`, con un sol radial arriba a la derecha `#ffe29a → #ffc46a → #ff9f4a` (transparente al borde).

### Tipografía (las dos son de Google Fonts, gratis)

- **Títulos:** **Bricolage Grotesque** (variable). Peso 700–800 y tracking un poco cerrado (−1 %).
- **Texto y subtítulos:** **Onest** (variable). Peso 500–600.
- El lema se escribe en dos líneas: "Tu día en Tucacas" en blanco y "**empieza aquí**" en sol `#f4b63f`.

### Logo

| Archivo | Uso |
|---|---|
| `marketing/video/marca/logo-blanco.png` / `.svg` | Sobre fondos verdes o fotos (el principal en video) |
| `marketing/video/marca/logo-verde.png` / `.svg` | Sobre fondos claros |
| `marketing/video/marca/logo-tinta.png` / `.svg` | Versión oscura de una sola tinta |
| `marketing/video/marca/icono-app.png` / `.svg` | Ícono cuadrado con degradado (cierre del video y avatar) |

El logo es un dibujo de una sola línea: palmera, olas, un camino que lleva al sol, una gaviota y una sonrisa.

En la página se "dibuja" trazo a trazo y luego se rellena (ver `grabaciones/01-inicio-recorrido.mp4`, primeros 3 segundos). Repite ese efecto en la apertura o en el cierre: anima el `stroke-dashoffset` del SVG y luego aparece el relleno.

Código fuente del logo: `src/components/Logo.tsx`.

---

## 3. Material visual disponible

### Fotos reales del apartamento: `public/fotos/`

Son fotos verticales (960×1280) tomadas con teléfono y mejoradas con IA. Úsalas con zoom suave (Ken Burns de 100 % a 108 %, no más), porque con más zoom se ve la baja resolución.

| Archivo | Qué muestra | Para qué escena |
|---|---|---|
| `n30-02-piscina.jpg` | Piscina de día: agua azul, palmera, tobogán, cielo despejado (horizontal) | **Apertura / gancho** |
| `n30-12-piscina-noche.jpg` | Churuata iluminada en azul junto a la piscina de noche | Cierre o "las noches" |
| `n30-01-sala-comedor.jpg` | Comedor con sillas verdes, mesa redonda y sala al fondo | Interior |
| `n30-03-sala.jpg` | Vista larga: sala, comedor y cocina; techo con vigas, luces cálidas y plantas | Interior (la más "wow") |
| `n30-07-sala-sofa.jpg` | Sofá de cuero con chaise, persianas, techo con luces | Descanso |
| `n30-08-tv.jpg` | TV en pared tipo mármol | Entretenimiento |
| `n30-04-cocina.jpg` | Cocina en L con lámpara de mimbre encendida, microondas y cafetera | Cocina equipada |
| `n30-05-habitacion.jpg` | Habitación principal: cama matrimonial azul, A/A, persianas | Aire acondicionado |
| `n30-06-literas.jpg` | Segunda habitación: litera con cama nido (para niños) | Familias |
| `n30-10-bano-2.jpg` | Baño con listones de madera y lavamanos moderno | Baños |
| `n30-09-bano.jpg` | Baño con espejo iluminado. **Ojo: en el espejo se refleja quien tomó la foto.** Recorta el espejo o no la uses. | (evitar) |
| `n30-11-entrada.jpg` | Pasillo de entrada con pared azul y piso de hexágonos | Llegada / llaves |

> El usuario subió fotos de mejor calidad desde el panel (Supabase Storage). Si las comparte, úsalas en lugar de estas: son las que se ven hoy en tudiaentucacas.netlify.app/apartamento/30.

### Capturas de la página: `marketing/video/capturas/`

Generadas desde el código de la página con los datos de ejemplo. Los precios, las fechas ocupadas y el calendario son de prueba: no los muestres como reales.

| Archivo | Tamaño | Qué muestra |
|---|---|---|
| `movil-claro-01-inicio.png` | 1170×2532 | Portada con logo, sol, palmeras y "Tu día en Tucacas empieza aquí" |
| `movil-claro-02-inicio-completo.png` | página completa | Todo el inicio (para hacer scroll en edición) |
| `movil-claro-03-apartamento.png` | 1170×2532 | Página del N°30 con su foto principal |
| `movil-claro-04-el-apartamento.png` | | 7 personas · 2 habitaciones · 5 camas · 2 baños + galería |
| `movil-claro-05-incluye.png` | | Lista de comodidades |
| `movil-claro-06-fechas.png` | | Calendario y botón "Reservar por WhatsApp" |
| `movil-claro-07-donde-queda.png` | | Ubicación |
| `movil-oscuro-*.png` | 1170×2532 | Lo mismo en modo noche |
| `pc-claro-*.png` | 1440×900 | Versión computadora (para el 16:9) |

### Grabaciones de la página: `marketing/video/grabaciones/`

Todas son MP4 H.264, 1080×2338, 30 fps. Recórtalas a 1080×1920 para 9:16.

| Archivo | Duración | Qué muestra |
|---|---|---|
| `01-inicio-recorrido.mp4` | 16 s | El logo se dibuja, sale el sol, las palmeras se mueven y luego un scroll suave por el inicio |
| `02-apartamento-n30.mp4` | 20 s | Scroll por la página del N°30: fotos, datos, comodidades, calendario y botón de WhatsApp |
| `03-modo-dia-noche.mp4` | 9 s | El botón de sol/luna cambia la página de día a noche con una transición circular |

**Úsalas dentro de un marco de teléfono** (mockup sencillo, bordes redondeados de 48 px, sombra suave) sobre fondo verde de marca. No las pongas a pantalla completa.

### Tomas que conviene grabar con el teléfono (opcional, mejoran mucho el video)

Si el usuario puede grabarlas, pídeselas. Si no, el video funciona solo con fotos y capturas.

1. Abrir la puerta del apartamento con la llave (2 s).
2. Mano que prende el aire acondicionado con el control (2 s).
3. Niños tirándose por el tobogán de la piscina (de espaldas o lejos, con permiso de los padres) (3 s).
4. Lancha saliendo del muelle de Tucacas hacia los cayos (3 s).
5. Agua cristalina de un cayo, toma desde la lancha (3 s).
6. Atardecer desde el conjunto (3 s).

---

## 4. Guion de 30 segundos (vertical 9:16)

**Idea:** "Ahorra en el hospedaje, gasta en los cayos". Ritmo ágil, cálido y familiar.
**Locución:** 66 palabras, unos 29 s a ritmo natural.

| Tiempo | Imagen (archivo) | Texto en pantalla | Locución | Sonido |
|---|---|---|---|---|
| 0:00–0:03 | `n30-02-piscina.jpg`, zoom-in lento | **¿Plan para Morrocoy?** | ¿Planeando tu escapada a Morrocoy? | Olas suaves + gaviotas; entra la música |
| 0:03–0:07 | `n30-03-sala.jpg` → `n30-01-sala-comedor.jpg` | **Tucacas · Pescadores I** | Te esperamos en Tucacas, en Pescadores I. | Whoosh suave en el corte |
| 0:07–0:11 | `n30-05-habitacion.jpg` → `n30-06-literas.jpg` → `n30-10-bano-2.jpg` (1,3 s c/u) | **Hasta 7 personas · 2 hab · 2 baños** | Dos habitaciones, dos baños y espacio para siete. | |
| 0:11–0:16 | `n30-04-cocina.jpg` + íconos animados | **A/A · WiFi fibra · Tanque de agua propio** | Aire en todos los ambientes, WiFi de fibra y tanque de agua propio: cero estrés. | Clic suave por cada ícono |
| 0:16–0:21 | `n30-02-piscina.jpg` (otro encuadre) → `n30-12-piscina-noche.jpg` | **Piscina con tobogán** · **5 min de los muelles** | Piscina con tobogán para los chamos, y a cinco minutos de los muelles para irte a los cayos. | Chapuzón + risas lejanas |
| 0:21–0:26 | `grabaciones/02-apartamento-n30.mp4` en mockup de teléfono (parte del calendario y del botón de WhatsApp) | **Revisa tus fechas** | Revisa tus fechas y escríbenos por WhatsApp. | Sonido de mensaje enviado |
| 0:26–0:30 | Fondo con degradado de portada + logo blanco dibujándose + datos | **Tu día en Tucacas** / *empieza aquí* · WhatsApp +58 424-270-3482 · @aribnb.tucacas | Tu Día en Tucacas… empieza aquí. | Música resuelve; brisa |

**Locución completa (30 s), para pegar en ElevenLabs:**

```
¿Planeando tu escapada a Morrocoy? ... Te esperamos en Tucacas, en Pescadores I. Dos habitaciones, dos baños y espacio para siete. Aire en todos los ambientes, WiFi de fibra y tanque de agua propio: cero estrés. Piscina con tobogán para los chamos, y a cinco minutos de los muelles para irte a los cayos. Revisa tus fechas y escríbenos por WhatsApp. ... Tu Día en Tucacas... empieza aquí.
```

---

## 5. Guion de 60 segundos (vertical 9:16)

**Idea:** un día perfecto, de la llegada a la noche. Más emocional, termina en la llamada a la acción.
**Locución:** 125 palabras, unos 55 s; las pausas completan el minuto.

| Tiempo | Imagen (archivo) | Texto en pantalla | Locución | Sonido |
|---|---|---|---|---|
| 0:00–0:04 | `grabaciones/01-inicio-recorrido.mp4` (logo dibujándose, sol) a pantalla completa con desenfoque detrás | — | Hay días que se recuerdan toda la vida... | Brisa entre palmeras; entra la música suave |
| 0:04–0:08 | `n30-02-piscina.jpg` | **Tucacas, Falcón** | ...y empiezan en Tucacas. | Olas + gaviotas |
| 0:08–0:13 | `n30-11-entrada.jpg` (o la toma de la llave) | **Llegas y entras** | Llegas, te recibimos, y nosotros nos encargamos de tu autorización de ingreso al conjunto. | Llave en la cerradura |
| 0:13–0:19 | `n30-03-sala.jpg` → `n30-07-sala-sofa.jpg` → `n30-08-tv.jpg` | **Apartamento N°30 · Pescadores I** | El apartamento treinta es comodidad real para siete personas, sin romper el presupuesto. | Whoosh suave |
| 0:19–0:25 | `n30-05-habitacion.jpg` → `n30-06-literas.jpg` | **2 habitaciones · 5 camas** | Dos habitaciones, cinco camas, y aire acondicionado en todos los ambientes, para dormir sabroso después de la playa. | Clic del control del aire |
| 0:25–0:30 | `n30-04-cocina.jpg` → `n30-10-bano-2.jpg` | **Cocina equipada · 2 baños** | Cocina equipada, dos baños... | |
| 0:30–0:35 | Íconos animados sobre fondo verde (gota de agua, WiFi) | **Tanque de agua propio · WiFi de fibra** | ...tanque de agua propio para que no te falte, y WiFi de fibra óptica. | Burbuja suave, clics |
| 0:35–0:42 | `n30-02-piscina.jpg` (detalle del tobogán) + toma de lancha si existe | **5 min de los muelles · 20 min de Morrocoy** | Bajas a la piscina con los chamos, o en cinco minutos estás en el muelle, rumbo a Cayo Sombrero. | Chapuzón + risas; motor de lancha lejos |
| 0:42–0:47 | `n30-12-piscina-noche.jpg` | **Y de noche…** | Y cuando cae la noche, la churuata te espera. | La música baja a un groove suave; grillos |
| 0:47–0:54 | `grabaciones/02-apartamento-n30.mp4` en mockup (calendario → "Reservar por WhatsApp"), luego `03-modo-dia-noche.mp4` | **tudiaentucacas.netlify.app** | Mira las fechas libres en nuestra página y reserva directo por WhatsApp. Rápido y en confianza. | Mensaje enviado |
| 0:54–1:00 | Degradado de portada + logo blanco dibujándose + ícono de la app | **Tu día en Tucacas / empieza aquí** · WhatsApp +58 424-270-3482 · @aribnb.tucacas | Tu Día en Tucacas... empieza aquí. | La música resuelve; olas al final |

**Locución completa (60 s), para pegar en ElevenLabs:**

```
Hay días que se recuerdan toda la vida... y empiezan en Tucacas. Llegas, te recibimos, y nosotros nos encargamos de tu autorización de ingreso al conjunto. El apartamento treinta es comodidad real para siete personas, sin romper el presupuesto. Dos habitaciones, cinco camas, y aire acondicionado en todos los ambientes, para dormir sabroso después de la playa. Cocina equipada, dos baños... tanque de agua propio para que no te falte, y WiFi de fibra óptica. Bajas a la piscina con los chamos, o en cinco minutos estás en el muelle, rumbo a Cayo Sombrero. Y cuando cae la noche, la churuata te espera. Mira las fechas libres en nuestra página y reserva directo por WhatsApp. Rápido y en confianza. ... Tu Día en Tucacas... empieza aquí.
```

**Notas de tono:**
- Español venezolano natural. "Chamos" y "dormir sabroso" dan cercanía; no añadas más jerga.
- Nada de "¡¡increíble!!" ni gritos de vendedor: sonrisa en la voz, ritmo relajado de costa.
- Los "..." son pausas de respiración.

---

## 6. ElevenLabs

### 6.1 Voz

**Opción A: Voice Library.** Busca voces con acento **venezolano** o, si no hay, **latinoamericano neutro / colombiano costeño suave**. Filtros: *Spanish*, *Narrative* o *Advertisement*, género femenino, edad media.

**Opción B: Voice Design.** Prompt para crear la voz:

```
Voz femenina venezolana de unos 32 años, cálida, cercana y alegre, con una sonrisa que se nota al hablar. Acento caraqueño suave, natural, nada exagerado. Ritmo relajado de costa, como una anfitriona que te recibe en su casa de playa. Timbre medio, limpio, sin ronquera. Calidad de estudio, sin ruido ni eco.
```

Texto de prueba para Voice Design:

```
¡Hola! Bienvenidos a Tucacas. Pasen adelante, que el aire ya está prendido y la piscina los está esperando. Aquí lo único que tienen que hacer es descansar.
```

**Modelo y ajustes recomendados:**
- **Modelo:** *Eleven v3* si está disponible (mejor entonación en español y admite etiquetas como `[cálida]` o `[sonriendo]`); si no, *Eleven Multilingual v2*.
- **Stability:** 0,45 (natural, con algo de variación).
- **Similarity:** 0,80.
- **Style / Exaggeration:** 0,20.
- **Speaker boost:** activado.
- **Velocidad:** 1,0. Si el de 30 s pasa de 29 s, sube a 1,04.
- **Formato:** mp3 44,1 kHz 192 kbps, o wav si lo permite.

Con *Eleven v3*, puedes anteponer `[cálida, sonriendo]` al texto y `[pausa]` donde hay "...".

Genera 3 tomas de cada guion y elige la más natural.

### 6.2 Música (ElevenLabs Music)

**Prompt principal:**

```
Instrumental tropical caribbean chill-pop for a vacation rental ad in Venezuela. Warm and sunny, feel-good, family-friendly. Venezuelan cuatro strumming as the main rhythm, light maracas, soft steel drum melody, warm round bass, gentle claps, airy synth pad. 100 BPM, major key. Starts soft with just cuatro and ocean ambience, builds gently, small lift at the call to action, ends with a clean resolved final chord (no fade-out). No vocals, no reggaeton beat, no drops.
```

- **30 s:** añade al prompt "Duration 30 seconds, lift at 0:20, final chord at 0:29".
- **60 s:** añade "Duration 60 seconds, calmer breakdown around 0:42 for a night scene, lift at 0:47, final chord at 0:59".

**Alternativa más moderna (para TikTok):**

```
Instrumental upbeat tropical house, light and organic, marimba and Venezuelan cuatro hook, soft four-on-the-floor kick, shaker, warm bass, sunny summer vibe, 112 BPM, no vocals, clean ending.
```

### 6.3 Efectos de sonido (Sound Effects)

| Archivo | Prompt | Duración |
|---|---|---|
| `sfx-olas.mp3` | Gentle Caribbean ocean waves lapping on a sandy shore, calm, close, no wind noise | 6 s |
| `sfx-gaviotas.mp3` | A few distant seagulls calling over a calm beach, light and pleasant | 4 s |
| `sfx-brisa-palmeras.mp3` | Soft tropical breeze rustling through palm leaves, warm afternoon | 5 s |
| `sfx-chapuzon.mp3` | Child jumping into a swimming pool with a splash, kids laughing happily in the distance | 3 s |
| `sfx-llave.mp3` | Key turning in a door lock and the door opening, clean, close-up | 2 s |
| `sfx-control-aire.mp3` | Remote control beep and an air conditioner starting with a soft whoosh | 2 s |
| `sfx-whoosh.mp3` | Soft airy whoosh transition, subtle, not cinematic | 0,8 s |
| `sfx-clic-ui.mp3` | Soft modern UI tap click, friendly | 0,3 s |
| `sfx-mensaje.mp3` | Short friendly message sent pop sound, generic, not from any brand | 0,6 s |
| `sfx-lancha.mp3` | Small motorboat passing by at sea, medium distance, with water splashing | 4 s |
| `sfx-grillos.mp3` | Night ambience with soft crickets near a pool, peaceful | 5 s |

---

## 7. Edición

**Formatos:**

| Formato | Medidas | Uso |
|---|---|---|
| 9:16 | 1080×1920 | Reels, TikTok, Estados de WhatsApp. **El principal.** |
| 1:1 | 1080×1080 | Feed de Instagram |
| 16:9 | 1920×1080 | YouTube, perfil de Google. Usa las capturas `pc-claro-*`. |

**Zonas seguras en 9:16:** deja libres 250 px arriba y 420 px abajo (ahí van los botones de Instagram y TikTok), y 60 px a los lados.

**Subtítulos:**
- Letra Onest SemiBold 54 px, blanca, con sombra suave `rgba(0,0,0,.35)`.
- Máximo 2 líneas y 32 caracteres por línea.
- La palabra clave de cada frase en sol `#f4b63f`.
- Posición: un poco por encima de la zona segura inferior.

**Textos en pantalla:**
- Bricolage Grotesque ExtraBold 88–110 px.
- Blancos sobre foto oscura, o tinta `#0b3a36` sobre "pastilla" blanca con bordes redondeados de 28 px.

**Íconos:** de línea, trazo redondeado de 2 px, en blanco o `#1d7f68`, al estilo de los de la página (`src/components/Icon.tsx`).

**Ritmo:**
- Cortes cada 1,5–3 s en el de 30 s y cada 2–4 s en el de 60 s.
- Transiciones: corte seco o *whip* suave.
- Nada de transiciones de PowerPoint (estrellas, cubos).

**Color:** sube un poco la calidez y la saturación del agua. No pases de +10 de saturación: las fotos tienen artefactos de compresión.

**Cierre (siempre):**
- Fondo con el degradado de portada.
- Logo blanco dibujándose.
- "Tu día en Tucacas / *empieza aquí*".
- Debajo, en Onest: "WhatsApp +58 424-270-3482 · @aribnb.tucacas · tudiaentucacas.netlify.app".

**Portada (thumbnail):** `n30-02-piscina.jpg` con "Tu día en Tucacas empieza aquí" y el logo.

---

## 8. Textos para publicar el video

**Instagram / TikTok:**

```
Tu día en Tucacas empieza aquí 🌴☀️
Apartamento para 7 personas en Pescadores I, a 5 min de los muelles para ir a los cayos de Morrocoy.
✔️ A/A en todo el apartamento ✔️ WiFi de fibra ✔️ Tanque de agua propio ✔️ Piscina con tobogán
📲 Reserva por WhatsApp: +58 424-270-3482
🔗 tudiaentucacas.netlify.app

#Tucacas #Morrocoy #CayoSombrero #Falcón #Venezuela #PlayasDeVenezuela #AlquilerVacacional #ViajaEnFamilia
```

---

## 9. Pendientes del usuario

- [ ] Confirmar el precio que se puede mostrar (o no mostrar precio).
- [ ] Enlace de TikTok.
- [ ] Si tiene fotos mejores que las de `public/fotos/` o tomas propias (sección 3), compartirlas.
- [ ] Aprobar la voz antes de montar el video completo.
