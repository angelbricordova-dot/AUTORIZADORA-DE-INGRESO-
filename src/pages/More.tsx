import type { CSSProperties } from 'react';
import { useApp } from '../context';
import { resetDemo } from '../lib/store/demo';
import { href } from '../router';
import { Icon, type IconName } from '../components/Icon';

export function MorePage() {
  const { data, store, signOut } = useApp();
  const partners = data.properties.filter((p) => p.kind === 'aliado').length;
  const items: { to: string; icon: IconName; title: string; sub: string; external?: boolean }[] = [
    { to: href('/apartamentos'), icon: 'building', title: 'Apartamentos y catálogo', sub: `N°${data.settings.unit} y ${partners} ${partners === 1 ? 'aliado' : 'aliados'} · precios, fotos y comisiones` },
    { to: href('/ajustes'), icon: 'idcard', title: 'Datos de la planilla', sub: 'Propietaria, cédula y WhatsApp de la administradora' },
    { to: '/', icon: 'eye', title: 'Ver la página pública', sub: 'Lo que ven los huéspedes' },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">Más</h1>
      </div>
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
