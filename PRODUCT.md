# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, with the user's two constraints: hosted on **Netlify**, data in **Supabase** (Auth + Postgres with Row-Level Security). Chosen: Vite + React + TypeScript single-page app, Netlify Functions for anything that needs a secret (AI ID reading). Without Supabase keys the app runs in a local "modo demo" that stores data in the browser.

## Users

- **Oniris Rojas** (owner, primary user). Owns apartment **N°30** in **Conjunto Residencial Pescadores I** (Tucacas, Falcón, Venezuela), managed by administradora **JDC Pescadores I**. Rents it by the night through Airbnb, Stay, Facebook Marketplace, Mercado Libre and social media / WhatsApp. Works mostly from her phone, often while chatting with guests on WhatsApp.
- **Angel** (family member, builds and co-manages the app; handles reception of inquiries).
- Later: other owners inside the same conjunto whose apartments join a shared catalog (phase 2).

## Product Purpose

Phase 1: stop losing time filling the conjunto's entry-authorization form by hand. For every new group of guests the owner must send the administradora (via WhatsApp) the official "Autorización" sheet with: up to 7 people (full name + cédula; minors without cédula go by name only), up to 2 vehicles (model, color, plate), stay type, check-in and check-out dates. Guests send photos of their cédulas, or only the numbers, by WhatsApp. The app reads names and numbers from the photos (on-device OCR, optional AI reading), fills the official sheet and hands it to WhatsApp, and keeps a running record of each stay: dates, channel, amounts, payment status, authorization status.

Success: an authorization goes from "guest sent photos" to "sent to the administradora" in under two minutes, with no retyping, and Oniris always knows who is entering, when, and what is still pending or unpaid.

Public page (main surface, built): "Tu Día en Tucacas", the N°30's own website. Shows price, amenities, photos and real availability; guests pick dates and book via WhatsApp (584242703482). If the dates are taken, it offers partner apartments of the same conjunto that are free on those dates; the partner sets a nightly price and the page sells it with a markup (example: partner $100 → offered at $120, $20 commission). The admin panel lives inside the same app at /admin.

## Positioning

Built for one specific gate: it produces the exact JDC Pescadores I authorization sheet, already filled, and knows how Venezuelan cédulas are laid out. Generic rental tools (PMS, channel managers) don't touch the conjunto's paperwork.

## Operating Context

- The official form is an Excel sheet (`assets` from the user: `Autorizacion_Pescadores_*.xlsx`, sheet "Hoja1", marlin logo, Tahoma). Fixed fields: "Yo Oniris Rojas CI: 17.571.156", "Inmueble N°30". Stay type checkboxes: Familiar / Alquiler Fijo / Alquiler Vacacional / Mantenimiento / Otros. Dates written dd-mm-yy.
- Delivery is WhatsApp to the administradora; the guards at the gate (garita) let people in from that authorization.
- Inquiries arrive from several channels at once; double bookings on the same date are a real risk.
- A demo already exists (single HTML page, Tesseract OCR + ExcelJS) at lamooont-git.github.io/Autorizaciones.

## Capabilities and Constraints

- Max 7 people and 2 vehicles per sheet (template limit).
- Cédula photos are sensitive: process them on the device, never store them.
- Spanish (Venezuela) UI, dates dd/mm/yyyy, money in USD.
- Security baseline required by the user (20 points): hidden API keys, no secrets in Git, public DB key only, RLS, encryption of sensitive data, forced auth, record-level access, field-tampering protection, protected sessions, hashed passwords, rate limiting, bot protection, parametrized queries, input validation, content sanitization, file restrictions, minimal data returned, security headers, HTTPS, dependency scanning.
- Undecided: real apartment photos (to be uploaded from the panel), partner list and their prices, whether the administradora wants PDF/image in addition to the Excel.

## Brand Commitments

- Brand: **Tu Día en Tucacas** (Instagram @aribnb.tucacas, "Alquiler por día · Airbnb"). Logo: white line art (palm, waves, sun, seagull, road) on a green-teal gradient; vectorized into `src/components/Logo.tsx`.
- Public facts confirmed from Instagram: Hospedaje Pescadores, a minutos de la playa, WiFi, seguridad, agua, piscina, áreas recreativas; groups up to 7; $90/night and weekday promo 3 días 2 noches $165 (editable in the panel).
- The user asked for phone-first, more dynamic UI, and rejected the stencil numerals and the scalloped blue header of v1.

- Name of the conjunto and administradora as written on the form: "JDC Pescadores I", "Conjunto Residencial Pescadores I".
- The marlin logo from the official form is the conjunto's mark, not the app's brand.

## Evidence on Hand

- Official template: uploaded `Autorizacion_Pescadores_11-10-26.xlsx`.
- Prior demo source (reference only).
- No real reservation data, prices or reviews were provided; anything shown in demo mode is synthetic and labelled so.

## Product Principles

1. Two minutes from WhatsApp photos to sent authorization.
2. The machine reads, the owner confirms: every auto-filled value is reviewable before it leaves.
3. Sensitive data stays minimal: no stored ID photos, only what the gate needs.
4. Phone first, one hand, outdoors in bright light.
5. Everything pending is visible at a glance: unsent authorizations, unpaid balances, overlapping dates.

## Accessibility & Inclusion

Owner is not a technical user; large tap targets, plain Spanish, high contrast for outdoor use.
