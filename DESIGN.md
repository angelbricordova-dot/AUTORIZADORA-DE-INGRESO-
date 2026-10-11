---
name: Pescadores I · Autorizaciones
description: Toldos de los cayos — panel de estadías y autorizaciones de ingreso para el N°30.
colors:
  ground: "#f3f7f7"
  surface: "#ffffff"
  surface-2: "#eaf1f2"
  line: "#d9e3e5"
  line-strong: "#b9c8cc"
  ink: "#0f1f29"
  ink-2: "#33444f"
  muted: "#52636d"
  lona: "#1b3fb5"
  lona-ink: "#11297a"
  lona-soft: "#e5ebfb"
  lona-on: "#ffffff"
  lona-on-2: "#cfdaff"
  sand: "#ece2cb"
  ok: "#13703a"
  ok-soft: "#e3f3e9"
  warn: "#9a4a06"
  warn-soft: "#fcefd9"
  bad: "#b42318"
  bad-soft: "#fdeceb"
  ch-airbnb: "#c63b2f"
  ch-stay: "#6a3dc2"
  ch-marketplace: "#0d63c4"
  ch-mercadolibre: "#f1c40f"
  ch-mercadolibre-ink: "#2b2200"
  ch-instagram: "#b1287a"
  ch-whatsapp: "#127a45"
  ch-directo: "#0e6b70"
  ch-otro: "#56616d"
typography:
  heading-1:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading-2:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.3
  stencil-number:
    fontFamily: "Big Shoulders Stencil Display, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1
rounded:
  awning: "7px"
  sm: "10px"
  button: "12px"
  md: "14px"
  pill: "999px"
spacing:
  gutter: "16px"
  group: "12px"
  section: "28px"
  tap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.lona}"
    textColor: "{colors.lona-on}"
    rounded: "{rounded.button}"
    height: "48px"
    padding: "0 18px"
  button-whatsapp:
    backgroundColor: "{colors.ch-whatsapp}"
    textColor: "{colors.lona-on}"
    rounded: "{rounded.button}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.lona}"
    textColor: "{colors.lona-on}"
    rounded: "{rounded.pill}"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "48px"
  masthead:
    backgroundColor: "{colors.lona}"
    textColor: "{colors.lona-on}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

## Overview

**Toldos de los cayos.** Each stay is a striped canvas awning stretched over the nights it occupies, like the rows of rented sombrillas at Cayo Sombrero. The working screens stay plain and familiar (tab bar on the phone, side rail on desktop, lists, standard inputs); the world only lends four things: the lona-blue masthead with its scalloped hem, the channel-coloured striped awnings, sand for free nights, and stencil numerals for day numbers. Light only: Oniris uses it outdoors in Tucacas sunlight.

## Colors

- **Ground** `#f3f7f7` is a cool sunlit white, never cream. Panels are pure white on it.
- **Lona** `#1b3fb5` owns the masthead, primary actions, selection and focus. It is the one committed field colour.
- **Sand** `#ece2cb` means "free night" and nothing else (calendar cells, occupancy track).
- **Channel canvases** colour every awning and the stripe flag on list rows: Airbnb coral, Stay violet, Marketplace blue, Mercado Libre yellow (dark ink on it), Instagram magenta, WhatsApp green, Directo teal, Otro slate. Text on them is white except Mercado Libre.
- **States** sit on top only where they carry meaning: bad red for date conflicts and invalid data, warn amber for unsent authorizations and balances due, ok green for sent / paid.

## Typography

One workhorse system sans for everything readable, tabular numerals everywhere. Big Shoulders Stencil Display (self-hosted, weight 800) is reserved for numerals that behave like painted umbrella numbers: calendar day numbers, the strip's dates, the unit number in the masthead, row numbers in the authorization sheet. Never for words, labels or buttons.

## Layout

Phone first at 390px with a 16px gutter: masthead, content column, fixed bottom tab bar (64px + safe area) and the primary "Nueva autorización" docked above it. From 900px the tab bar becomes a left rail (232px) holding the primary action, and content sits beside it at 34px padding. Sections are separated by 28px; groups inside by 12–14px. Tap targets are at least 44px, primary controls 48px.

## Elevation & Depth

Two soft shadows only: `--shadow` for panels and `--shadow-lift` for floating bars, hovered awnings and toasts. Awnings carry their own short drop shadow so they read as canvas above the sand. No zero-blur offset shadows.

## Shapes

Panels 14px, buttons 12px, inputs 10px, chips and badges are pills. Awnings: 7px top corners, 3px bottom, with a 9px striped band on top; a cut edge (stay continuing past the visible range) loses its radius on that side.

## Components

- **Awning** (`.awning`): link to the stay; striped band + solid body in the channel colour; tentative = faded stripes, tinted body, dashed outline; conflict = 2.5px red outline plus alert icon. Positioned on a half-day grid: from the afternoon of check-in to the morning of check-out, so same-day turnover shares a lane.
- **Strip**: next 14 nights in the masthead, the signature on Inicio.
- **List item** with a vertical stripe flag in the channel colour, title, sub line, badges, amount, chevron.
- **Person row** in the authorization: stencil number, name + cédula inputs, "Menor sin cédula" checkbox, thumbnail of the photo read, "Revisa lo leído" badge until edited.
- **Action bar**: sticky translucent panel holding the flow's primary and secondary actions.

## Do's and Don'ts

- Do keep stripes on awnings, list flags and the masthead hem only; every other surface is flat white or ground.
- Do show every machine-read value as editable with a "Revisa" badge; nothing leaves without the owner seeing it.
- Do use the channel colour only to identify the channel, never as decoration.
- Don't use the stencil face for text, labels or buttons.
- Don't add a dark theme by default; the use scene is outdoor daylight.
- Don't put eyebrows above headings or hard offset shadows on buttons.
