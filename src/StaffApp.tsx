// Lo que ve Zuleika al entrar con su usuario: su agenda, tareas, garantías y la caja.
import { useCallback, useEffect, useState } from 'react';
import type { StaffData } from './lib/types';
import { store } from './lib/store';
import { getSupabase } from './lib/store/supabase';
import { todayISO } from './lib/dates';
import { Icon } from './components/Icon';
import { LogoMark } from './components/Logo';
import { OpsBoard } from './components/Ops';
import { ThemeToggle } from './components/ThemeToggle';

export function StaffApp({ name }: { name: string }) {
  const today = todayISO();
  const [data, setData] = useState<StaffData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await store.loadStaff(today));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [today]);

  useEffect(() => {
    document.title = `${name} · Tu Día en Tucacas`;
    reload();
  }, [reload, name]);

  return (
    <div className="app staff-app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">
              <LogoMark />
            </span>
            <span className="brand-text">
              <span className="brand-name">Hola, {name}</span>
              <span className="brand-sub">Tu Día en Tucacas</span>
            </span>
          </span>
          <span className="grow" />
          <ThemeToggle className="flat" />
          <button className="icon-btn flat" type="button" aria-label="Cerrar sesión" onClick={() => getSupabase().auth.signOut()}>
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="body page" id="contenido">
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
        {data ? (
          <OpsBoard
            view="staff"
            data={data}
            settings={{ staff_name: name, cash_alert_usd: data.cash_alert_usd, deposit_usd: data.deposit_usd }}
            today={today}
            store={store}
            reload={reload}
          />
        ) : !error ? (
          <div className="stack" aria-busy="true" aria-label="Cargando">
            <div className="skeleton" style={{ height: 170 }} />
            <div className="skeleton" style={{ height: 220 }} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
