import { useState, type CSSProperties } from 'react';
import { useApp } from '../context';
import { compareISO } from '../lib/dates';
import { propertyLabel } from '../lib/types';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { StayRow } from '../components/StayRow';
import { PropertyChips } from '../components/PropertyChips';

const FILTERS = [
  { id: 'proximas', label: 'Próximas' },
  { id: 'pasadas', label: 'Pasadas' },
  { id: 'todas', label: 'Todas' },
] as const;

export function ReservationsPage({ query }: { query: URLSearchParams }) {
  const { data, today, ownId } = useApp();
  const [apto, setApto] = useState('');
  const props = new Map(data.properties.map((p) => [p.id, p]));
  const f = (FILTERS.find((x) => x.id === query.get('f'))?.id ?? 'proximas') as (typeof FILTERS)[number]['id'];
  let list = apto ? data.reservations.filter((r) => r.property_id === apto) : data.reservations;
  if (f === 'proximas') list = list.filter((r) => r.check_out >= today && r.status !== 'cancelada').sort((a, b) => compareISO(a.check_in, b.check_in));
  else if (f === 'pasadas') list = list.filter((r) => r.check_out < today).sort((a, b) => compareISO(b.check_in, a.check_in));
  else list = [...list].sort((a, b) => compareISO(b.check_in, a.check_in));

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">Estadías</h1>
        <a className="btn btn-soft btn-small" href={href('/reserva/nueva')}>
          <Icon name="plus" /> Registrar
        </a>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <div className="segmented" role="radiogroup" aria-label="Filtrar por fecha">
          {FILTERS.map((x) => (
            <label key={x.id} className="chip">
              <input type="radio" name="f" checked={f === x.id} onChange={() => go(`/reservas?f=${x.id}`, { replace: true })} />
              <span>{x.label}</span>
            </label>
          ))}
        </div>
        <PropertyChips properties={data.properties} value={apto} onChange={setApto} allowAll={data.properties.length > 1} name="res-apto" />
      </div>
      <div className="panel list stagger" key={`${f}-${apto}`}>
        {list.length ? (
          list.map((r, i) => {
            const p = props.get(r.property_id);
            return (
              <div key={r.id} style={{ '--i': i } as CSSProperties}>
                <StayRow r={r} place={p && r.property_id !== ownId ? propertyLabel(p) : undefined} />
              </div>
            );
          })
        ) : (
          <div className="empty">
            <p className="muted">{f === 'pasadas' ? 'Aún no hay estadías pasadas.' : 'No hay estadías próximas registradas.'}</p>
            <a className="btn btn-secondary btn-small" href={href('/reserva/nueva')}>
              <Icon name="plus" /> Registrar estadía
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
