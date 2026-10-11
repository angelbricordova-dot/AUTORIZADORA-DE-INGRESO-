# Pescadores I · Autorizaciones

Panel para Oniris (apartamento **N°30**, Conjunto Residencial **JDC Pescadores I**, Tucacas): convierte las fotos de cédulas o el texto que mandan los huéspedes por WhatsApp en la **planilla oficial de autorización** ya rellena, lista para enviarla a la administradora. Además lleva el control de cada estadía: fechas, canal, cobros, choques de fechas y autorizaciones pendientes.

> Fase 1 (esta): autorizaciones + panel de estadías.
> Fase 2 (siguiente): catálogo de apartamentos aliados con sobreprecio (ej. $100 → $120).

## Qué hace

- **Inicio**: las próximas 14 noches dibujadas como toldos (cada estadía con el color de su canal) y la lista de **pendientes**: fechas que chocan, autorizaciones sin enviar y saldos por cobrar.
- **Autorización**:
  - **Sube las fotos de las cédulas** (varias a la vez). Las lee el teléfono, gratis y sin que la foto salga del equipo. Opcional: **lectura con IA**, más precisa.
  - **Pega el mensaje de WhatsApp** ("1. Juan Pérez V-12.345.678…") y se reparte solo en personas y vehículo.
  - Para menores sin cédula basta el nombre. Máximo 7 personas y 2 vehículos, como en la planilla.
  - **Enviar a la administradora**: genera el Excel oficial (con el logo y el formato original) y abre el menú de compartir del teléfono para elegir WhatsApp. En computadora lo descarga y abre el chat de la administradora con el mensaje listo.
- **Calendario**: el mes completo con los toldos, en arena las noches libres y una lista de rangos libres para responder rápido si hay disponibilidad.
- **Estadías**: registro con canal (Airbnb, Stay, Marketplace, Mercado Libre, Instagram, WhatsApp, directo), estado (confirmada/tentativa/cancelada), total y pagado.

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
2. **SQL Editor →** pega y ejecuta `supabase/migrations/20261011000000_esquema_inicial.sql`.
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

### Borrado automático de cédulas viejas (recomendado)

En Supabase **Database → Extensions** activa `pg_cron` y ejecuta:

```sql
select cron.schedule('purga-huespedes', '15 4 * * *', $$select public.purge_old_guest_data(60)$$);
```

Borra cédulas y placas de estadías que terminaron hace más de 60 días. Las estadías y los montos se conservan.

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
  pages/        Inicio, Calendario, Estadías, Estadía, Autorización, Ajustes, Login
  components/   Toldo, tira de 14 noches, calendario, íconos
  lib/          cédulas y placas, Excel, disponibilidad, OCR, IA, compartir
  lib/store/    modo demo (navegador) y Supabase, con la misma interfaz
  assets/       plantilla-pescadores.xlsx (la planilla oficial, limpia)
netlify/        función leer-cedula (IA) y su validación
supabase/       esquema SQL con RLS
tests/          e2e (Playwright), base de datos, servidor con cabeceras reales
```

Diseño: ver `DESIGN.md` ("Toldos de los cayos") y `PRODUCT.md`.
