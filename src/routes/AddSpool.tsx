import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { navigate, query } from '../lib/router';
import type { Location } from '../lib/types';
import { BackButton, Note, Swatch } from '../components/ui';
import { ColorPicker, type Picked } from '../components/ColorPicker';
import { addSpool, decodeLocation, encodeLocation, locationOptions } from '../lib/actions';

export function AddSpool(): JSX.Element {
  const { inv } = useApp();
  const params = query();

  const initialLocation: Location = useMemo(() => {
    const printer = params.get('printer');
    const slot = params.get('slot');
    if (!printer) return { kind: 'storage' };
    const target = inv.printers.find((p) => p.id === printer);
    if (!target) return { kind: 'storage' };
    return target.amsUnits > 0 ? { kind: 'ams', printer, slot: Number(slot ?? 1) } : { kind: 'direct', printer };
    // The query string is read once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selection, setSelection] = useState<Picked | null>(null);

  const [location, setLoc] = useState<Location>(initialLocation);
  const [form, setForm] = useState<'spool' | 'refill'>('spool');
  const [mounted, setMounted] = useState(false);
  const [sealed, setSealed] = useState(true);
  const [remaining, setRemaining] = useState(100);
  const [weight, setWeight] = useState(1000);

  if (!selection) {
    return (
      <ColorPicker
        title="Add spool"
        meta="1 of 2"
        withTabBar
        actionLabel={(s) => `Next: ${s.color}`}
        onPick={setSelection}
      />
    );
  }

  return (
      <div class="screen">
        <header class="topbar">
          <BackButton label="Back to colour" onBack={() => setSelection(null)} />
          <div class="topbar__title">Spool details</div>
          <span class="muted">2 of 2</span>
        </header>

        <div class="screen__body">
          <div class="card row">
            <Swatch hex={selection.hex} hexes={selection.hexes} size={44} />
            <div class="grow">
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{selection.color}</div>
              <div class="muted" style={{ marginTop: '2px' }}>
                {selection.brand} · {selection.material}
              </div>
            </div>
            <span class="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
              {selection.hex.toUpperCase()}
            </span>
          </div>

          <div style={{ marginTop: '16px' }}>
            <span class="label" style={{ marginBottom: '8px' }}>
              What arrived
            </span>
            <div class="seg">
              <button type="button" data-on={form === 'spool'} onClick={() => { setForm('spool'); setMounted(false); }}>
                On a spool
              </button>
              <button type="button" data-on={form === 'refill'} onClick={() => setForm('refill')}>
                Refill
              </button>
            </div>
          </div>

          {form === 'refill' && (
            <div style={{ marginTop: '12px' }}>
              <label class="row card" style={{ gap: '12px' }}>
                <span class="grow">
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600 }}>Already on a reusable spool</span>
                  <span class="muted" style={{ display: 'block', marginTop: '3px' }}>
                    {inv.emptySpools} empty {inv.emptySpools === 1 ? 'spool' : 'spools'} free
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={mounted}
                  disabled={inv.emptySpools === 0}
                  onChange={(e) => setMounted((e.target as HTMLInputElement).checked)}
                  style={{ width: '22px', height: '22px', accentColor: 'var(--accent)' }}
                />
              </label>
            </div>
          )}

          <div style={{ marginTop: '14px' }}>
            <span class="label" style={{ marginBottom: '8px' }}>
              Packaging
            </span>
            <div class="seg">
              <button type="button" data-on={sealed} onClick={() => { setSealed(true); setRemaining(100); }}>
                Sealed
              </button>
              <button type="button" data-on={!sealed} onClick={() => setSealed(false)}>
                Already opened
              </button>
            </div>
          </div>

          {!sealed && (
            <div style={{ marginTop: '14px' }}>
              <div class="row" style={{ alignItems: 'baseline' }}>
                <label class="label grow" for="rem2">
                  Roughly how full
                </label>
                <span class="mono" style={{ fontSize: '15px' }}>
                  {remaining}%
                </span>
              </div>
              <input
                id="rem2"
                class="range"
                type="range"
                min={0}
                max={100}
                step={5}
                value={remaining}
                style={{ marginTop: '14px', '--track': `linear-gradient(90deg, #4fb477 0 ${remaining}%, #0c0d10 ${remaining}% 100%)` }}
                onInput={(e) => setRemaining(Number((e.target as HTMLInputElement).value))}
              />
            </div>
          )}

          <div class="row" style={{ marginTop: '14px', gap: '10px', alignItems: 'flex-start' }}>
            <div class="grow">
              <label class="label" for="addloc" style={{ marginBottom: '8px' }}>
                Where is it
              </label>
              <select id="addloc" class="field" value={encodeLocation(location)} onChange={(e) => setLoc(decodeLocation((e.target as HTMLSelectElement).value))}>
                {locationOptions(inv.printers).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div class="grow">
              <label class="label" for="weight" style={{ marginBottom: '8px' }}>
                Net weight
              </label>
              <select id="weight" class="field" value={String(weight)} onChange={(e) => setWeight(Number((e.target as HTMLSelectElement).value))}>
                <option value="1000">1 kg</option>
                <option value="750">750 g</option>
                <option value="500">500 g</option>
                <option value="250">250 g</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            class="btn btn--block"
            style={{ marginTop: '20px' }}
            onClick={() => {
              const id = addSpool({
                brand: selection.brand,
                material: selection.material,
                colorName: selection.color,
                hex: selection.hex,
                hexes: selection.hexes,
                form,
                mounted: form === 'refill' ? mounted : false,
                netWeightG: weight,
                remainingPct: sealed ? 100 : remaining,
                sealed,
                openedAt: sealed ? undefined : new Date().toISOString(),
                dryState: 'dry',
                location: form === 'refill' && !mounted ? { kind: 'storage' } : location,
              });
              navigate(`/spool/${id}`, { replace: true });
            }}
          >
            Add to inventory
          </button>

          {form === 'refill' && !mounted && (
            <div style={{ marginTop: '12px' }}>
              <Note>A refill with no spool under it goes to storage until you mount it.</Note>
            </div>
          )}
        </div>
      </div>
    );
}
