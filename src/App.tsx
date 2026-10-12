import { lazy, Suspense } from 'react';
import { useEffect } from 'react';
import { ADMIN, isWorkPath, navigate, useLocation } from './router';
import { shouldOpenPanel } from './install';
import { Site } from './site/Site';

// El panel se carga aparte: quien visita la página pública no descarga el código del panel.
const AdminApp = lazy(() => import('./AdminApp').then((m) => ({ default: m.AdminApp })));

export function App() {
  const { pathname } = useLocation();
  const toPanel = shouldOpenPanel(pathname);
  useEffect(() => {
    if (toPanel) navigate(toPanel, { replace: true });
  }, [toPanel]);
  if (toPanel) return <div className="app" />;
  if (pathname === ADMIN || pathname.startsWith(`${ADMIN}/`) || isWorkPath(pathname)) {
    return (
      <Suspense fallback={<div className="app" />}>
        <AdminApp />
      </Suspense>
    );
  }
  return <Site />;
}
