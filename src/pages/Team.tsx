// Zuleika: limpieza, llaves, garantías y el efectivo que guarda. Vista de Oniris.
import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import type { StaffData } from '../lib/types';
import { staffStaysFromApp } from '../lib/ops';
import { formatUSD, parseMoney } from '../lib/money';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { OpsBoard } from '../components/Ops';
import { useToast } from '../components/Toast';
import { cleanText } from '../lib/sanitize';

export function useOwnerStaffData(): StaffData {
  const { data } = useApp();
  return {
    name: data.settings.staff_name,
    deposit_usd: data.settings.deposit_usd,
    cash_alert_usd: data.settings.cash_alert_usd,
    stays: staffStaysFromApp(data.reservations, data.properties),
    ops: data.ops,
    payments: data.payments,
    cash: data.cash,
  };
}

export function TeamPage() {
  const { data, store, reload, today } = useApp();
  const staff = useOwnerStaffData();
  const name = data.settings.staff_name || 'Zuleika';
  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>{name}</h1>
          <div className="sub">Limpieza, llaves, garantías y efectivo</div>
        </div>
        <a className="btn btn-soft btn-small" href={href('/zuleika/vista')}>
          <Icon name="eye" /> Su vista
        </a>
      </div>
      {data.migrationPending ? <MigrationNotice /> : null}
      <OpsBoard
        view="owner"
        data={staff}
        settings={data.settings}
        today={today}
        store={store}
        reload={reload}
        extra={
          <>
            <TeamSettings />
            <TeamAccess />
          </>
        }
      />
    </div>
  );
}

/** Así ve Zuleika su panel (sirve para enseñarle y para probar en modo demo). */
export function StaffPreviewPage() {
  const { data, store, reload, today } = useApp();
  const staff = useOwnerStaffData();
  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/zuleika')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>Hola, {data.settings.staff_name}</h1>
          <div className="sub">Así lo ve ella en su teléfono</div>
        </div>
      </div>
      <OpsBoard
        view="staff"
        data={{ ...staff, payments: staff.payments.filter((p) => p.received_by === 'staff') }}
        settings={data.settings}
        today={today}
        store={store}
        reload={reload}
      />
    </div>
  );
}

export function MigrationNotice() {
  return (
    <div className="notice notice-warn" role="alert">
      <Icon name="alert" />
      <span>
        Falta ejecutar en Supabase la migración <strong>20261013000000_equipo_pagos.sql</strong>. Hasta entonces no se guardan pagos, tareas ni la caja.
      </span>
    </div>
  );
}

function TeamSettings() {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [name, setName] = useState(data.settings.staff_name);
  const [alertAt, setAlertAt] = useState(String(data.settings.cash_alert_usd));
  const [deposit, setDeposit] = useState(String(data.settings.deposit_usd));
  const [saving, setSaving] = useState(false);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await store.saveSettings({
        ...data.settings,
        staff_name: cleanText(name, 40) || 'Zuleika',
        cash_alert_usd: Math.max(0, parseMoney(alertAt)),
        deposit_usd: Math.max(0, parseMoney(deposit)),
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
    <details className="disclosure">
      <summary>
        <Icon name="settings" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
        Garantía y aviso de retiro
        <Icon name="chevronRight" className="chev" />
      </summary>
      <form className="disclosure-body" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="staff-name">Nombre</label>
          <input id="staff-name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="deposit">Garantía</label>
            <input id="deposit" className="input" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <span className="hint">Se cobra al llegar. 0 si no se cobra.</span>
          </div>
          <div className="field">
            <label htmlFor="alert">Avisarme al llegar a</label>
            <input id="alert" className="input" inputMode="decimal" value={alertAt} onChange={(e) => setAlertAt(e.target.value)} />
            <span className="hint">Cuando la caja llegue a {formatUSD(parseMoney(alertAt))}, conviene ir a retirar.</span>
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" />} Guardar
        </button>
      </form>
    </details>
  );
}

function TeamAccess() {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const name = data.settings.staff_name || 'Zuleika';
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await store.addTeamMember(email, name);
      await reload();
      setEmail('');
      toast(`${name} ya puede entrar con su correo`);
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className="disclosure">
      <summary>
        <Icon name="user" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
        Acceso de {name} a su panel
        <Icon name="chevronRight" className="chev" />
      </summary>
      <div className="disclosure-body">
        {data.team.length ? (
          <div className="panel list">
            {data.team.map((m) => (
              <div key={m.member_id} className="list-item">
                <span className="lead-icon lead-ok">
                  <Icon name="user" />
                </span>
                <span className="grow">
                  <span className="title">{m.name}</span>
                  <span className="sub">{m.email}</span>
                </span>
                <button
                  className="icon-btn flat"
                  type="button"
                  aria-label={`Quitar el acceso de ${m.name}`}
                  onClick={async () => {
                    if (!window.confirm(`¿Quitarle el acceso a ${m.name}? Ya no podrá ver su panel.`)) return;
                    try {
                      await store.removeTeamMember(m.member_id);
                      await reload();
                      toast('Acceso quitado');
                    } catch (err) {
                      toast((err as Error).message, 'bad');
                    }
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="small muted">
          {name} entra en esta misma dirección (/admin) con su propio correo y contraseña. Solo ve las entradas y salidas, sus tareas, las garantías y la caja:
          nunca cédulas, placas, notas ni lo que cobran los aliados.
        </p>
        <ol className="steps small">
          <li>En Supabase → Authentication → Users → Add user, crea su usuario (marca “Auto Confirm User”).</li>
          <li>Escribe aquí ese mismo correo y toca “Dar acceso”.</li>
        </ol>
        <form className="row" onSubmit={onSubmit}>
          <label htmlFor="team-email" className="visually-hidden">
            Correo de {name}
          </label>
          <input
            id="team-email"
            className="input grow"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={saving || !email.includes('@')}>
            {saving ? <span className="spinner" /> : null} Dar acceso
          </button>
        </form>
      </div>
    </details>
  );
}
