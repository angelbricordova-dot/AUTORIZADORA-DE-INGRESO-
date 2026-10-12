import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import type { Settings } from '../lib/types';
import { formatCedula, isValidCedula } from '../lib/cedula';
import { cleanText } from '../lib/sanitize';
import { Icon } from '../components/Icon';
import { href } from '../router';
import { useToast } from '../components/Toast';

export function SettingsPage() {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [s, setS] = useState<Settings>(data.settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cleanText(s.owner_name)) return toast('Escribe el nombre de la propietaria.', 'bad');
    if (!isValidCedula(s.owner_cedula)) return toast('La cédula de la propietaria no parece válida.', 'bad');
    if (!cleanText(s.unit, 20)) return toast('Escribe el número del inmueble.', 'bad');
    setSaving(true);
    try {
      await store.saveSettings({
        ...s,
        owner_name: cleanText(s.owner_name, 120),
        owner_cedula: formatCedula(s.owner_cedula),
        conjunto: cleanText(s.conjunto, 80) || 'JDC Pescadores I',
        unit: cleanText(s.unit, 20),
        admin_whatsapp: s.admin_whatsapp.replace(/[^0-9+ ]/g, '').slice(0, 20),
      });
      await reload();
      toast('Ajustes guardados');
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/mas')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <h1 className="grow">Datos de la planilla</h1>
      </div>
      <form className="section" onSubmit={onSubmit} aria-labelledby="h-planilla">
        <p className="muted small">Así aparecen en “Yo ______ CI ______” y en “Inmueble N°”.</p>
        <div className="panel panel-pad stack">
          <div className="field">
            <label htmlFor="owner">Propietaria</label>
            <input id="owner" className="input" maxLength={120} value={s.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ci">Cédula</label>
              <input id="ci" className="input" inputMode="numeric" maxLength={14} value={s.owner_cedula} onChange={(e) => set('owner_cedula', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="unit">Inmueble N°</label>
              <input id="unit" className="input" maxLength={20} value={s.unit} onChange={(e) => set('unit', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="conj">Conjunto / administradora</label>
            <input id="conj" className="input" maxLength={80} value={s.conjunto} onChange={(e) => set('conjunto', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="adm">WhatsApp de la administradora</label>
            <input
              id="adm"
              className="input"
              type="tel"
              inputMode="tel"
              maxLength={20}
              placeholder="0414 000 0000"
              value={s.admin_whatsapp}
              onChange={(e) => set('admin_whatsapp', e.target.value)}
            />
            <span className="hint">Para abrir su chat directo con el mensaje listo cuando envíes desde una computadora.</span>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <span className="spinner" /> : <Icon name="check" />} Guardar
          </button>
        </div>
      </form>

      <section className="section" aria-labelledby="h-priv">
        <h2 id="h-priv">Privacidad y seguridad</h2>
        <div className="panel panel-pad">
          <div className="kv">
            <span>Fotos de cédulas</span>
            <span className="muted">No se guardan</span>
          </div>
          <div className="kv">
            <span>Dónde viven los datos</span>
            <span className="muted">{store.mode === 'demo' ? 'Solo en este teléfono' : 'Supabase, solo tu cuenta'}</span>
          </div>
          <div className="kv">
            <span>Conexión</span>
            <span className="muted">Cifrada (HTTPS)</span>
          </div>
        </div>
        <p className="hint">Al terminar el trámite, borra las fotos de las cédulas de tu galería y del chat.</p>
      </section>

    </div>
  );
}
