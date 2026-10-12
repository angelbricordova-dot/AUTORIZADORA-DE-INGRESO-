import { useState, type CSSProperties, type FormEvent } from 'react';
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
