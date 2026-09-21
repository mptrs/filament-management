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

// The manufacturer always wins; community data fills what they do not publish.
const PRIORITY = { 'bambu-official': 4, 'elegoo.com': 4, spoolmandb: 2, 'filamentcolors.xyz': 1 };

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
    [/PLA\/?CF|Carbon Fi/i, 'PLA-CF', false],
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

// Elegoo's shop titles, as they should appear in the app.
const ELEGOO_RANGES = {
  'PLA Plus': 'PLA+',
  'Rapid PLA Plus': 'Rapid PLA+',
  // Same colours, just sold on a reusable spool - not a separate range.
  'PLA Matte - Reusable Spool': 'PLA Matte',
  'PLA (RFID) emoji® Edition': 'PLA emoji Edition',
};

// A colour named "Silk Gold" inside the "PLA Silk" range says Silk twice.
const REDUNDANT = /^(Silk|Matte|Translucent|Glow|Sparkle|Marble|Metallic|Wood|Galaxy|Pure|Lite|Aero)\s+/i;

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
  // Bambu spell it "Gray" in their own tables; a source using "Grey" would
  // otherwise sit beside it as a second, identical colour.
  if (brand === 'Bambu Lab') color = color.replace(/\bGrey\b/g, 'Gray');
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

  const doubled = REDUNDANT.exec(color);
  if (doubled && new RegExp(`\\b${doubled[1]}\\b`, 'i').test(material)) {
    const rest = color.slice(doubled[0].length).trim();
    if (rest) color = rest;
  }

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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

/**
 * Elegoo run a Shopify store, so the ranges and their colour options come from
 * products.json. The hex values live in the theme's own swatch table, which is
 * embedded in every product page and identical on all of them - so one page
 * fetch gives the whole colour dictionary.
 */
async function pullElegooStore() {
  const products = [];
  for (let page = 1; page <= 8; page++) {
    const res = await fetch(`https://www.elegoo.com/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) throw new Error(`elegoo.com returned ${res.status}`);
    const body = await res.json();
    if (!body.products?.length) break;
    products.push(...body.products);
  }

  const filaments = products.filter(
    (p) => p.product_type === '3D Filaments' || (p.tags ?? []).some((t) => t.toLowerCase() === 'filament'),
  );

  const page = await fetch(`https://www.elegoo.com/products/${filaments[0].handle}`, {
    headers: { 'User-Agent': UA },
  });
  const html = await page.text();
  const block = /swatches-raw-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!block) throw new Error('elegoo.com: no swatch table on the product page');
  const raw = JSON.parse(block[1].trim());

  const swatches = new Map();
  const keys = raw.keys.split(',');
  const values = raw.values.split(',');
  for (let i = 0; i < keys.length; i++) {
    // '#white' and 'white' are the same swatch under two spellings.
    const key = keys[i].replace(/&amp;/g, '&').trim().toLowerCase().replace(/^#/, '');
    if (key && !swatches.has(key)) swatches.set(key, values[i].trim());
  }

  const lookup = (name) => {
    const n = name.replace(/&amp;/g, '&').trim().toLowerCase();
    for (const candidate of [n, n.replace(/gray/g, 'grey'), n.replace(/grey/g, 'gray'), n.replace(/crytal/g, 'crystal')]) {
      const hit = swatches.get(candidate);
      if (hit?.startsWith('#')) return hit;
    }
    return null;
  };

  // Bundles and multi-packs are not colour ranges.
  const skip = /\b(10KG|5 kg|3 kg|250 g|Bundle|Colors)\b/i;
  const out = [];
  for (const product of filaments) {
    const title = product.title.trim();
    if (skip.test(title)) continue;
    const index = (product.options ?? []).findIndex((o) => /color/i.test(o.name));
    if (index < 0) continue;

    const material = (ELEGOO_RANGES[title] ?? title).replace(/®/g, '');
    const seen = new Set();
    for (const variant of product.variants ?? []) {
      const name = variant[`option${index + 1}`]?.trim();
      // Placeholder variants on bundle-style products.
      if (!name || seen.has(name) || /option\d|^\d+KG/i.test(name)) continue;
      seen.add(name);
      const hex = lookup(name);
      // Swatches served as an image (multi-colour, translucent) carry no hex;
      // the community sources cover most of those.
      if (hex) out.push({ brand: 'Elegoo', material, color: name, hex, source: 'elegoo.com' });
    }
  }
  return out;
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
  const [elegoo, spoolman, measured] = await Promise.all([
    pullElegooStore(),
    pullSpoolmanDb(),
    pullFilamentColors(),
  ]);
  console.log(
    `pulled ${elegoo.length} from elegoo.com, ${spoolman.length} from SpoolmanDB, ${measured.length} from filamentcolors.xyz`,
  );
  input = [...official, ...elegoo, ...spoolman, ...measured];
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
  if (!seen || (PRIORITY[entry.source] ?? 0) > (PRIORITY[seen.source] ?? 0)) byKey.set(key, entry);
}

const catalog = [...byKey.values()].sort(
  (a, b) => a.brand.localeCompare(b.brand) || a.material.localeCompare(b.material) || a.color.localeCompare(b.color),
);

await writeFile(OUT, `${JSON.stringify(catalog, null, 1)}\n`);

const perBrand = new Map();
for (const c of catalog) perBrand.set(c.brand, (perBrand.get(c.brand) ?? 0) + 1);
console.log(`wrote ${catalog.length} colours${dropped ? ` (${dropped} skipped, no usable hex)` : ''}`);
for (const [brand, n] of [...perBrand].sort()) console.log(`  ${brand.padEnd(12)} ${n}`);
