import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { store, supabaseConfigured, type AppData } from './lib/store';
import { getSupabase } from './lib/store/supabase';
import { aiStatus } from './lib/ai';
import { formatLong, todayISO } from './lib/dates';
import { pendingItems } from './lib/availability';
import { Ctx, type AppCtx } from './context';
import { href, useRoute } from './router';
import { Icon, type IconName } from './components/Icon';
import { Strip } from './components/Strip';
import { HomePage } from './pages/Home';
import { CalendarPage } from './pages/Calendar';
import { ReservationsPage } from './pages/Reservations';
import { ReservationForm } from './pages/ReservationForm';
import { AuthorizationPage, PickStayPage } from './pages/Authorization';
import { SettingsPage } from './pages/Settings';
import { LoginPage } from './pages/Login';

const TABS: { to: string; label: string; icon: IconName; match: string[] }[] = [
  { to: '/', label: 'Inicio', icon: 'home', match: [''] },
  { to: '/calendario', label: 'Calendario', icon: 'calendar', match: ['calendario'] },
  { to: '/reservas', label: 'Estadías', icon: 'list', match: ['reservas', 'reserva'] },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings', match: ['ajustes'] },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) return <Splash />;
  if (supabaseConfigured && !session) return <LoginPage />;
  return <Shell key={session?.user.id ?? 'demo'} />;
}

function Splash() {
  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand-name">Pescadores I</span>
        </div>
      </header>
    </div>
  );
}

function Shell() {
  const route = useRoute();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const today = todayISO();

  const reload = useCallback(async () => {
    try {
      setData(await store.load());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    if (supabaseConfigured) aiStatus().then((s) => setAiEnabled(s.enabled));
  }, [reload]);

  const ctx = useMemo<AppCtx | null>(
    () =>
      data
        ? {
            data,
            store,
            today,
            reload,
            aiEnabled,
            getAccessToken: async () => {
              if (!supabaseConfigured) return null;
              const { data: s } = await getSupabase().auth.getSession();
              return s.session?.access_token ?? null;
            },
            signOut: supabaseConfigured
              ? async () => {
                  await getSupabase().auth.signOut();
                }
              : undefined,
          }
        : null,
    [data, today, reload, aiEnabled],
  );

  const [first = ''] = route.path;
  const pending = data ? pendingItems(data.reservations, today).filter((i) => i.urgent || i.kind === 'conflicto').length : 0;

  let page: React.ReactNode = null;
  if (ctx) {
    if (first === '') page = <HomePage />;
    else if (first === 'calendario') page = <CalendarPage query={route.query} />;
    else if (first === 'reservas') page = <ReservationsPage query={route.query} />;
    else if (first === 'reserva') page = <ReservationForm id={route.path[1] === 'nueva' ? undefined : route.path[1]} query={route.query} />;
    else if (first === 'autorizacion' && route.path[1]) page = <AuthorizationPage id={route.path[1]} />;
    else if (first === 'autorizacion') page = <PickStayPage />;
    else if (first === 'ajustes') page = <SettingsPage />;
    else page = <NotFound />;
  }

  const showDock = first === '' || first === 'calendario' || first === 'reservas';

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-row">
          <a className="brand" href={href('/')} style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="brand-name">{data?.settings.conjunto ?? 'Pescadores I'}</span>
            <span className="brand-unit">N°{data?.settings.unit ?? '30'}</span>
          </a>
          {store.mode === 'demo' ? (
            <span className="demo-pill" title="Los datos se guardan solo en este teléfono">
              Modo demo
            </span>
          ) : (
            <span className="masthead-date">{formatLong(today)}</span>
          )}
        </div>
        {first === '' && data ? <Strip reservations={data.reservations} today={today} /> : <div style={{ height: 12 }} />}
      </header>

      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((t) => (
          <a key={t.to} className="tab" href={href(t.to)} aria-current={t.match.includes(first) ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
            {t.to === '/' && pending > 0 ? <span className="tab-badge" aria-label={`${pending} pendientes urgentes`}>{pending}</span> : null}
          </a>
        ))}
        <a className="btn btn-primary rail-cta" href={href('/autorizacion')}>
          <Icon name="idcard" /> Nueva autorización
        </a>
      </nav>

      <main className="body" id="contenido">
        {error ? (
          <div className="notice notice-bad" role="alert">
            <Icon name="alert" />
            <div className="stack" style={{ gap: 8 }}>
              <span>{error}</span>
              <button className="btn btn-secondary btn-small" onClick={reload}>
                Reintentar
              </button>
            </div>
          </div>
        ) : null}
        {ctx ? <Ctx.Provider value={ctx}>{page}</Ctx.Provider> : !error ? <Loading /> : null}
        {ctx && showDock ? (
          <div className="primary-dock">
            <a className="btn btn-primary btn-block" href={href('/autorizacion')}>
              <Icon name="idcard" /> Nueva autorización
            </a>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Cargando">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Esta página no existe</h1>
      <a className="btn btn-secondary" href={href('/')}>
        Volver al inicio
      </a>
    </div>
  );
}
