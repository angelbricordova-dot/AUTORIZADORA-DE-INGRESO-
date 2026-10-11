import type { Property } from '../lib/types';
import { propertyLabel } from '../lib/types';

/** Selector de apartamento en píldoras desplazables. value '' = todos. */
export function PropertyChips({
  properties,
  value,
  onChange,
  allowAll = false,
  name = 'apto',
}: {
  properties: Property[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
  name?: string;
}) {
  if (properties.length < 2 && !allowAll) return null;
  return (
    <div className="segmented scroll" role="radiogroup" aria-label="Apartamento">
      {allowAll ? (
        <label className="chip">
          <input type="radio" name={name} checked={value === ''} onChange={() => onChange('')} />
          <span>Todos</span>
        </label>
      ) : null}
      {properties.map((p) => (
        <label key={p.id} className="chip">
          <input type="radio" name={name} checked={value === p.id} onChange={() => onChange(p.id)} />
          <span>{propertyLabel(p)}</span>
        </label>
      ))}
    </div>
  );
}
