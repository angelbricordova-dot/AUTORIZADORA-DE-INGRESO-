import { useState, type FormEvent } from 'react';
import { getSupabase } from '../lib/store/supabase';
import { Icon } from '../components/Icon';

/** Traduce el error de Supabase Auth. Para credenciales malas el mensaje es genérico: no revela si el correo existe. */
export function loginError(err: { status?: number; code?: string; message?: string }): string {
  if (err.status === 429 || err.code === 'over_request_rate_limit') return 'Demasiados intentos. Espera unos minutos.';
  if (err.code === 'email_not_confirmed')
    return 'Esta cuenta no está confirmada. En Supabase → Authentication → Users, bórrala y vuelve a crearla marcando "Auto Confirm User".';
  if (err.code === 'user_banned') return 'Esta cuenta está bloqueada.';
  if (err.code === 'email_provider_disabled' || err.code === 'provider_disabled') return 'El acceso con correo está desactivado en Supabase (Authentication → Sign In / Providers → Email).';
  if (err.status === 401 || /api key/i.test(err.message ?? '')) return 'La llave de Supabase configurada en Netlify no es válida. Revisa VITE_SUPABASE_ANON_KEY.';
  if (!err.status || /fetch|network/i.test(err.message ?? '')) return 'No hay conexión con el servidor. Revisa tu internet o la variable VITE_SUPABASE_URL.';
  return 'Correo o contraseña incorrectos.';
}

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
    if (err) setError(loginError(err));
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
