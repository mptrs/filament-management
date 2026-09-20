#!/usr/bin/env node
/**
 * Turns the raw colour pull in data/catalog-raw.json into the catalogue the app
 * bundles. Refresh the raw file with:
 *
 *   node scripts/build-catalog.mjs --refresh     (filamentcolors.xyz only)
 *   python3 scripts/fetch-bambu-pdfs.py          (adds Bambu's official tables)
 *
 * Bambu publish an official hex table per product line, and those values are
 * what the store shows, so they win over the measured swatches when the same
 * colour appears in both.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'catalog-raw.json');
const OUT = join(root, 'src', 'catalog.generated.json');

// filamentcolors.xyz labels some ranges differently from the manufacturer.
const ALIASES = {
  'Bambu Lab': {
    PLA: 'PLA Basic',
    'Silk PLA': 'PLA Silk+',
    'PLA Silk': 'PLA Silk+',
    PETG: 'PETG Basic',
    'PETG Carbon Fiber': 'PETG-CF',
    'Carbon Fiber PLA': 'PLA-CF',
    'TPU / TPE': 'TPU',
    'pETG Translucent': 'PETG Translucent',
  },
};

const MANUFACTURER_SOURCE = 'bambu-official';

// filamentcolors.xyz files several Bambu ranges under a bare "PLA"/"PETG".
// The colour name is the only signal for which range it really is.
const SUBRANGE = [
  [/\bsparkle\b/i, 'PLA Sparkle'],
  [/\b(cf|carbon fi)/i, 'PLA-CF'],
  [/\bsilk\b/i, 'PLA Silk+'],
  [/\bmatte\b/i, 'PLA Matte'],
  [/\bglow\b/i, 'PLA Glow'],
  [/\bgalaxy\b/i, 'PLA Galaxy'],
  [/\bmarble\b/i, 'PLA Marble'],
  [/\bwood\b/i, 'PLA Wood'],
  [/\bmetal\b/i, 'PLA Metal'],
  [/\btranslucent\b/i, 'PLA Translucent'],
];

function normalise(entry) {
  let material = ALIASES[entry.brand]?.[entry.material] ?? entry.material;
  if (entry.brand === 'Bambu Lab' && entry.material === 'PLA') {
    material = SUBRANGE.find(([re]) => re.test(entry.color))?.[1] ?? material;
  }
  return {
    brand: entry.brand.trim(),
    material: material.trim(),
    color: entry.color.trim(),
    hex: `#${entry.hex.replace('#', '').toUpperCase()}`,
    source: entry.source,
  };
}

async function refresh(existing) {
  const kept = existing.filter((e) => e.source === MANUFACTURER_SOURCE);
  const pulled = [];
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
        const hex = (s.hex_color ?? '').replace('#', '');
        if (hex.length !== 6 || !s.color_name) continue;
        pulled.push({
          brand,
          material: s.filament_type?.name ?? 'PLA',
          color: s.color_name,
          hex,
          source: 'filamentcolors.xyz',
        });
      }
      url = body.next;
    }
  }
  console.log(`refreshed ${pulled.length} measured swatches`);
  return [...kept, ...pulled];
}

const raw = JSON.parse(await readFile(RAW, 'utf8'));
const input = process.argv.includes('--refresh') ? await refresh(raw) : raw;
if (process.argv.includes('--refresh')) {
  await writeFile(RAW, `${JSON.stringify(input, null, 1)}\n`);
}

// Official values win; otherwise first one in wins.
const byKey = new Map();
for (const entry of input.map(normalise)) {
  const key = `${entry.brand}|${entry.material}|${entry.color}`.toLowerCase();
  const seen = byKey.get(key);
  if (!seen || (entry.source === MANUFACTURER_SOURCE && seen.source !== MANUFACTURER_SOURCE)) {
    byKey.set(key, entry);
  }
}

const catalog = [...byKey.values()].sort(
  (a, b) => a.brand.localeCompare(b.brand) || a.material.localeCompare(b.material) || a.color.localeCompare(b.color),
);

await writeFile(OUT, `${JSON.stringify(catalog, null, 1)}\n`);

const perBrand = new Map();
for (const c of catalog) perBrand.set(c.brand, (perBrand.get(c.brand) ?? 0) + 1);
console.log(`wrote ${catalog.length} colours to src/catalog.generated.json`);
for (const [brand, n] of [...perBrand].sort()) console.log(`  ${brand.padEnd(12)} ${n}`);
