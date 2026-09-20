import type { ComponentChildren, JSX } from 'preact';
import { href, back as goBack } from '../lib/router';
import { isPale } from '../lib/catalog';

export function Swatch({ hex, size = 38, radius }: { hex: string; size?: number; radius?: number }): JSX.Element {
  return (
    <span
      class="swatch"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: hex,
        borderRadius: `${radius ?? Math.round(size / 3.5)}px`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,${isPale(hex) ? 0.35 : 0.18})`,
      }}
    />
  );
}

export function Bar({ pct }: { pct: number }): JSX.Element {
  const color = pct <= 15 ? 'var(--red)' : pct <= 30 ? 'var(--accent)' : 'var(--green)';
  return (
    <span class="bar">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}

export function pctColor(pct: number): string {
  return pct <= 15 ? 'var(--red-text)' : pct <= 30 ? 'var(--accent)' : 'var(--text-2)';
}

export function BackButton({
  to,
  label,
  onBack,
}: {
  to?: string;
  label: string;
  /** For going back a step inside one screen, where the URL does not change. */
  onBack?: () => void;
}): JSX.Element {
  if (onBack) {
    return (
      <button type="button" class="iconbtn" aria-label={label} onClick={onBack}>
        <Icon name="chevronLeft" />
      </button>
    );
  }
  return (
    <a
      class="iconbtn"
      href={to ? href(to) : '#'}
      aria-label={label}
      onClick={(e) => {
        if (!to) {
          e.preventDefault();
          goBack();
        }
      }}
    >
      <Icon name="chevronLeft" />
    </a>
  );
}

export function Note({
  tone = 'quiet',
  icon = 'info',
  children,
}: {
  tone?: 'quiet' | 'warn' | 'bad' | 'ok';
  icon?: IconName;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <div class={`note note--${tone}`}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

export type IconName =
  | 'printer'
  | 'spool'
  | 'refill'
  | 'plus'
  | 'minus'
  | 'chevronLeft'
  | 'chevronRight'
  | 'gear'
  | 'warn'
  | 'info'
  | 'lock'
  | 'check'
  | 'search'
  | 'offline'
  | 'github'
  | 'trash';

const PATHS: Record<IconName, JSX.Element> = {
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="7" rx="2" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  spool: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  refill: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  warn: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  offline: (
    <>
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M8.5 16.1a6 6 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="m2 2 20 20" />
    </>
  ),
  github: (
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }): JSX.Element {
  const filled = name === 'github';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function TabBar({ active }: { active: 'printers' | 'inventory' | 'refills' | 'add' }): JSX.Element {
  const tabs: Array<{ id: typeof active; to: string; label: string; icon: IconName }> = [
    { id: 'printers', to: '/', label: 'Printers', icon: 'printer' },
    { id: 'inventory', to: '/inventory', label: 'Inventory', icon: 'spool' },
    { id: 'refills', to: '/refills', label: 'Refills', icon: 'refill' },
    { id: 'add', to: '/add', label: 'Add', icon: 'plus' },
  ];
  return (
    <nav class="tabbar">
      {tabs.map((t) => (
        <a key={t.id} href={href(t.to)} data-active={t.id === active}>
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
