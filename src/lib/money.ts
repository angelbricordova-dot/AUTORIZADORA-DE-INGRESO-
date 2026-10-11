export function formatUSD(n: number): string {
  const v = Math.round(n * 100) / 100;
  const hasCents = Math.abs(v % 1) > 0.001;
  return `$${v.toLocaleString('es-VE', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Acepta "120", "120,50", "1.200,50", "$ 120.5" */
export function parseMoney(s: string): number {
  const t = (s || '').replace(/[^\d.,]/g, '');
  if (!t) return 0;
  let normalized = t;
  if (t.includes(',') && t.includes('.')) normalized = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) normalized = t.replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) normalized = t.replace(/\./g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 100) / 100, 100000) : 0;
}
