---
name: Tu Día en Tucacas
description: Página del apartamento N°30 en Pescadores I y panel de autorizaciones, pensado primero para el teléfono.
colors:
  brand: "#1d7f68"
  brand-2: "#14706c"
  brand-deep: "#0e4f4a"
  brand-ink: "#0b3a36"
  brand-soft: "#e2f2ec"
  brand-softer: "#f0f8f5"
  sea: "#17a3a0"
  sun: "#f4b63f"
  sun-soft: "#fdf1d6"
  sun-ink: "#6d4a00"
  coral: "#d8613c"
  ground: "#f4f7f6"
  surface: "#ffffff"
  surface-2: "#edf3f1"
  line: "#dde7e4"
  line-strong: "#bfd0cb"
  ink: "#0f2724"
  ink-2: "#33504b"
  muted: "#56706b"
  ok: "#157046"
  warn: "#965006"
  bad: "#b42318"
  ch-airbnb: "#e0584b"
  ch-stay: "#6a4bc4"
  ch-marketplace: "#1d6fd1"
  ch-mercadolibre: "#f1c40f"
  ch-instagram: "#c23a86"
  ch-whatsapp: "#18924f"
  ch-directo: "#14706c"
  ch-otro: "#5d6b74"
typography:
  display-hero:
    fontFamily: "Bricolage Grotesque Variable, Onest Variable, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 10vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  heading-1:
    fontFamily: "Bricolage Grotesque Variable, Onest Variable, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  heading-2:
    fontFamily: "Bricolage Grotesque Variable, Onest Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.12
  number:
    fontFamily: "Bricolage Grotesque Variable, Onest Variable, system-ui, sans-serif"
    fontWeight: 750
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Onest Variable, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Onest Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
rounded:
  sm: "12px"
  button: "14px"
  md: "16px"
  lg: "22px"
  hero: "28px"
  pill: "999px"
spacing:
  gutter: "16px"
  group: "12px"
  section: "26px"
  tap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "50px"
  button-whatsapp:
    backgroundColor: "{colors.ch-whatsapp}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "50px"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.button}"
  button-soft:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.sm}"
  chip-selected:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "40px"
  fab:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    size: "58px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "50px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

## Overview

The brand comes from the owners' own logo: white line art (palm, waves, sun, seagull, a winding road) on a green-to-teal gradient. Everything is built for the phone first, outdoors in Tucacas sunlight: light theme, large tap targets, primary actions within thumb reach. Two surfaces share one system: the public page (persuade: get a booking on WhatsApp) and the admin panel (operate: authorizations and stays in two taps).

## Colors

- **Brand gradient** `#1d7f68 → #14706c → #0e4f4a` owns the hero, the "today" card, the brand mark, the floating action button and primary buttons.
- **Ground** `#f4f7f6` is a cool mint-white; panels are pure white on it.
- **Sun** `#f4b63f` marks the one thing to tap on the hero ("Ver disponibilidad"), promotions and commissions.
- **Coral** `#d8613c` only marks occupied nights (diagonal hatch + strikethrough) on the public calendar.
- **Channel colors** identify where a stay came from (bars in the calendar, dots, list flags). Never decorative.
- States (ok / warn / bad) only where they carry meaning: sent, pending, conflicts.

## Typography

Bricolage Grotesque (variable, self-hosted) for headings and every number that matters (prices, dates, stats, counters): heavy, slightly condensed, with character. Onest (variable, self-hosted) for all running text, labels, inputs and buttons. Tabular numerals everywhere.

## Layout

Single column, 560px max, 16px gutters. Admin: sticky translucent top bar, bottom tab bar with a raised central "+" (new authorization), sticky action bar inside flows, bottom sheets for secondary choices. Public: sticky header, full-bleed rounded hero, sections separated by 34px, a fixed booking bar with price and the next action.

## Elevation & Depth

Soft two-layer shadows only (`--shadow` for panels, `--shadow-lift` for floating bars and sheets). Colored glows only under brand/WhatsApp buttons and the FAB. No zero-blur offset shadows.

## Shapes

Rounded and friendly: inputs 12px, buttons 14px, panels 16px, hero and today card 22–28px, chips and badges are pills. Stay bars are 9px pills; a cut edge (stay continuing outside the visible range) loses its radius on that side.

## Components

- **Stay bar** (`.stay`): channel color, from the afternoon of check-in to the morning of check-out on a half-day grid, so same-day turnover shares a lane. Tentative = tinted with diagonal hatch; conflict = red outline + alert icon.
- **Range calendar** (public): tap check-in, then check-out; selection is a brand capsule; busy nights hatched in coral and struck through.
- **Dropzone** for ID photos with a camera tile; "Revisa lo leído" badge on every machine-read row until edited.
- **Chips** for single and multi choice (channel, status, property, amenities), horizontally scrollable on the phone.
- **Switch** for publish / hide; **stepper** for guests (and for "¿cuántos son niños?" when a group is larger than the apartment).
- **Cash card** (`.cash-card`): deep brand gradient, the cash Zuleika holds as the big number, a thin meter toward the "worth collecting" threshold that turns sun-yellow when reached; actions are a sun button (withdraw) and a glass button (expense).
- **Ops card** (`.ops-card`): one arrival ("Llega", brand pill) or departure ("Se va", sun pill) with a done count and a checklist of 52px task rows; each row is a `role="checkbox"` button whose icon box fills green when done. Phone call strip at the bottom.
- **Lobby** (public `/`): tall brand-gradient hero with the drawn logo, headline "Tu día en Tucacas empieza aquí", date search card (dates in a bottom sheet, all apartments at once), featured N°30 card with a slow Ken Burns photo, 3 numbered steps, Tucacas cards and a WhatsApp contact card.
- **Photo mosaic + lightbox** (public): one wide tile and four small ones, the last showing "+N"; tapping any photo opens a full-screen swipeable viewer with a counter. The hero carousel shows a "1 / 12" pill.

## Do's and Don'ts

- Do keep the brand gradient for the hero moments (hero, today card, FAB, brand mark); everything else is white or ground.
- Do show every machine-read value as editable and flagged for review.
- Do keep guest data out of the public page: only free/busy nights are public.
- Do keep Zuleika's view to work data only: dates, contact, people count, amount to collect.
- Don't put eyebrows above headings or use offset block shadows.
- Don't use the display face for long text.
- Dark theme ("noche en Tucacas"): follows the phone by default, toggled with the sun/moon button; switching reveals the new theme as a circle growing from the button (View Transitions), with a cross-fade fallback. Brand gradient cards (hero, today card, cash card) stay the same in both themes; text on soft brand backgrounds uses `--brand-text`.
- Motion: the lobby logo draws itself stroke by stroke and then fills; sun rises; waves loop slowly; highlights marquee; sections rise in as they enter the viewport; prices count up; amenities expand with a staggered reveal. Everything stops under `prefers-reduced-motion`.
