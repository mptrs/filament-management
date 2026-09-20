import { useEffect, useState } from 'preact/hooks';

function current(): string {
  const hash = location.hash.replace(/^#/, '');
  const path = hash.split('?')[0];
  return path.startsWith('/') ? path : '/';
}

/** Query string after the hash route, e.g. `#/add?printer=abc`. */
export function query(): URLSearchParams {
  const hash = location.hash.replace(/^#/, '');
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

export function useRoute(): string {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onChange = (): void => setPath(current());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string, { replace = false } = {}): void {
  if (replace) location.replace(`#${to}`);
  else location.hash = to;
}

export function href(to: string): string {
  return `#${to}`;
}

export function back(fallback = '/'): void {
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

/** `/spool/:id` against `/spool/abc` yields `{ id: 'abc' }`, or null if it does not match. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}
