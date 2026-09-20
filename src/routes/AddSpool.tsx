import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { navigate, query } from '../lib/router';
import { brands, colorsFor, materialsFor } from '../lib/catalog';
import type { Location } from '../lib/types';
import { BackButton, Note, Swatch, TabBar } from '../components/ui';
import { addSpool, decodeLocation, encodeLocation, locationOptions } from '../lib/actions';

interface Picked {
  brand: string;
  material: string;
  color: string;
  hex: string;
}

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

  const [step, setStep] = useState<1 | 2>(1);
  const [brand, setBrand] = useState(brands[0] ?? 'Bambu Lab');
  const materials = materialsFor(brand);
  const [material, setMaterial] = useState(materials[0] ?? 'PLA Basic');
  const activeMaterial = materials.includes(material) ? material : (materials[0] ?? '');
  const colors = colorsFor(brand, activeMaterial);
  const [picked, setPicked] = useState<Picked | null>(null);

  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#888888');
  const [customBrand, setCustomBrand] = useState('');

  const [location, setLoc] = useState<Location>(initialLocation);
  const [form, setForm] = useState<'spool' | 'refill'>('spool');
  const [mounted, setMounted] = useState(false);
  const [sealed, setSealed] = useState(true);
  const [remaining, setRemaining] = useState(100);
  const [weight, setWeight] = useState(1000);

  const selection: Picked | null = custom
    ? customName
      ? { brand: customBrand || 'Other', material: activeMaterial || 'PLA', color: customName, hex: customHex }
      : null
    : picked;

  if (step === 2 && selection) {
    return (
      <div class="screen">
        <header class="topbar">
          <BackButton to="/add" label="Back to colour" />
          <div class="topbar__title">Spool details</div>
          <span class="muted">2 of 2</span>
        </header>

        <div class="screen__body">
          <div class="card row">
            <Swatch hex={selection.hex} size={44} />
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

  return (
    <div class="screen screen--tabbed">
      <header class="topbar">
        <div class="topbar__title">Add spool</div>
        <span class="muted">1 of 2</span>
      </header>

      <div class="screen__body">
        <div class="seg">
          {brands.map((b) => (
            <button key={b} type="button" data-on={!custom && brand === b} onClick={() => { setCustom(false); setBrand(b); setPicked(null); }}>
              {b}
            </button>
          ))}
          <button type="button" data-on={custom} onClick={() => setCustom(true)}>
            Other
          </button>
        </div>

        <div class="row" style={{ gap: '7px', marginTop: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          {materials.map((m) => (
            <button key={m} type="button" class="chip" data-on={activeMaterial === m} onClick={() => { setMaterial(m); setPicked(null); }}>
              {m}
            </button>
          ))}
        </div>

        {custom ? (
          <div style={{ marginTop: '18px' }}>
            <label class="label" for="cb" style={{ marginBottom: '8px' }}>
              Brand
            </label>
            <input id="cb" class="field" value={customBrand} placeholder="Sunlu, Polymaker, …" onInput={(e) => setCustomBrand((e.target as HTMLInputElement).value)} />

            <label class="label" for="cn" style={{ margin: '14px 0 8px' }}>
              Colour name
            </label>
            <input id="cn" class="field" value={customName} placeholder="Forest Green" onInput={(e) => setCustomName((e.target as HTMLInputElement).value)} />

            <label class="label" for="ch" style={{ margin: '14px 0 8px' }}>
              Colour
            </label>
            <div class="row" style={{ gap: '10px' }}>
              <input id="ch" type="color" value={customHex} onInput={(e) => setCustomHex((e.target as HTMLInputElement).value)} style={{ width: '56px', height: '46px', background: 'none', border: '1px solid var(--line)', borderRadius: '11px', padding: '4px' }} />
              <input class="field grow mono" value={customHex} onInput={(e) => setCustomHex((e.target as HTMLInputElement).value)} />
            </div>
          </div>
        ) : (
          <>
            <div class="sectionhead">
              <span class="label grow">Catalogue colour</span>
              <span class="muted">{colors.length} in this range</span>
            </div>
            <div class="grid-colors">
              {colors.map((c) => (
                <button
                  key={`${c.color}-${c.hex}`}
                  type="button"
                  class="colortile"
                  data-on={picked?.color === c.color && picked?.hex === c.hex}
                  aria-label={c.color}
                  onClick={() => setPicked({ brand: c.brand, material: c.material, color: c.color, hex: c.hex })}
                >
                  <span class="colortile__swatch" style={{ background: c.hex }} />
                  <span class="colortile__name">{c.color}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" class="btn btn--block" style={{ marginTop: '20px' }} disabled={!selection} onClick={() => setStep(2)}>
          {selection ? `Next: ${selection.color}` : 'Pick a colour'}
        </button>
      </div>

      <TabBar active="add" />
    </div>
  );
}
