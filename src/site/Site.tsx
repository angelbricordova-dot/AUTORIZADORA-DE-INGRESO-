// Sitio público: inicio (lobby) en "/" y una página por apartamento en "/apartamento/:numero".
import { useEffect, useState } from 'react';
import { store } from '../lib/store';
import type { PublicData } from '../lib/types';
import { addDays, todayISO } from '../lib/dates';
import { whatsappUrl } from '../lib/publicAvailability';
import { useLocation } from '../router';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useReveal } from './useReveal';
import { Lobby } from './Lobby';
import { ApartmentPage } from './Apartment';
import { SurveyPage } from './Survey';
import { slugUnit } from './parts';
import './site.css';

function usePublicData() {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const today = todayISO();
    store
      .loadPublic(today, addDays(today, 370))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

export function Site() {
  const { pathname, search } = useLocation();
  const { data, error } = usePublicData();
  const own = data?.listings.find((l) => l.kind === 'propio') ?? data?.listings[0];
  const phone = own?.contact_whatsapp ?? '';
  const m = pathname.match(/^\/apartamento\/([^/]+)\/?$/);
  const slug = m ? decodeURIComponent(m[1]) : null;
  const listing = slug && data ? data.listings.find((l) => slugUnit(l.unit) === slug) : undefined;
  const page = pathname === '/' || pathname === '' ? 'lobby' : slug ? 'apto' : /^\/opinion\/?$/.test(pathname) ? 'opinion' : 'none';
  useReveal();

  useEffect(() => {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow');
  }, []);

  return (
    <div className={`site site-${page}`}>
      <header className="site-top">
        <a className="brand" href="/" aria-label="Tu Día en Tucacas, inicio">
          <span className="brand-mark">
            <LogoMark />
          </span>
          <span className="brand-text">
            <span className="brand-name">Tu Día en Tucacas</span>
            <span className="brand-sub">Alquiler por día · Pescadores I</span>
          </span>
        </a>
        <span className="site-top-actions">
          <ThemeToggle />
          {phone ? (
            <a
              className="icon-btn wa"
              href={whatsappUrl(phone, 'Hola, quiero información sobre los apartamentos en Tucacas.')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escribir por WhatsApp"
            >
              <Icon name="send" />
            </a>
          ) : null}
        </span>
      </header>

      {error ? (
        <div className="site-main">
          <div className="notice notice-bad" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <div className="page-swap" key={page + (slug ?? '')}>
        {page === 'lobby' ? <Lobby data={data} own={own} phone={phone} /> : null}
        {page === 'opinion' ? <SurveyPage data={data} own={own} phone={phone} query={new URLSearchParams(search)} /> : null}
        {page === 'apto' && listing && data ? <ApartmentPage key={listing.id} l={listing} data={data} phone={phone} query={new URLSearchParams(search)} /> : null}
        {page === 'apto' && !data && !error ? (
          <div className="site-main">
            <div className="skeleton" style={{ height: 480 }} />
          </div>
        ) : null}
        {(page === 'none' || (page === 'apto' && data && !listing)) && !error ? <NotFound /> : null}
      </div>

      <footer className="site-footer">
        <LogoMark className="footer-art" />
        <p className="footer-title">Tu Día en Tucacas</p>
        <div className="row-wrap footer-links">
          {phone ? (
            <a className="btn btn-whatsapp btn-small" href={whatsappUrl(phone, 'Hola, quiero información para alquilar en Tucacas.')} target="_blank" rel="noopener noreferrer">
              <Icon name="send" /> WhatsApp
            </a>
          ) : null}
          {own?.instagram_url ? (
            <a className="btn btn-soft btn-small" href={own.instagram_url} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          ) : null}
          {own?.tiktok_url ? (
            <a className="btn btn-soft btn-small" href={own.tiktok_url} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
          ) : null}
          {own?.airbnb_url ? (
            <a className="btn btn-soft btn-small" href={own.airbnb_url} target="_blank" rel="noopener noreferrer">
              Ver en Airbnb
            </a>
          ) : null}
        </div>
        <p className="tiny muted">© {new Date().getFullYear()} Tu Día en Tucacas · Tucacas, Falcón, Venezuela</p>
        <a className="admin-link tiny" href="/admin" target="_self">
          <Icon name="key" /> Acceso administración
        </a>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <main className="site-main">
      <section className="site-section">
        <h1>No encontramos esa página</h1>
        <p className="muted">Puede que el apartamento ya no esté publicado.</p>
        <a className="btn btn-primary" href="/">
          Ir al inicio
        </a>
      </section>
    </main>
  );
}
