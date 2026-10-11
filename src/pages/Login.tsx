import { useState, type FormEvent } from 'react';
import { getSupabase } from '../lib/store/supabase';
import { Icon } from '../components/Icon';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim().slice(0, 254), password: password.slice(0, 200) });
    setBusy(false);
    // Mensaje genérico: no revela si el correo existe.
    if (err) setError(err.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'Correo o contraseña incorrectos.');
  }

  return (
    <div className="login">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand">
            <span className="brand-name">JDC Pescadores I</span>
            <span className="brand-unit">N°30</span>
          </span>
        </div>
        <div style={{ height: 12 }} />
      </header>
      <main className="login-card">
        <form className="stack" onSubmit={onSubmit}>
          <h1>Entrar</h1>
          <p className="muted">Autorizaciones de ingreso y control de estadías.</p>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw">Contraseña</label>
            <input id="pw" className="input" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? (
            <div className="notice notice-bad" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : null} Entrar
          </button>
          <p className="hint">Las cuentas las crea el administrador. Si olvidaste la contraseña, pídele que te la restablezca.</p>
        </form>
      </main>
    </div>
  );
}
