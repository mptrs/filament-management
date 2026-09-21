import type { JSX } from 'preact';
import { useApp } from '../lib/store';
import { back, href } from '../lib/router';
import { locationText, needsSpool, totalSlots, type Location, type Spool } from '../lib/types';
import { Bar, Icon, Note, Swatch, pctColor } from '../components/ui';
import { setLocation } from '../lib/actions';

export function LoadSlot({ printerId, slot }: { printerId: string; slot: number }): JSX.Element {
  const { inv } = useApp();
  const printer = inv.printers.find((p) => p.id === printerId);

  if (!printer || slot < 1 || slot > totalSlots(printer)) {
    return (
      <div class="screen">
        <header class="topbar">
          <Icon name="printer" />
          <div class="topbar__title">Load slot</div>
        </header>
        <div class="screen__body">
          <div class="empty">That slot no longer exists.</div>
        </div>
      </div>
    );
  }

  const target: Location =
    printer.amsUnits > 0 ? { kind: 'ams', printer: printerId, slot } : { kind: 'direct', printer: printerId };
  const where = printer.amsUnits > 0 ? `${printer.name} · A${slot}` : printer.name;

  const load = (spool: Spool): void => {
    setLocation(spool.id, target);
    back('/');
  };

  // Reach for something already open before breaking the seal on a new one.
  const order = (a: Spool, b: Spool): number =>
    Number(a.sealed) - Number(b.sealed) || a.colorName.localeCompare(b.colorName);

  const ready = inv.spools.filter((s) => s.location.kind === 'storage' && !needsSpool(s)).sort(order);
  const stuck = inv.spools.filter((s) => s.location.kind === 'storage' && needsSpool(s)).sort(order);
  const elsewhere = inv.spools
    .filter((s) => s.location.kind !== 'storage' && !(s.location.printer === printerId && sameSlot(s, printer.amsUnits > 0, slot)))
    .sort(order);

  return (
    <div class="screen">
      <header class="topbar">
        <a class="iconbtn" href={href('/')} aria-label="Back to printers">
          <Icon name="chevronLeft" />
        </a>
        <div class="grow">
          <div class="topbar__title">Load {printer.amsUnits > 0 ? `A${slot}` : printer.name}</div>
          <div class="muted">{where}</div>
        </div>
      </header>

      <div class="screen__body">
        {ready.length === 0 && stuck.length === 0 && elsewhere.length === 0 ? (
          <>
            <div class="empty" style={{ paddingBottom: '16px' }}>
              Nothing in storage to load.
            </div>
            <a class="btn btn--block" href={href(`/add?printer=${printerId}&slot=${slot}`)} style={{ display: 'block', textAlign: 'center' }}>
              Add a new spool
            </a>
          </>
        ) : (
          <>
            {ready.length > 0 && (
              <>
                <div class="sectionhead" style={{ marginTop: '6px' }}>
                  <span class="label grow">From storage · {ready.length}</span>
                </div>
                {ready.map((s) => (
                  <button key={s.id} type="button" class="listrow" onClick={() => load(s)}>
                    <Swatch hex={s.hex} hexes={s.hexes} />
                    <span class="grow">
                      <span class="listrow__name truncate" style={{ display: 'block' }}>
                        {s.colorName}
                      </span>
                      <span class="listrow__sub truncate" style={{ display: 'block' }}>
                        {s.brand} · {s.material}
                        {s.form === 'refill' ? ' · refill on spool' : ''}
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, textAlign: 'right' }}>
                      {s.sealed ? (
                        <span class="pill" style={{ color: 'var(--green-text)' }}>Sealed</span>
                      ) : (
                        <span class="row" style={{ gap: '7px', justifyContent: 'flex-end' }}>
                          <span style={{ width: '44px' }}>
                            <Bar pct={s.remainingPct} />
                          </span>
                          <span class="mono" style={{ fontSize: '11.5px', color: pctColor(s.remainingPct) }}>
                            {s.remainingPct}%
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </>
            )}

            {elsewhere.length > 0 && (
              <>
                <div class="sectionhead">
                  <span class="label grow">Move from another slot · {elsewhere.length}</span>
                </div>
                {elsewhere.map((s) => (
                  <button key={s.id} type="button" class="listrow" onClick={() => load(s)}>
                    <Swatch hex={s.hex} hexes={s.hexes} />
                    <span class="grow">
                      <span class="listrow__name truncate" style={{ display: 'block' }}>
                        {s.colorName}
                      </span>
                      <span class="listrow__sub truncate" style={{ display: 'block' }}>
                        {s.brand} · {s.material}
                      </span>
                    </span>
                    <span class="pill" style={{ flexShrink: 0 }}>
                      {locationText(inv, s.location)}
                    </span>
                  </button>
                ))}
              </>
            )}

            {stuck.length > 0 && (
              <>
                <div class="sectionhead">
                  <span class="label grow">Needs a spool first · {stuck.length}</span>
                </div>
                {stuck.map((s) => (
                  <a key={s.id} class="listrow" href={href('/refills')} style={{ opacity: 0.55 }}>
                    <Swatch hex={s.hex} hexes={s.hexes} />
                    <span class="grow">
                      <span class="listrow__name truncate" style={{ display: 'block' }}>
                        {s.colorName}
                      </span>
                      <span class="listrow__sub truncate" style={{ display: 'block' }}>
                        {s.brand} · {s.material} · refill
                      </span>
                    </span>
                    <span class="pill" style={{ flexShrink: 0, color: 'var(--accent)' }}>
                      Mount it
                    </span>
                  </a>
                ))}
              </>
            )}

            <a
              href={href(`/add?printer=${printerId}&slot=${slot}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: '1px dashed #343941', borderRadius: '16px', padding: '16px', marginTop: '18px' }}
            >
              <Icon name="plus" />
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Add a new spool</span>
            </a>

            <div style={{ marginTop: '14px' }}>
              <Note>Loading a sealed spool marks it opened — you had to break the seal to get it in.</Note>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function sameSlot(spool: Spool, hasAms: boolean, slot: number): boolean {
  if (spool.location.kind === 'ams') return hasAms && spool.location.slot === slot;
  return spool.location.kind === 'direct' && !hasAms;
}
