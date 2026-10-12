import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../install';
import { useToast } from '../components/Toast';
import { useApp } from '../context';
import { resetDemo } from '../lib/store/demo';
import { href } from '../router';
import { Icon, type IconName } from '../components/Icon';

export function MorePage() {
  const { data, store, signOut } = useApp();
  const partners = data.properties.filter((p) => p.kind === 'aliado').length;
  const items: { to: string; icon: IconName; title: string; sub: string; external?: boolean }[] = [
    { to: href('/zuleika'), icon: 'broom', title: data.settings.staff_name, sub: 'Limpieza, llaves, garantías y el efectivo que guarda' },
    { to: href('/apartamentos'), icon: 'building', title: 'Apartamentos y catálogo', sub: `N°${data.settings.unit} y ${partners} ${partners === 1 ? 'aliado' : 'aliados'} · precios, fotos y comisiones` },
    { to: href('/accesos'), icon: 'user', title: 'Accesos al panel', sub: data.team.length ? data.team.map((m) => m.name).join(', ') : 'Administradoras (Oniris, Angélica) y Zuleika' },
    { to: href('/ajustes'), icon: 'idcard', title: 'Datos de la planilla', sub: 'Propietaria, cédula y WhatsApp de la administradora' },
    { to: '/', icon: 'eye', title: 'Ver la página pública', sub: 'Lo que ven los huéspedes' },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">Más</h1>
      </div>
      <MyName />
      <InstallApp />
      <div className="panel list stagger">
        {items.map((it, i) => (
          <a key={it.title} className="list-item" href={it.to} style={{ '--i': i } as CSSProperties}>
            <span className="lead-icon lead-brand">
              <Icon name={it.icon} />
            </span>
            <span className="grow">
              <span className="title">{it.title}</span>
              <span className="sub">{it.sub}</span>
            </span>
            <Icon name="chevronRight" className="chev" />
          </a>
        ))}
      </div>

      {store.mode === 'demo' ? (
        <section className="section" aria-labelledby="h-demo">
          <h2 id="h-demo">Modo demo</h2>
          <div className="notice">
            <Icon name="info" />
            <span>Los datos de ejemplo son inventados y se guardan solo en este navegador. Para usar la app de verdad, conecta Supabase (ver README).</span>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              if (!window.confirm('¿Volver a los datos de ejemplo? Se borra lo que hayas cargado en este navegador.')) return;
              resetDemo();
              window.location.reload();
            }}
          >
            Restablecer datos de ejemplo
          </button>
        </section>
      ) : null}

      {signOut ? (
        <button className="btn btn-secondary" type="button" onClick={signOut}>
          <Icon name="logout" /> Cerrar sesión
        </button>
      ) : null}
    </div>
  );
}

/** El nombre con el que el panel saluda a quien entró (cada persona tiene el suyo). */
function MyName() {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [name, setName] = useState(data.me?.name ?? '');
  const [saving, setSaving] = useState(false);
  const roleLabel = data.me?.role === 'admin' ? 'Administradora' : data.me?.role === 'staff' ? 'Trabajo' : 'Cuenta principal';
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await store.saveMyName(name);
      await reload();
      toast('Listo, ahora te saludo así');
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="panel panel-pad stack" onSubmit={onSubmit} aria-label="Tu nombre">
      <div className="field">
        <label htmlFor="mi-nombre">Tu nombre (para el saludo)</label>
        <div className="row">
          <input id="mi-nombre" className="input grow" maxLength={40} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={saving || !name.trim() || name.trim() === data.me?.name}>
            {saving ? <span className="spinner" /> : null} Guardar
          </button>
        </div>
        <span className="hint">
          {data.me?.email ? `${data.me.email} · ` : ''}
          {roleLabel}
        </span>
      </div>
    </form>
  );
}

/** Instalar el panel como aplicación: botón en Android, instrucciones en iPhone. */
function InstallApp() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone()) {
    return (
      <div className="notice notice-ok install-card">
        <Icon name="check" />
        <span>Estás usando el panel como aplicación. Se abre directo aquí.</span>
      </div>
    );
  }
  return (
    <section className="panel panel-pad stack install-card" aria-labelledby="h-instalar">
      <div className="row">
        <span className="lead-icon lead-brand">
          <Icon name="download" />
        </span>
        <span className="grow">
          <h2 id="h-instalar" className="install-title">
            Instalar el panel como aplicación
          </h2>
          <span className="small muted">Queda un ícono en tu pantalla de inicio que abre directo aquí, sin pasar por la página pública.</span>
        </span>
      </div>
      {canPromptInstall() ? (
        <button className="btn btn-primary" type="button" onClick={() => promptInstall()}>
          <Icon name="download" /> Instalar
        </button>
      ) : isIOS() ? (
        <ol className="steps small">
          <li>
            Toca el botón <strong>Compartir</strong> (el cuadrito con la flecha hacia arriba).
          </li>
          <li>
            Elige <strong>Agregar a pantalla de inicio</strong> y toca <strong>Agregar</strong>.
          </li>
          <li>Si ya tenías un ícono que abría la página pública, bórralo y agrega este.</li>
        </ol>
      ) : (
        <p className="small muted">Abre el menú del navegador (los tres puntos) y elige “Instalar aplicación” o “Agregar a pantalla de inicio”.</p>
      )}
    </section>
  );
}
