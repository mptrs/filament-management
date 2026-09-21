import type { JSX } from 'preact';
import { useApp } from '../lib/store';
import { href } from '../lib/router';
import { Icon, Note, Swatch, TabBar } from '../components/ui';
import { mountRefill, setEmptySpools, unmountRefill } from '../lib/actions';

export function Refills(): JSX.Element {
  const { inv } = useApp();
  const refills = inv.spools.filter((s) => s.form === 'refill');
  const waiting = refills.filter((s) => !s.mounted);
  const mounted = refills.filter((s) => s.mounted);
  const short = waiting.length > inv.emptySpools;

  return (
    <div class="screen screen--tabbed">
      <header class="topbar" style={{ display: 'block' }}>
        <h1>Refills</h1>
        <div class="topbar__sub">Spool-less filament and the spools to put it on</div>
      </header>

      <div class="screen__body">
        <div class="card row" style={{ gap: '14px' }}>
          <div class="grow">
            <div style={{ fontFamily: 'var(--display)', fontSize: '40px', fontWeight: 700, lineHeight: 1 }}>
              {inv.emptySpools}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '5px' }}>empty spools free</div>
            <div class="muted" style={{ marginTop: '2px' }}>Reusable spools with nothing on them</div>
          </div>
          <div class="stepper">
            <button type="button" aria-label="One fewer empty spool" onClick={() => setEmptySpools(inv.emptySpools - 1)}>
              <Icon name="minus" size={16} />
            </button>
            <span>{inv.emptySpools}</span>
            <button type="button" aria-label="One more empty spool" onClick={() => setEmptySpools(inv.emptySpools + 1)}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>

        {short && (
          <div style={{ marginTop: '12px' }}>
            <Note tone="warn" icon="warn">
              {waiting.length} {waiting.length === 1 ? 'refill is' : 'refills are'} waiting and only {inv.emptySpools}{' '}
              {inv.emptySpools === 1 ? 'spool is' : 'spools are'} free. Finish a spool or buy an empty one.
            </Note>
          </div>
        )}

        {refills.length === 0 && (
          <div class="empty">
            No refills logged.
            <br />
            <a href={href('/add')}>Add one</a> and mark it as a refill.
          </div>
        )}

        {waiting.length > 0 && (
          <>
            <div class="sectionhead">
              <span class="label grow">Waiting for a spool · {waiting.length}</span>
            </div>
            {waiting.map((s) => (
              <div class="listrow" key={s.id}>
                <Swatch hex={s.hex} hexes={s.hexes} />
                <a class="grow" href={href(`/spool/${s.id}`)} style={{ color: 'inherit' }}>
                  <span class="listrow__name truncate" style={{ display: 'block' }}>
                    {s.colorName}
                  </span>
                  <span class="listrow__sub truncate" style={{ display: 'block' }}>
                    {s.brand} · {s.material} · {s.netWeightG} g refill
                  </span>
                </a>
                <button
                  type="button"
                  class="chip"
                  data-on={inv.emptySpools > 0}
                  disabled={inv.emptySpools === 0}
                  onClick={() => mountRefill(s.id)}
                >
                  Mount
                </button>
              </div>
            ))}
          </>
        )}

        {mounted.length > 0 && (
          <>
            <div class="sectionhead">
              <span class="label grow">Mounted on a spool · {mounted.length}</span>
            </div>
            {mounted.map((s) => (
              <div class="listrow" key={s.id}>
                <Swatch hex={s.hex} hexes={s.hexes} />
                <a class="grow" href={href(`/spool/${s.id}`)} style={{ color: 'inherit' }}>
                  <span class="listrow__name truncate" style={{ display: 'block' }}>
                    {s.colorName}
                  </span>
                  <span class="listrow__sub truncate" style={{ display: 'block' }}>
                    {s.brand} · {s.material} · {s.remainingPct}% left
                  </span>
                </a>
                <button type="button" class="chip" onClick={() => unmountRefill(s.id)}>
                  Free up
                </button>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: '18px' }}>
          <Note>Freeing up a spool returns it to the pool and sends that filament back to storage.</Note>
        </div>
      </div>

      <TabBar active="refills" />
    </div>
  );
}
