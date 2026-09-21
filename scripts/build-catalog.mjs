#!/usr/bin/env node
/**
 * Builds the colour catalogue the app bundles, from data/catalog-raw.json.
 *
 *   node scripts/build-catalog.mjs              rebuild from the raw file
 *   node scripts/build-catalog.mjs --refresh    re-pull the online sources too
 *   python3 scripts/fetch-bambu-pdfs.py         re-parse Bambu's own PDFs
 *
 * Three sources, in order of authority:
 *   bambu-official      Bambu's published hex tables - what their store shows
 *   spoolmandb          community database, the broadest coverage by far
 *   filamentcolors.xyz  measured from printed swatches, fills the gaps
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'catalog-raw.json');
const OUT = join(root, 'src', 'catalog.generated.json');

const PRIORITY = { 'bambu-official': 3, spoolmandb: 2, 'filamentcolors.xyz': 1 };

const BRANDS = { ELEGOO: 'Elegoo', 'Bambu Lab': 'Bambu Lab' };

/**
 * Both community sources file everything under a bare family ("PLA") and put
 * the actual range in the colour name ("Matte Ivory White", "RAPID PETG Blue").
 * Splitting them back out is what stops Bambu's official "PLA Matte / Ivory
 * White" and a community "PLA / Matte Ivory White" becoming two entries.
 *
 * Ordered: first match wins. `cut` is stripped off the front of the name.
 */
const RANGES = {
  'Bambu Lab': [
    [/^Matte /i, 'PLA Matte', true],
    [/^Silk\+ /i, 'PLA Silk+', true],
    [/^Silk /i, 'PLA Silk+', true],
    [/^Translucent /i, 'PLA Translucent', true],
    [/^Glow /i, 'PLA Glow', true],
    [/^Lite /i, 'PLA Lite', true],
    [/^Tough\+? /i, 'Tough PLA', true],
    [/^Pure /i, 'PLA Pure', true],
    [/^Aero /i, 'PLA Aero', true],
    [/^Support/i, 'Support', false],
    [/ Sparkle$/i, 'PLA Sparkle', false],
    [/ Galaxy$|^Galaxy /i, 'PLA Galaxy', false],
    [/Marble/i, 'PLA Marble', false],
    [/Metal/i, 'PLA Metal', false],
  ],
  Elegoo: [
    [/^RAPID PETG /i, 'Rapid PETG', true],
    [/^PETG PRO /i, 'PETG Pro', true],
    [/^RAPID PLA\+ /i, 'Rapid PLA+', true],
    [/^Silk /i, 'PLA Silk', true],
    [/^Matte /i, 'PLA Matte', true],
  ],
};

// Family names the sources use that the manufacturer spells differently.
const FAMILY = {
  'Bambu Lab': {
    PLA: 'PLA Basic',
    PETG: 'PETG Basic',
    'PLA+WOOD': 'PLA Wood',
    'TPU / TPE': 'TPU',
    'TPU 95A HF': 'TPU-95A',
    'Carbon Fiber PLA': 'PLA-CF',
    'PETG Carbon Fiber': 'PETG-CF',
    'Silk PLA': 'PLA Silk+',
    'Tough PLA': 'Tough PLA',
  },
  Elegoo: { 'Silk PLA': 'PLA Silk', 'PLA Pro': 'PLA+' },
};

function normalise(entry) {
  const brand = BRANDS[entry.brand] ?? entry.brand.trim();
  let color = entry.color.trim();
  let material = entry.material.trim();

  // Only re-file entries that came in under a bare family; a source that
  // already named the range knows better than these rules do.
  const bare = /^(PLA|PETG|PLA\+|ABS|ASA|TPU)$/i.test(material);
  if (bare) {
    for (const [test, range, cut] of RANGES[brand] ?? []) {
      if (!test.test(color)) continue;
      material = range;
      if (cut) color = color.replace(test, '').trim();
      break;
    }
  }
  material = FAMILY[brand]?.[material] ?? material;

  const hexes = (entry.hexes ?? []).map(clean).filter(Boolean);
  return {
    brand,
    material,
    color: color.replace(/\s+/g, ' '),
    hex: clean(entry.hex) ?? hexes[0] ?? null,
    ...(hexes.length > 1 ? { hexes } : {}),
    source: entry.source,
  };
}

function clean(hex) {
  if (!hex) return null;
  const v = String(hex).replace('#', '').trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(v) ? `#${v}` : null;
}

async function pullSpoolmanDb() {
  const res = await fetch('https://donkie.github.io/SpoolmanDB/filaments.json');
  if (!res.ok) throw new Error(`SpoolmanDB returned ${res.status}`);
  const rows = await res.json();
  return rows
    .filter((f) => BRANDS[f.manufacturer])
    .map((f) => ({
      brand: f.manufacturer,
      material: f.material,
      color: f.name,
      hex: f.color_hex,
      hexes: f.color_hexes ?? [],
      source: 'spoolmandb',
    }));
}

async function pullFilamentColors() {
  const out = [];
  for (const [id, brand] of [
    [170, 'Bambu Lab'],
    [188, 'Elegoo'],
  ]) {
    let url = `https://filamentcolors.xyz/api/swatch/?manufacturer=${id}&limit=100`;
    while (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`filamentcolors.xyz returned ${res.status}`);
      const body = await res.json();
      for (const s of body.results ?? []) {
        if (!s.color_name) continue;
        out.push({
          brand,
          material: s.filament_type?.name ?? 'PLA',
          color: s.color_name,
          hex: s.hex_color,
          source: 'filamentcolors.xyz',
        });
      }
      url = body.next;
    }
  }
  return out;
}

let input = JSON.parse(await readFile(RAW, 'utf8'));

if (process.argv.includes('--refresh')) {
  // The PDF-derived rows are kept; only the online sources are re-pulled.
  const official = input.filter((e) => e.source === 'bambu-official');
  const [spoolman, measured] = await Promise.all([pullSpoolmanDb(), pullFilamentColors()]);
  console.log(`pulled ${spoolman.length} from SpoolmanDB, ${measured.length} from filamentcolors.xyz`);
  input = [...official, ...spoolman, ...measured];
  await writeFile(RAW, `${JSON.stringify(input, null, 1)}\n`);
}

const byKey = new Map();
let dropped = 0;
for (const entry of input.map(normalise)) {
  if (!entry.hex) {
    dropped++;
    continue;
  }
  const key = `${entry.brand}|${entry.material}|${entry.color}`.toLowerCase();
  const seen = byKey.get(key);
  if (!seen || PRIORITY[entry.source] > PRIORITY[seen.source]) byKey.set(key, entry);
}

const catalog = [...byKey.values()].sort(
  (a, b) => a.brand.localeCompare(b.brand) || a.material.localeCompare(b.material) || a.color.localeCompare(b.color),
);

await writeFile(OUT, `${JSON.stringify(catalog, null, 1)}\n`);

const perBrand = new Map();
for (const c of catalog) perBrand.set(c.brand, (perBrand.get(c.brand) ?? 0) + 1);
console.log(`wrote ${catalog.length} colours${dropped ? ` (${dropped} skipped, no usable hex)` : ''}`);
for (const [brand, n] of [...perBrand].sort()) console.log(`  ${brand.padEnd(12)} ${n}`);
