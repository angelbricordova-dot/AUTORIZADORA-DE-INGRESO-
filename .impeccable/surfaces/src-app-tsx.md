---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

## Scope

Whole app shell for the owner (Operate mode): Inicio (today + pending), Calendario, Reservas, Autorización (core flow), Ajustes. Phone-first; desktop gets a side rail.

## Audience and job

Oniris, outdoors or at home, phone in one hand, WhatsApp open in the other app. Job: turn guest photos/numbers into the official JDC Pescadores I authorization and send it; know at a glance who enters when, what is unpaid, what is unsent, and whether dates collide.

## Direction contract

THESIS: Reservations are rented toldos. The calendar is a row of nights on the sand; each booking is a striped canvas awning stretched over its nights, coloured by the channel it came from. Refuses the category default of grey table + one accent and the dot-per-day calendar.

OWN-WORLD: Sunlit white ground (#F4F8F8 family, never cream), deep lona-blue shell header (#1B3FB5 family) with a thin white/blue stripe hem, sand (#EADFC8 family) only for free nights. Channel canvases: Airbnb coral, Marketplace blue, Mercado Libre yellow, Stay violet, WhatsApp/Directo green, Instagram magenta, each rendered as 45° canvas stripes with white. One workhorse sans (system UI stack, tabular numerals); stencil-like heavy numerals only for the calendar day numbers. Rounded 14px surfaces, soft offset shadows, 48px tap targets.

STORY: She opens the app, sees today's entry/exit and anything red or amber (unsent authorization, unpaid balance, overlap). She taps a stay, snaps or picks cédula photos, confirms the read names, and shares the filled Excel to the administradora on WhatsApp. Status turns to "Enviada".

FIRST VIEWPORT: Blue header with app name "Pescadores I · N°30" and today's date; under it a horizontal 14-night strip (the signature) with awnings over booked nights; below, the "Pendiente" list (unsent authorizations, balances) as tappable rows; primary action "Nueva autorización" pinned bottom on phone. Bottom tab bar on phone, side rail on desktop.

FORM: Toldos de los cayos, candidate 5 of 7 on own ordered list (1 peñeros, 2 sello de garita, 3 tabla de mareas, 4 rótulos de posada, 5 toldos de los cayos, 6 guilloché de cédula, 7 póster de torneo de pesca). Seed key 3ef2a0cc (degraded roll, no challengers).

Signature interaction: awnings stretch over their nights; overlapping awnings flag the collision in red with the conflicting stays named.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Phase 2 partner catalog (commission rules) not designed yet.
