import type { JSX } from 'preact';
import { useApp } from '../lib/store';
import { back, href } from '../lib/router';
import { isLoaded, locationText, remainingGrams, type DryState } from '../lib/types';
import { BackButton, Icon, Note, pctColor, swatchBackground } from '../components/ui';
import {
  decodeLocation,
  deleteSpool,
  encodeLocation,
  locationOptions,
  markEmpty,
  mountRefill,
  setLocation,
  setSealed,
  unloadSpool,
  unmountRefill,
  updateSpool,
} from '../lib/actions';
import { shortDate } from '../lib/util';

const DRY_STATES: Array<{ id: DryState; label: string }> = [
  { id: 'dry', label: 'Dry' },
  { id: 'needs-drying', label: 'Needs drying' },
  { id: 'drying', label: 'Drying now' },
];

export function SpoolDetail({ id }: { id: string }): JSX.Element {
  const { inv } = useApp();
  const spool = inv.spools.find((s) => s.id === id);

  if (!spool) {
    return (
      <div class="screen">
        <header class="topbar">
          <BackButton to="/inventory" label="Back to inventory" />
          <div class="topbar__title">Spool</div>
        </header>
        <div class="screen__body">
          <div class="empty">That spool is no longer in the inventory.</div>
        </div>
      </div>
    );
  }

  const grounded = spool.form === 'refill' && !spool.mounted;
  // A refill with nothing to wind it onto can only sit in storage.
  const options = grounded
    ? locationOptions(inv.printers).filter((o) => o.value === 'storage')
    : locationOptions(inv.printers);
  const formValue = spool.form === 'spool' ? 'spool' : spool.mounted ? 'refill-mounted' : 'refill';

  const onFormChange = (value: string): void => {
    if (value === 'spool') {
      if (spool.form === 'refill' && spool.mounted) unmountRefill(spool.id);
      updateSpool(spool.id, { form: 'spool', mounted: false }, 'Spool type changed');
    } else if (value === 'refill-mounted') {
      updateSpool(spool.id, { form: 'refill' }, 'Spool type changed');
      if (!spool.mounted) mountRefill(spool.id);
    } else {
      if (spool.mounted) unmountRefill(spool.id);
      updateSpool(spool.id, { form: 'refill', mounted: false }, 'Spool type changed');
    }
  };

  return (
    <div class="screen">
      <header class="topbar">
        <BackButton label="Back" />
        <div class="topbar__title">Edit spool</div>
        <button type="button" class="btn btn--sm" onClick={() => back('/inventory')}>
          Done
        </button>
      </header>

      <div class="screen__body">
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--line)' }}>
          <div style={{ height: '76px', background: swatchBackground(spool.hex, spool.hexes) }} />
          <div class="row" style={{ background: 'var(--surface)', padding: '12px 14px' }}>
            <div class="grow">
              <div style={{ fontFamily: 'var(--display)', fontSize: '18px', fontWeight: 700 }}>{spool.colorName}</div>
              <div class="muted" style={{ marginTop: '2px' }}>
                {spool.brand} · {spool.material} · {spool.netWeightG} g
              </div>
            </div>
            <div class="mono" style={{ fontSize: '11.5px', color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '7px', padding: '5px 9px' }}>
              {spool.hex.toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div class="row" style={{ alignItems: 'baseline', gap: '8px' }}>
            <label class="label grow" for="rem">
              Remaining
            </label>
            <span class="mono" style={{ fontSize: '15px', color: pctColor(spool.remainingPct) }}>
              {spool.remainingPct}%
            </span>
            <span class="muted">≈ {remainingGrams(spool)} g</span>
          </div>
          {spool.sealed && (
            <div class="muted" style={{ marginTop: '6px' }}>
              Sealed, so it counts as full. Mark it opened to set a level.
            </div>
          )}
          <input
            id="rem"
            class="range"
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={spool.sealed}
            value={spool.remainingPct}
            style={{
              marginTop: '14px',
              // The track shows the same fill the bars elsewhere use.
              '--track': `linear-gradient(90deg, ${
                spool.remainingPct <= 15 ? '#d9594c' : spool.remainingPct <= 30 ? '#e8a33d' : '#4fb477'
              } 0 ${spool.remainingPct}%, #0c0d10 ${spool.remainingPct}% 100%)`,
            }}
            onInput={(e) =>
              updateSpool(spool.id, { remainingPct: Number((e.target as HTMLInputElement).value) }, 'Update remaining filament')
            }
          />
        </div>

        <div style={{ marginTop: '14px' }}>
          <span class="label" style={{ marginBottom: '8px' }}>
            Packaging
          </span>
          <div class="seg">
            <button
              type="button"
              data-on={spool.sealed}
              onClick={() => setSealed(spool.id, true)}
            >
              Sealed
            </button>
            <button
              type="button"
              data-on={!spool.sealed}
              onClick={() => setSealed(spool.id, false)}
            >
              Opened
            </button>
          </div>
          {!spool.sealed && spool.openedAt && <div class="muted" style={{ marginTop: '7px' }}>Opened {shortDate(spool.openedAt)}</div>}
        </div>

        <div style={{ marginTop: '14px' }}>
          <span class="label" style={{ marginBottom: '8px' }}>
            Moisture
          </span>
          {spool.sealed ? (
            <div class="card card--quiet muted">Still sealed, so it is dry. This matters once you open it.</div>
          ) : (
          <div class="row" style={{ gap: '7px' }}>
            {DRY_STATES.map((d) => (
              <button
                key={d.id}
                type="button"
                class="chip"
                data-on={spool.dryState === d.id}
                style={{ flexGrow: 1, textAlign: 'center' }}
                onClick={() =>
                  updateSpool(
                    spool.id,
                    { dryState: d.id, driedAt: d.id === 'dry' ? new Date().toISOString() : spool.driedAt },
                    'Update moisture state',
                  )
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          )}
        </div>

        <div class="row" style={{ marginTop: '14px', gap: '10px', alignItems: 'flex-start' }}>
          <div class="grow">
            <label class="label" for="loc" style={{ marginBottom: '8px' }}>
              Location
            </label>
            <select
              id="loc"
              class="field"
              value={encodeLocation(spool.location)}
              onChange={(e) => setLocation(spool.id, decodeLocation((e.target as HTMLSelectElement).value))}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div class="grow">
            <label class="label" for="form" style={{ marginBottom: '8px' }}>
              Spool
            </label>
            <select id="form" class="field" value={formValue} onChange={(e) => onFormChange((e.target as HTMLSelectElement).value)}>
              <option value="spool">On its own spool</option>
              <option value="refill-mounted">Refill on reusable</option>
              <option value="refill">Refill, no spool</option>
            </select>
          </div>
        </div>

        {isLoaded(spool) && (
          <button
            type="button"
            class="btn btn--ghost btn--block row"
            style={{ marginTop: '12px', justifyContent: 'center', gap: '9px' }}
            onClick={() => unloadSpool(spool.id)}
          >
            <Icon name="eject" size={16} />
            <span>Take out of {locationText(inv, spool.location)}</span>
          </button>
        )}

        {grounded && (
          <div style={{ marginTop: '12px' }}>
            <Note tone="warn" icon="warn">
              A refill with no spool under it can only sit in storage.{' '}
              {inv.emptySpools === 0
                ? 'No empty spools are free.'
                : `${inv.emptySpools} empty ${inv.emptySpools === 1 ? 'spool is' : 'spools are'} free.`}{' '}
              <a href={href('/refills')}>Mount it</a>
            </Note>
          </div>
        )}

        <div style={{ marginTop: '14px' }}>
          <label class="label" for="notes" style={{ marginBottom: '8px' }}>
            Notes
          </label>
          <textarea
            id="notes"
            class="field"
            rows={2}
            placeholder="Print settings, quirks, where it came from"
            value={spool.notes ?? ''}
            onChange={(e) => updateSpool(spool.id, { notes: (e.target as HTMLTextAreaElement).value }, 'Update spool notes')}
          />
        </div>

        <div class="row" style={{ gap: '9px', marginTop: '16px' }}>
          <button
            type="button"
            class="btn btn--ghost grow"
            onClick={() => markEmpty(spool.id)}
          >
            Mark empty
          </button>
          <button
            type="button"
            class="btn btn--danger grow"
            onClick={() => {
              if (confirm(`Remove ${spool.colorName} from the inventory?`)) {
                deleteSpool(spool.id);
                back('/inventory');
              }
            }}
          >
            Remove
          </button>
        </div>

        <div class="row" style={{ justifyContent: 'center', gap: '7px', margin: '16px 0 8px', color: 'var(--faint)' }}>
          <Icon name="github" size={13} />
          <span style={{ fontSize: '11px' }}>
            Every change commits to <span class="mono">inventory.json</span>
          </span>
        </div>
      </div>
    </div>
  );
}
