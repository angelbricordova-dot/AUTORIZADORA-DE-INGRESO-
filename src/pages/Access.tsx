// Quién puede entrar al panel: administradoras (ven y manejan todo) y trabajo (solo el panel de Zuleika).
import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import type { TeamRole } from '../lib/types';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';

const ROLES: { id: TeamRole; label: string; sub: string }[] = [
  { id: 'admin', label: 'Administradora', sub: 'Ve y maneja todo el panel, igual que tú' },
  { id: 'staff', label: 'Trabajo', sub: 'Solo tareas, garantías y caja; nunca cédulas ni montos de aliados' },
];

export function AccessPage() {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<TeamRole>('admin');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await store.addTeamMember(email, name || (role === 'staff' ? data.settings.staff_name : ''), role);
      await reload();
      toast(`${name || email} ya puede entrar al panel`);
      setEmail('');
      setName('');
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  }

  async function remove(memberId: string, who: string) {
    if (!window.confirm(`¿Quitarle el acceso a ${who}? Ya no podrá entrar a este panel.`)) return;
    try {
      await store.removeTeamMember(memberId);
      await reload();
      toast('Acceso quitado');
    } catch (err) {
      toast((err as Error).message, 'bad');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/mas')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>Accesos al panel</h1>
          <div className="sub">Quién puede entrar y qué ve</div>
        </div>
      </div>

      <section className="section" aria-labelledby="h-con-acceso">
        <h2 id="h-con-acceso">Con acceso</h2>
        <div className="panel list">
          <div className="list-item">
            <span className="lead-icon lead-brand">
              <Icon name="star" />
            </span>
            <span className="grow">
              <span className="title">Cuenta principal</span>
              <span className="sub">La que creó el panel y tiene los datos</span>
            </span>
          </div>
          {data.team.map((m) => (
            <div key={m.member_id} className="list-item">
              <span className={`lead-icon ${m.role === 'admin' ? 'lead-brand' : 'lead-ok'}`}>
                <Icon name={m.role === 'admin' ? 'user' : 'broom'} />
              </span>
              <span className="grow">
                <span className="title">
                  {m.name} <span className={`badge ${m.role === 'admin' ? 'badge-brand' : 'badge-ok'}`}>{m.role === 'admin' ? 'Administradora' : 'Trabajo'}</span>
                </span>
                <span className="sub">{m.email}</span>
              </span>
              <button className="icon-btn flat" type="button" aria-label={`Quitar el acceso de ${m.name}`} onClick={() => remove(m.member_id, m.name)}>
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="h-dar">
        <h2 id="h-dar">Dar acceso</h2>
        <ol className="steps small">
          <li>
            En Supabase → <strong>Authentication → Users → Add user</strong>, crea el usuario con su correo y una contraseña (marca “Auto Confirm User”).
          </li>
          <li>Escribe aquí ese mismo correo, elige qué puede ver y toca “Dar acceso”.</li>
          <li>Esa persona entra en esta misma dirección con su correo y contraseña.</li>
        </ol>
        <form className="panel panel-pad stack" onSubmit={onSubmit}>
          <div className="field">
            <span className="field-label" id="lbl-rol">
              Qué puede ver
            </span>
            <div className="role-pick" role="radiogroup" aria-labelledby="lbl-rol">
              {ROLES.map((r) => (
                <label key={r.id} className={`role-option ${role === r.id ? 'on' : ''}`}>
                  <input type="radio" name="rol" checked={role === r.id} onChange={() => setRole(r.id)} />
                  <span className="title">{r.label}</span>
                  <span className="sub">{r.sub}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="acc-name">Nombre</label>
            <input
              id="acc-name"
              className="input"
              maxLength={40}
              autoComplete="off"
              placeholder={role === 'admin' ? 'Angélica' : data.settings.staff_name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="acc-email">Correo</label>
            <input
              id="acc-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !email.includes('@') || (role === 'admin' && !name.trim())}>
            {saving ? <span className="spinner" /> : <Icon name="check" />} Dar acceso
          </button>
          <p className="hint">Si esa persona ya había entrado antes y vio un panel vacío, ese panel vacío se borra y pasa a ver este.</p>
        </form>
      </section>
    </div>
  );
}
