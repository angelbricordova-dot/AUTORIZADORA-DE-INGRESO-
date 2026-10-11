import { lazy, Suspense } from 'react';
import { ADMIN, useLocation } from './router';
import { Site } from './site/Site';

// El panel se carga aparte: quien visita la página pública no descarga el código del panel.
const AdminApp = lazy(() => import('./AdminApp').then((m) => ({ default: m.AdminApp })));

export function App() {
  const { pathname } = useLocation();
  if (pathname === ADMIN || pathname.startsWith(`${ADMIN}/`)) {
    return (
      <Suspense fallback={<div className="app" />}>
        <AdminApp />
      </Suspense>
    );
  }
  return <Site />;
}
