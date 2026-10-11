import { useApp } from '../context';
import { compareISO } from '../lib/dates';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { StayRow } from '../components/StayRow';

const FILTERS = [
  { id: 'proximas', label: 'Próximas' },
  { id: 'pasadas', label: 'Pasadas' },
  { id: 'todas', label: 'Todas' },
] as const;

export function ReservationsPage({ query }: { query: URLSearchParams }) {
  const { data, today } = useApp();
  const f = (FILTERS.find((x) => x.id === query.get('f'))?.id ?? 'proximas') as (typeof FILTERS)[number]['id'];
  let list = data.reservations;
  if (f === 'proximas') list = list.filter((r) => r.check_out >= today && r.status !== 'cancelada').sort((a, b) => compareISO(a.check_in, b.check_in));
  else if (f === 'pasadas') list = list.filter((r) => r.check_out < today).sort((a, b) => compareISO(b.check_in, a.check_in));
  else list = [...list].sort((a, b) => compareISO(b.check_in, a.check_in));

  return (
    <div className="page">
      <div className="spread">
        <h1>Estadías</h1>
        <a className="btn btn-secondary btn-small" href={href('/reserva/nueva')}>
          <Icon name="plus" /> Nueva
        </a>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Filtrar">
        {FILTERS.map((x) => (
          <label key={x.id} className="chip">
            <input type="radio" name="f" checked={f === x.id} onChange={() => go(`/reservas?f=${x.id}`)} />
            <span>{x.label}</span>
          </label>
        ))}
      </div>
      <div className="panel list">
        {list.length ? (
          list.map((r) => <StayRow key={r.id} r={r} />)
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
