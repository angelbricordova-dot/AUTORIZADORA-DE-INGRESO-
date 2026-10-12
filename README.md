# Tu Día en Tucacas

Página web del apartamento **N°30** del Conjunto Residencial **Pescadores I** (Tucacas) con un **panel de administración** para Oniris dentro de la misma app.

- **`/` — inicio público** (pensado para el teléfono): presenta la marca, busca fechas en **todos** los apartamentos a la vez, muestra el N°30 destacado y los aliados, cómo reservar, Tucacas y contacto por WhatsApp.
- **`/apartamento/30`, `/apartamento/12`… — una página por apartamento**: fotos, precio, servicios, calendario con las noches libres y ocupadas, y botón para **reservar por WhatsApp** con las fechas y personas ya escritas. Si esas fechas están ocupadas, muestra **otros apartamentos del conjunto libres en esas fechas** para no perder al cliente.
- **Modo día y modo noche** en todo el sitio y el panel (sigue al teléfono; el botón sol/luna lo cambia con una transición circular y lo recuerda).
- **`/admin` — panel** (con login; se entra desde "Acceso administración" al pie de la página o directo en `/admin`). Se puede **instalar como aplicación** (Más → Instalar el panel como aplicación): el ícono abre directo en el panel, no en la página pública.
- **Panel:** autorizaciones de ingreso, calendario, estadías, pagos, apartamentos aliados con su comisión y el panel de **Zuleika**.
- **Zuleika** entra en la misma dirección `/admin` con su propio usuario y ve **solo su panel de trabajo**: entradas y salidas, limpieza, llaves, lencería, garantías y el efectivo que guarda. Nunca ve cédulas, placas, notas ni lo que cobran los aliados.

## Qué hace el panel

- **Nueva autorización en dos pasos**: fechas y cédulas. Nada más. La estadía se crea sola con el nombre de la primera persona; canal, pago y notas quedan opcionales para después.
- **Lectura de cédulas**: varias fotos a la vez, **o dos cédulas en una misma foto** (apiladas o lado a lado). En el teléfono, gratis y privado; o con IA si configuras la API key.
- **Lectura de vehículos con IA**: una foto del carro, de la placa o del carnet de circulación llena **marca, modelo, color y placa**. Si la IA no ve la placa, se intenta leer en el teléfono; y siempre se puede escribir a mano.
- **Pegar el texto de WhatsApp** ("1. Juan Pérez V-12.345.678…") y se reparte solo en personas y vehículo.
- **Planilla oficial** de JDC Pescadores I rellena (Excel original con logo) y enviada por WhatsApp a la administradora.
- **Apartamentos aliados**: precio público, lo que cobra el dueño y **tu comisión por noche** calculada sola; fotos subidas desde el teléfono; publicar u ocultar.
- **Pagos por estadía**: cada pago con su método (efectivo $, pago móvil, transferencia, Zelle, Binance, efectivo Bs, punto de venta) y quién lo recibió. El "pagado" es la suma de los pagos.
- **Zuleika** (Inicio → tarjeta "Zuleika guarda…" o Más → Zuleika):
  - tareas de cada entrada y salida: limpieza antes y después, entregar llaves, cobrar el saldo, lavar sábanas y toallas;
  - **garantía** ($100 por defecto): se marca al recibirla y al devolverla después de revisar el apartamento; si se retiene algo por daños, se anota qué pasó y ese monto pasa a la caja;
  - **caja de efectivo**: cuánto dinero en dólares te tiene guardado, con el historial, sus gastos (detergente, bombillos…) y tus retiros; avisa cuando llega al monto que elijas (300 $ por defecto) para que valga la pena ir a retirarlo;
  - "Su vista": cómo lo ve ella en su teléfono.
- **Inicio**: qué pasa hoy en el N°30, cuánto guarda Zuleika, próximas noches, pendientes (choques de fechas, autorizaciones sin enviar, saldos por cobrar) y comisiones del mes.

## Página pública

- Inicio con el logo que se dibuja solo, olas en movimiento, buscador de fechas, apartamento destacado, pasos para reservar y Tucacas.
- Fotos reales del N°30 (portada deslizable, mosaico y fotos a pantalla completa), descripción, habitaciones, camas y baños.
- "Lo que incluye" muestra 3 servicios y el resto se despliega.
- Al pie: WhatsApp, Instagram, TikTok (se carga en Más → Apartamentos y catálogo → Tu apartamento → Contacto y redes) y Airbnb.
- El N°30 aparece siempre primero y destacado, también al buscar fechas.
- **Opiniones** (reemplaza el Google Form): en `/opinion` el huésped responde las mismas preguntas de antes (noches, limpieza, camas, A/C, cocina, WiFi, comunicación, recomendación del 1 al 10, qué le gustó, qué mejoraría y permiso para usarlo como testimonio). Lo que mejoraría es privado. Lo que más le gustó se publica en la página solo si dio permiso y alguien del panel la aprueba (Más → Opiniones de huéspedes). Si quedó muy contento y cargaste el enlace de tu perfil de Google, al final se le invita a dejar la opinión también en Google.
- Las respuestas viejas del Google Form se importan en **Más → Opiniones de huéspedes → Importar del formulario anterior** (CSV de Google Sheets).
- Calendario con noches libres y ocupadas, precio total y **reservar por WhatsApp**.
- **Más de 7 personas**: primero ofrece **consultar una excepción por WhatsApp** (con cuántos son niños); debajo, otros apartamentos del conjunto para el grupo.

## Probarlo ya (modo demo)

Sin configurar nada, la app arranca en **modo demo**: datos de ejemplo inventados, todo guardado en ese navegador. Sirve para ver cómo funciona.

```bash
npm install
npm run dev
```

## Publicarlo en Netlify

1. Sube este repositorio a GitHub (ya lo está).
2. En Netlify: **Add new site → Import an existing project →** elige el repo. Netlify lee `netlify.toml`, así que no hace falta tocar nada más (build `npm run build`, carpeta `dist`).
3. Listo: queda en modo demo hasta que conectes Supabase.

### Conectar la base de datos (Supabase)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. **SQL Editor →** pega y ejecuta, **en este orden**, cada archivo de `supabase/migrations/`:
   1. `20261011000000_esquema_inicial.sql` (reservas, autorizaciones, seguridad)
   2. `20261012000000_sitio_publico.sql` (página pública y catálogo de aliados)
   3. `20261012000100_fotos_storage.sql` (fotos de los apartamentos)
   4. `20261013000000_equipo_pagos.sql` (pagos, Zuleika, garantías, caja y fotos reales del N°30)
   5. `20261014000000_varias_administradoras.sql` (Oniris, Angélica y tú en el mismo panel)
   6. `20261015000000_tiktok.sql` (enlace de TikTok en la página)
   7. `20261016000000_resenas.sql` (encuesta de la estadía y reseñas en la página)

   Si ya ejecutaste los anteriores, solo corre el que falta. Los pagos que ya tenías anotados se conservan como "Registrado antes del detalle de pagos".
3. **Authentication → Sign In / Providers → Email:** desactiva **"Allow new users to sign up"** (nadie puede registrarse por su cuenta).
4. **Authentication → Users → Add user:** crea la cuenta de Oniris (y la tuya) con una contraseña de al menos 12 caracteres.
5. Opcional (punto 12, bots): **Authentication → Attack Protection → CAPTCHA**.
6. **Project Settings → API**: copia *Project URL* y la llave *anon public*.
7. En Netlify, **Site configuration → Environment variables**, agrega:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_URL` | lo mismo que arriba (lo usa la función de IA) |
| `SUPABASE_ANON_KEY` | lo mismo que arriba |

8. **Deploys → Trigger deploy**. Desde ahí la app pide iniciar sesión y guarda todo en Supabase.

> Nunca pongas la llave `service_role` en Netlify ni en el código.

### Activar la lectura con IA (opcional)

1. Crea una API key en [console.anthropic.com](https://console.anthropic.com).
2. En Netlify agrega `ANTHROPIC_API_KEY` (y si quieres `AI_LIMIT_PER_HOUR`, por defecto 40) y vuelve a publicar.
3. Aparece activo el botón **"Leer con IA"**. Usa Claude Opus 5.5 con esfuerzo bajo y respaldo automático del servidor si el modelo rechaza la petición. Cada foto cuesta uno o dos centavos de dólar. La foto no se guarda.

La misma API key sirve para leer **vehículos** (placa, marca, modelo y color).

### Dar acceso a otras administradoras y a Zuleika

Cada usuario de Supabase, por sí solo, tiene su **propio** panel vacío. Para que varias personas vean el mismo:

1. Supabase → **Authentication → Users → Add user**: crea el usuario con su correo y una contraseña (marca *Auto Confirm User*).
2. Entra al panel con la cuenta que **tiene los datos** y ve a **Más → Accesos al panel**. Escribe el nombre y el correo y elige:
   - **Administradora** (Oniris, Angélica): ve y maneja todo, igual que tú.
   - **Trabajo** (Zuleika): solo su panel de tareas, garantías y caja.
3. Una administradora entra en `/admin`. **Zuleika entra en `/trabajo`**: es la misma app pero con su propio ícono (una llave sobre un atardecer) y nombre ("Trabajo Tu Día"); al instalarla en su teléfono abre directo en su panel de tareas. El panel saluda a cada quien por su nombre; cada persona lo puede cambiar en **Más → Tu nombre** (no cambia el nombre de la planilla, que sigue en **Datos de la planilla**). Si ya había entrado antes y vio un panel vacío, ese panel vacío se borra al darle acceso.

Para quitar un acceso, toca la papelera junto a su nombre.

### Borrado automático de cédulas viejas (recomendado)

En Supabase **Database → Extensions** activa `pg_cron` y ejecuta:

```sql
select cron.schedule('purga-huespedes', '15 4 * * *', $$select public.purge_old_guest_data(60)$$);
```

Borra cédulas y placas de estadías que terminaron hace más de 60 días. Las estadías y los montos se conservan.

### Fotos del apartamento

Las 12 fotos actuales del N°30 vienen incluidas en el sitio (`public/fotos/`) y la migración 4 las asigna. Venían como miniaturas de Airbnb (240 px); se ampliaron 4× con un modelo de IA (ESRGAN) para que se vean mejor, pero **la calidad real llega subiendo las originales** desde la galería del teléfono.

En el panel: **Más → Apartamentos y catálogo → Tu apartamento → Fotos → +**. Puedes elegir varias a la vez desde el teléfono; se reducen y se les borra la ubicación antes de subirlas. La primera es la portada de la página. Ahí mismo cambias precio, promoción, servicios, WhatsApp de reservas y enlaces de Airbnb e Instagram.

### Agregar un apartamento aliado

**Más → Apartamentos y catálogo → Agregar apartamento aliado**: número, personas, **precio público** y **lo que cobra el dueño** (la diferencia es tu comisión), fotos y "Publicado". Para marcar sus noches ocupadas, registra estadías eligiendo ese apartamento (la página pública solo muestra que está ocupado, nunca quién).

## Seguridad

Los 20 puntos de la lista, uno por uno, están en **[SEGURIDAD.md](SEGURIDAD.md)**.

## Desarrollo

```bash
npm run dev          # servidor local
npm test             # pruebas unitarias (parsers, Excel, validaciones)
npm run test:db      # RLS y reglas de la base en un Postgres local desechable
npm run build        # build de producción (falla si hay secretos en el repo)
npm run test:e2e     # Playwright sobre el build real con la CSP de Netlify
```

```
src/
  site/         página pública (portada, calendario de fechas, catálogo, WhatsApp)
  pages/        panel: Inicio, Calendario, Estadías, Autorización, Apartamentos, Zuleika, Más, Login
  StaffApp.tsx  lo que ve Zuleika al entrar con su usuario
  components/   logo, barras de estadía, tira de noches, calendario, hoja inferior, íconos
  lib/          cédulas y placas, Excel, disponibilidad, OCR, IA, compartir
  lib/store/    modo demo (navegador) y Supabase, con la misma interfaz
  assets/       plantilla-pescadores.xlsx (la planilla oficial, limpia)
netlify/        función leer-cedula (IA) y su validación
supabase/       esquema SQL con RLS
tests/          e2e (Playwright), base de datos, servidor con cabeceras reales
```

Diseño: ver `DESIGN.md` y `PRODUCT.md`.
