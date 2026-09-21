import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { brands, colorsFor, materialsFor } from '../lib/catalog';
import { BackButton, Swatch, TabBar, swatchBackground } from './ui';

export interface Picked {
  brand: string;
  material: string;
  color: string;
  hex: string;
  hexes?: string[];
}

/**
 * The catalogue browser, shared by adding a spool and correcting the colour of
 * one you already have.
 */
export function ColorPicker({
  title,
  meta,
  backTo,
  onBack,
  withTabBar,
  initial,
  actionLabel,
  onPick,
}: {
  title: string;
  meta?: string;
  backTo?: string;
  onBack?: () => void;
  withTabBar?: boolean;
  initial?: { brand?: string; material?: string };
  actionLabel: (picked: Picked) => string;
  onPick: (picked: Picked) => void;
}): JSX.Element {
  const known = initial?.brand && brands.includes(initial.brand) ? initial.brand : brands[0];
  const [brand, setBrand] = useState(known ?? 'Bambu Lab');
  const materials = materialsFor(brand);
  const [material, setMaterial] = useState(initial?.material ?? materials[0] ?? '');
  const activeMaterial = materials.includes(material) ? material : (materials[0] ?? '');
  const colors = colorsFor(brand, activeMaterial);
  const [picked, setPicked] = useState<Picked | null>(null);

  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#888888');
  const [customBrand, setCustomBrand] = useState('');

  const selection: Picked | null = custom
    ? customName
      ? { brand: customBrand || 'Other', material: activeMaterial || 'PLA', color: customName, hex: customHex }
      : null
    : picked;

  return (
    <div class={withTabBar ? 'screen screen--tabbed' : 'screen'}>
      <header class="topbar">
        {(backTo || onBack) && <BackButton to={backTo} onBack={onBack} label="Back" />}
        <div class="topbar__title">{title}</div>
        {meta && <span class="muted">{meta}</span>}
      </header>

      <div class="screen__body">
        <div class="seg">
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              data-on={!custom && brand === b}
              onClick={() => {
                setCustom(false);
                setBrand(b);
                setPicked(null);
              }}
            >
              {b}
            </button>
          ))}
          <button type="button" data-on={custom} onClick={() => setCustom(true)}>
            Other
          </button>
        </div>

        <div class="row" style={{ gap: '7px', marginTop: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          {materials.map((m) => (
            <button
              key={m}
              type="button"
              class="chip"
              data-on={activeMaterial === m}
              onClick={() => {
                setMaterial(m);
                setPicked(null);
              }}
            >
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
              <input
                id="ch"
                type="color"
                value={customHex}
                onInput={(e) => setCustomHex((e.target as HTMLInputElement).value)}
                style={{ width: '56px', height: '46px', background: 'none', border: '1px solid var(--line)', borderRadius: '11px', padding: '4px' }}
              />
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
                  onClick={() => setPicked({ brand: c.brand, material: c.material, color: c.color, hex: c.hex, hexes: c.hexes })}
                >
                  <span class="colortile__swatch" style={{ background: swatchBackground(c.hex, c.hexes) }} />
                  <span class="colortile__name">{c.color}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {selection && (
          <div class="card row" style={{ marginTop: '18px', gap: '11px' }}>
            <Swatch hex={selection.hex} hexes={selection.hexes} size={38} />
            <span class="grow">
              <span class="listrow__name truncate" style={{ display: 'block' }}>
                {selection.color}
              </span>
              <span class="listrow__sub truncate" style={{ display: 'block' }}>
                {selection.brand} · {selection.material}
              </span>
            </span>
            <span class="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
              {selection.hex.toUpperCase()}
            </span>
          </div>
        )}

        <button type="button" class="btn btn--block" style={{ marginTop: '14px' }} disabled={!selection} onClick={() => selection && onPick(selection)}>
          {selection ? actionLabel(selection) : 'Pick a colour'}
        </button>
      </div>

      {withTabBar && <TabBar active="add" />}
    </div>
  );
}
