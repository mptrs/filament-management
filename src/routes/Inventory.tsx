import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { href } from '../lib/router';
import { locationText, needsSpool, remainingGrams, type Inventory as Inv, type Spool } from '../lib/types';
import { Bar, Icon, Swatch, TabBar, pctColor } from '../components/ui';

type FilterId = 'all' | 'pla' | 'petg' | 'other' | 'sealed' | 'open' | 'low' | 'nospool';

const FILTERS: Array<{ id: FilterId; label: string; test: (s: Spool) => boolean }> = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'pla', label: 'PLA', test: (s) => /pla/i.test(s.material) },
  { id: 'petg', label: 'PETG', test: (s) => /petg/i.test(s.material) },
  { id: 'other', label: 'Other', test: (s) => !/pla|petg/i.test(s.material) },
  { id: 'sealed', label: 'Sealed', test: (s) => s.sealed },
  { id: 'open', label: 'Open', test: (s) => !s.sealed },
  { id: 'low', label: 'Low', test: (s) => !s.sealed && s.remainingPct <= 15 },
  { id: 'nospool', label: 'Needs spool', test: needsSpool },
];

export function Inventory(): JSX.Element {
  const { inv } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  const counts = useMemo(() => {
    const out = {} as Record<FilterId, number>;
    for (const f of FILTERS) out[f.id] = inv.spools.filter(f.test).length;
    return out;
  }, [inv.spools]);

  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)?.test ?? (() => true);
    const q = query.trim().toLowerCase();
    return inv.spools.filter((s) => {
      if (!test(s)) return false;
      if (!q) return true;
      return `${s.colorName} ${s.brand} ${s.material} ${s.notes ?? ''}`.toLowerCase().includes(q);
    });
  }, [inv.spools, filter, query]);

  const loaded = visible.filter((s) => s.location.kind !== 'storage');
  const stored = visible.filter((s) => s.location.kind === 'storage');

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string): void => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div class="screen screen--tabbed">
      <header class="topbar" style={{ display: 'block' }}>
        <div class="row" style={{ alignItems: 'baseline' }}>
          <h1 class="grow">Inventory</h1>
          <span class="mono" style={{ fontSize: '12px', color: 'var(--faint)' }}>
            {inv.spools.length} spools
          </span>
        </div>

        <div class="row" style={{ gap: '9px', marginTop: '13px' }}>
          <label class="sr-only" for="q">
            Search filament
          </label>
          <div class="row" style={{ flexGrow: 1, gap: '9px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '11px', padding: '0 12px', height: '42px' }}>
            <Icon name="search" size={16} />
            <input
              id="q"
              type="search"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Search colour, brand, material"
              style={{ flexGrow: 1, background: 'transparent', border: 0, outline: 'none', minWidth: 0, fontSize: '13.5px' }}
            />
          </div>
        </div>

        <div class="row" style={{ gap: '7px', marginTop: '11px', overflowX: 'auto', paddingBottom: '2px' }}>
          {FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0).map((f) => (
            <button key={f.id} type="button" class="chip" data-on={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} {counts[f.id]}
            </button>
          ))}
        </div>
      </header>

      <div class="screen__body">
        {visible.length === 0 && (
          <div class="empty">
            {inv.spools.length === 0 ? (
              <>
                Nothing logged yet.
                <br />
                <a href={href('/add')}>Add your first spool</a>
              </>
            ) : (
              'No spools match that.'
            )}
          </div>
        )}

        {loaded.length > 0 && (
          <Section title="Loaded in a printer" spools={loaded} inv={inv} open={open} toggle={toggle} />
        )}

        {stored.length > 0 && <Section title="Storage" spools={stored} inv={inv} open={open} toggle={toggle} />}
      </div>

      <TabBar active="inventory" />
    </div>
  );
}

/** Same brand, material and colour is the same filament, however many reels of it you have. */
function groupKey(spool: Spool): string {
  return `${spool.brand}|${spool.material}|${spool.colorName}|${spool.hex}`.toLowerCase();
}

function Section({
  title,
  spools,
  inv,
  open,
  toggle,
}: {
  title: string;
  spools: Spool[];
  inv: Inv;
  open: Record<string, boolean>;
  toggle: (key: string) => void;
}): JSX.Element {
  const groups = new Map<string, Spool[]>();
  for (const spool of spools) {
    const key = groupKey(spool);
    groups.set(key, [...(groups.get(key) ?? []), spool]);
  }

  return (
    <>
      <div class="sectionhead">
        <span class="label grow">
          {title} · {spools.length}
        </span>
      </div>
      {[...groups.entries()].map(([key, members]) =>
        members.length === 1 ? (
          <SpoolRow key={key} spool={members[0]} inv={inv} />
        ) : (
          <GroupRow
            key={key}
            members={members}
            inv={inv}
            expanded={Boolean(open[key])}
            onToggle={() => toggle(key)}
          />
        ),
      )}
    </>
  );
}

function GroupRow({
  members,
  inv,
  expanded,
  onToggle,
}: {
  members: Spool[];
  inv: Inv;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const first = members[0];
  const grams = members.reduce((total, s) => total + remainingGrams(s), 0);
  const sealed = members.filter((s) => s.sealed).length;
  const amount = grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;

  return (
    <>
      <button type="button" class="listrow" aria-expanded={expanded} onClick={onToggle}>
        <Swatch hex={first.hex} hexes={first.hexes} />
        <span class="grow">
          <span class="listrow__name truncate" style={{ display: 'block' }}>
            {first.colorName}
          </span>
          <span class="listrow__sub truncate" style={{ display: 'block' }}>
            {first.brand} · {first.material}
            {sealed > 0 && ` · ${sealed} sealed`}
          </span>
        </span>
        <span style={{ flexShrink: 0, textAlign: 'right' }}>
          <span class="pill" style={{ display: 'block', fontWeight: 600, color: 'var(--text)' }}>
            {members.length} reels
          </span>
          <span class="mono" style={{ display: 'block', fontSize: '11.5px', color: 'var(--faint)', marginTop: '5px' }}>
            ≈ {amount}
          </span>
        </span>
        <span style={{ flexShrink: 0, color: 'var(--ghost)', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          <Icon name="chevronRight" size={16} />
        </span>
      </button>

      {expanded && (
        <div style={{ paddingLeft: '24px', borderLeft: '1px solid var(--line-soft)', marginLeft: '18px' }}>
          {members.map((spool) => (
            <SpoolRow key={spool.id} spool={spool} inv={inv} />
          ))}
        </div>
      )}
    </>
  );
}

function SpoolRow({ spool, inv }: { spool: Spool; inv: Inv }): JSX.Element {
  const detail = [spool.brand, spool.material, spool.form === 'refill' ? (spool.mounted ? 'refill on spool' : 'refill') : `${spool.netWeightG} g`]
    .filter(Boolean)
    .join(' · ');

  return (
    <a class="listrow" href={href(`/spool/${spool.id}`)}>
      <Swatch hex={spool.hex} hexes={spool.hexes} />
      <span class="grow">
        <span class="listrow__name truncate" style={{ display: 'block' }}>
          {spool.colorName}
        </span>
        <span class="listrow__sub truncate" style={{ display: 'block' }}>
          {detail}
        </span>
      </span>
      <span style={{ flexShrink: 0, textAlign: 'right' }}>
        {needsSpool(spool) ? (
          <span class="pill" style={{ background: 'rgba(232,163,61,0.13)', color: 'var(--accent)', fontWeight: 600 }}>
            Needs spool
          </span>
        ) : spool.sealed ? (
          <span class="pill" style={{ color: 'var(--green-text)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Icon name="lock" size={11} /> Sealed
          </span>
        ) : (
          <>
            <span class="pill" style={{ display: 'block' }}>
              {locationText(inv, spool.location)}
            </span>
            <span class="row" style={{ gap: '7px', marginTop: '5px', justifyContent: 'flex-end' }}>
              <span style={{ width: '48px' }}>
                <Bar pct={spool.remainingPct} />
              </span>
              <span class="mono" style={{ fontSize: '11.5px', color: pctColor(spool.remainingPct) }}>
                {spool.remainingPct}%
              </span>
            </span>
          </>
        )}
      </span>
    </a>
  );
}
