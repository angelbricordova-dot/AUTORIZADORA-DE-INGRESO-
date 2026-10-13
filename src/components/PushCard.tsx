// Tarjeta "Avisos en este teléfono": activar, probar y desactivar las notificaciones.
// En el panel de administración, además, el asistente que genera las llaves (una sola vez).
import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from '../push';
import { generatePushSetup, type PushSetup } from '../lib/pushKeys';
import { useToast } from './Toast';
import { Icon } from './Icon';

export function PushCard({ who, admin = false }: { who: 'staff' | 'admin'; admin?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setState(await pushState());
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const what =
    who === 'staff'
      ? 'Te avisamos cuando se registre un huésped nuevo, y cada mañana con quién llega, quién se va y quién viene mañana.'
      : 'Cada mañana te llega el resumen de entradas y salidas del día y de quién llega mañana.';

  if (state === null) return null;
  return (
    <section className="panel panel-pad stack push-card" aria-labelledby="h-avisos" data-push={state}>
      <div className="row">
        <span className={`lead-icon ${state === 'on' ? 'lead-ok' : 'lead-brand'}`}>
          <Icon name="bell" />
        </span>
        <span className="grow">
          <h2 id="h-avisos" className="install-title">
            {state === 'on' ? 'Avisos activados en este teléfono' : 'Avisos en este teléfono'}
          </h2>
          <span className="small muted">{what}</span>
        </span>
      </div>

      {state === 'off' ? (
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => run(enablePush)}>
          {busy ? <span className="spinner" /> : <Icon name="bell" />} Activar avisos
        </button>
      ) : state === 'on' ? (
        <div className="row-wrap">
          <button
            className="btn btn-secondary btn-small"
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const n = await sendTestPush();
                toast(n ? 'Listo, revisa tus notificaciones' : 'No se pudo enviar la prueba', n ? 'ok' : 'bad');
              })
            }
          >
            <Icon name="send" /> Enviar aviso de prueba
          </button>
          <button className="btn btn-ghost btn-small" type="button" disabled={busy} onClick={() => run(disablePush)}>
            Desactivar
          </button>
        </div>
      ) : state === 'needs-install' ? (
        <ol className="steps small">
          <li>
            En iPhone los avisos solo llegan con la app instalada: toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.
          </li>
          <li>Abre la app desde el ícono nuevo y vuelve aquí para activarlos.</li>
        </ol>
      ) : state === 'blocked' ? (
        <p className="small muted">
          Las notificaciones están bloqueadas para esta app. Actívalas en los ajustes del teléfono (Notificaciones → Tu Día en Tucacas) y vuelve a abrirla.
        </p>
      ) : state === 'off-server' ? (
        <p className="small muted">{admin ? 'Falta configurarlos una sola vez: usa el asistente de abajo.' : 'Todavía no están configurados. Avísale a quien administra el panel.'}</p>
      ) : (
        <p className="small muted">Este navegador no recibe avisos. Usa Chrome en Android o la app instalada en iPhone.</p>
      )}

      {admin ? <PushSetupWizard configured={state !== 'off-server'} /> : null}
    </section>
  );
}

function Copy({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const toast = useToast();
  return (
    <div className="field">
      <span className="label-row small">
        <strong>{label}</strong>
        {secret ? <span className="badge badge-warn">secreta</span> : null}
      </span>
      <div className="row">
        <code className="copy-value grow">{value}</code>
        <button
          className="btn btn-secondary btn-small"
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(value).then(
              () => toast('Copiado'),
              () => toast('No se pudo copiar; selecciónalo y cópialo a mano', 'bad'),
            )
          }
        >
          Copiar
        </button>
      </div>
    </div>
  );
}

/** Genera las llaves en este navegador: nunca pasan por ningún chat ni servidor nuestro. */
function PushSetupWizard({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(!configured);
  const [setup, setSetup] = useState<PushSetup | null>(null);
  if (!open) {
    return (
      <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(true)}>
        <Icon name="key" /> Volver a configurar las llaves
      </button>
    );
  }
  return (
    <div className="stack push-setup">
      <h3 className="small">Configurar los avisos (una sola vez)</h3>
      {configured ? (
        <div className="notice notice-warn">
          <Icon name="alert" />
          <span>Ya están configurados. Si generas llaves nuevas, cada teléfono tendrá que volver a tocar “Activar avisos”.</span>
        </div>
      ) : null}
      {!setup ? (
        <button className="btn btn-primary" type="button" onClick={() => generatePushSetup().then(setSetup)}>
          <Icon name="key" /> Generar llaves
        </button>
      ) : (
        <>
          <ol className="steps small">
            <li>
              En <strong>Netlify → Site configuration → Environment variables</strong> crea estas tres variables. Las dos secretas márcalas como “secret”.
            </li>
          </ol>
          <Copy label="VAPID_PUBLIC_KEY" value={setup.publicKey} />
          <Copy label="VAPID_PRIVATE_KEY" value={setup.privateKey} secret />
          <Copy label="AVISOS_SECRET" value={setup.secret} secret />
          <ol className="steps small" start={2}>
            <li>
              En <strong>Supabase → SQL Editor</strong> pega y ejecuta esta línea (guarda solo la huella de la clave, no la clave):
            </li>
          </ol>
          <Copy label="SQL" value={setup.sql} />
          <ol className="steps small" start={3}>
            <li>
              En Netlify, <strong>Deploys → Trigger deploy</strong>. Después toca “Activar avisos” en cada teléfono.
            </li>
          </ol>
          <p className="tiny muted">No pegues estas llaves en ningún chat. Si se pierden, genera unas nuevas aquí.</p>
        </>
      )}
    </div>
  );
}
