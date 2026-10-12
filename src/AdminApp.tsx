import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { store, supabaseConfigured, type AppData } from './lib/store';
import { getSupabase } from './lib/store/supabase';
import { ownProperty } from './lib/store/types';
import { aiStatus } from './lib/ai';
import { todayISO } from './lib/dates';
import { pendingItems } from './lib/availability';
import { Ctx, type AppCtx } from './context';
import { ADMIN, href, isWorkPath, navigate, useRoute } from './router';
import { Icon, type IconName } from './components/Icon';
import { LogoMark } from './components/Logo';
import { ThemeToggle } from './components/ThemeToggle';
import { HomePage } from './pages/Home';
import { CalendarPage } from './pages/Calendar';
import { ReservationsPage } from './pages/Reservations';
import { ReservationForm } from './pages/ReservationForm';
import { AuthorizationPage, NewAuthorizationPage } from './pages/Authorization';
import { SettingsPage } from './pages/Settings';
import { PropertiesPage, PropertyForm } from './pages/Properties';
import { MorePage } from './pages/More';
import { LoginPage } from './pages/Login';
import { StaffPreviewPage, TeamPage } from './pages/Team';
import { StaffApp } from './StaffApp';
import { AccessPage } from './pages/Access';
import { setAppIdentity } from './install';

export function AdminApp() {
  // "/trabajo" es la puerta de Zuleika: misma app, otro ícono y otro nombre en el teléfono
  const [work] = useState(() => isWorkPath(window.location.pathname));
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    document.title = work ? 'Trabajo · Tu Día en Tucacas' : 'Panel · Tu Día en Tucacas';
    // al instalar en el teléfono, que abra directo aquí (y con su propio ícono)
    setAppIdentity(work ? 'trabajo' : 'admin');
  }, [work]);

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

  if (!authReady) return <div className="app" />;
  if (supabaseConfigured && !session) return <LoginPage work={work} />;
  return <RoleGate key={session?.user.id ?? 'demo'} work={work} />;
}

/** La dueña ve el panel completo; alguien del equipo (Zuleika) solo su panel de trabajo. */
function RoleGate({ work }: { work: boolean }) {
  const [role, setRole] = useState<{ name: string } | null | undefined>(supabaseConfigured ? undefined : null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    store
      .staffRole()
      .then(setRole)
      .catch(() => setRole(null));
  }, []);
  // quien administra y entra por la puerta de trabajo, va a su panel completo
  const toAdmin = supabaseConfigured && role === null && work;
  useEffect(() => {
    if (toAdmin) navigate(ADMIN, { replace: true });
  }, [toAdmin]);
  if (role === undefined || toAdmin) return <div className="app" />;
  if (role) return <StaffApp name={role.name} />;
  // en modo demo, "/trabajo" muestra la app de Zuleika con los datos de ejemplo
  if (work) return <StaffApp name="" />;
  return <Shell />;
}

const TABS: { to: string; label: string; icon: IconName; match: string[] }[] = [
  { to: '/', label: 'Inicio', icon: 'home', match: ['', 'zuleika'] },
  { to: '/calendario', label: 'Calendario', icon: 'calendar', match: ['calendario'] },
  { to: '/reservas', label: 'Estadías', icon: 'list', match: ['reservas', 'reserva'] },
  { to: '/mas', label: 'Más', icon: 'more', match: ['mas', 'ajustes', 'apartamentos', 'apartamento', 'accesos'] },
];

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return scrolled;
}

function Shell() {
  const route = useRoute();
  const scrolled = useScrolled();
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
            ownId: ownProperty(data)?.id ?? '',
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
  const second = route.path[1];
  const urgent = data ? pendingItems(data.reservations, today).filter((i) => i.urgent || i.kind === 'conflicto').length : 0;

  let page: ReactNode = null;
  if (ctx) {
    if (first === '') page = <HomePage />;
    else if (first === 'calendario') page = <CalendarPage query={route.query} />;
    else if (first === 'reservas') page = <ReservationsPage query={route.query} />;
    else if (first === 'reserva') page = <ReservationForm key={second} id={second === 'nueva' ? undefined : second} query={route.query} />;
    else if (first === 'autorizacion' && second && second !== 'nueva') page = <AuthorizationPage id={second} />;
    else if (first === 'autorizacion') page = <NewAuthorizationPage query={route.query} />;
    else if (first === 'apartamentos') page = <PropertiesPage />;
    else if (first === 'apartamento') page = <PropertyForm key={second} id={second === 'nuevo' ? undefined : second} />;
    else if (first === 'ajustes') page = <SettingsPage />;
    else if (first === 'mas') page = <MorePage />;
    else if (first === 'accesos') page = <AccessPage />;
    else if (first === 'zuleika' && second === 'vista') page = <StaffPreviewPage />;
    else if (first === 'zuleika') page = <TeamPage />;
    else page = <NotFound />;
  }

  return (
    <div className="app">
      <header className="topbar" data-scrolled={scrolled}>
        <div className="topbar-inner">
          <a className="brand" href={href('/')}>
            <span className="brand-mark">
              <LogoMark />
            </span>
            <span className="brand-text">
              <span className="brand-name">Tu Día en Tucacas</span>
              <span className="brand-sub">Panel de administración</span>
            </span>
          </a>
          <span className="grow" />
          {store.mode === 'demo' ? (
            <span className="pill" title="Los datos se guardan solo en este teléfono">
              Demo
            </span>
          ) : null}
          <ThemeToggle className="flat" />
          <a className="icon-btn flat" href="/" aria-label="Ver la página pública">
            <Icon name="eye" />
          </a>
        </div>
      </header>

      <main className="body" id="contenido">
        {error ? (
          <div className="notice notice-bad" role="alert" style={{ marginTop: 12 }}>
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
      </main>

      <nav className="tabbar" aria-label="Secciones">
        <div className="tabbar-inner">
          {TABS.slice(0, 2).map((t) => (
            <Tab key={t.to} t={t} current={t.match.includes(first)} badge={t.to === '/' ? urgent : 0} />
          ))}
          <a className="fab" href={href('/autorizacion')} aria-label="Nueva autorización">
            <Icon name="plus" />
          </a>
          {TABS.slice(2).map((t) => (
            <Tab key={t.to} t={t} current={t.match.includes(first)} badge={0} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function Tab({ t, current, badge }: { t: (typeof TABS)[number]; current: boolean; badge: number }) {
  return (
    <a className="tab" href={href(t.to)} aria-current={current ? 'page' : undefined}>
      <span className="tab-icon">
        <Icon name={t.icon} />
      </span>
      <span>{t.label}</span>
      {badge > 0 ? (
        <span className="tab-badge" aria-label={`${badge} pendientes urgentes`}>
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Cargando" style={{ paddingTop: 12 }}>
      <div className="skeleton" style={{ height: 150 }} />
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Esta pantalla no existe</h1>
      <a className="btn btn-secondary" href={href('/')}>
        Volver al inicio
      </a>
    </div>
  );
}
