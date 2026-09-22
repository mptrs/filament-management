/**
 * A minimal PNG reader and swatch sampler, built on node's own zlib so the
 * catalogue build needs no image dependencies.
 *
 * Only what manufacturer swatch images actually use: 8-bit, non-interlaced,
 * greyscale / RGB / palette / alpha variants.
 */
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette = null;
  let alpha = null;
  const data = [];

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') alpha = body;
    else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
  }

  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const lines = Buffer.alloc(height * stride);

  // Undo the per-scanline filters (PNG spec, section 9).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = lines.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? lines.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let value = src[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = value & 0xff;
    }
  }

  // Normalise everything to RGBA.
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    if (colorType === 0 || colorType === 4) {
      pixels[d] = pixels[d + 1] = pixels[d + 2] = lines[s];
      pixels[d + 3] = colorType === 4 ? lines[s + 1] : 255;
    } else if (colorType === 3) {
      const index = lines[s];
      pixels[d] = palette[index * 3];
      pixels[d + 1] = palette[index * 3 + 1];
      pixels[d + 2] = palette[index * 3 + 2];
      pixels[d + 3] = alpha && index < alpha.length ? alpha[index] : 255;
    } else {
      pixels[d] = lines[s];
      pixels[d + 1] = lines[s + 1];
      pixels[d + 2] = lines[s + 2];
      pixels[d + 3] = colorType === 6 ? lines[s + 3] : 255;
    }
  }

  return { width, height, pixels };
}

const hex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * Reads the colours out of a swatch image.
 *
 * A dual-colour swatch is two flat halves, so the honest reading is the set of
 * distinct colours, not their average. Anything that is really one colour with
 * speckle or sheen collapses back to a single value.
 */
export function sampleSwatch({ width, height, pixels }) {
  // Stay inside the edge: these images are often rounded or have a hairline.
  const inset = 0.16;
  const x0 = Math.floor(width * inset);
  const x1 = Math.ceil(width * (1 - inset));
  const y0 = Math.floor(height * inset);
  const y1 = Math.ceil(height * (1 - inset));

  const buckets = new Map();
  let counted = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const kept = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 200) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
      counted++;
      sumR += r;
      sumG += g;
      sumB += b;
      kept.push(r, g, b);
    }
  }
  if (!counted) return null;

  const ranked = [...buckets.values()]
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }))
    .sort((a, b) => b.n - a.n);

  // Merge buckets that are really the same colour split across a boundary.
  const clusters = [];
  for (const candidate of ranked) {
    const near = clusters.find(
      (c) => Math.hypot(c.r - candidate.r, c.g - candidate.g, c.b - candidate.b) < 64,
    );
    if (near) {
      const total = near.n + candidate.n;
      near.r = (near.r * near.n + candidate.r * candidate.n) / total;
      near.g = (near.g * near.n + candidate.g * candidate.n) / total;
      near.b = (near.b * near.n + candidate.b * candidate.n) / total;
      near.n = total;
    } else {
      clusters.push({ ...candidate });
    }
  }

  // A band has to hold a real share of the swatch to count as its own colour.
  const significant = clusters.filter((c) => c.n / counted >= 0.14).slice(0, 4);
  const chosen = significant.length ? significant : [clusters[0]];

  // How far the image strays from its own average. A flat colour scores near
  // zero; clean bands or a gradient score high.
  const meanR = sumR / counted;
  const meanG = sumG / counted;
  const meanB = sumB / counted;
  let spread = 0;
  for (let i = 0; i < kept.length; i += 3) {
    spread += Math.hypot(kept[i] - meanR, kept[i + 1] - meanG, kept[i + 2] - meanB);
  }
  spread /= counted;

  if (chosen.length > 1) {
    // Distinct bands: reading them separately is exactly right.
    return { hex: hex(chosen[0].r, chosen[0].g, chosen[0].b), hexes: chosen.map((c) => hex(c.r, c.g, c.b)), confident: true };
  }

  // One cluster but a wide spread means a gradient or heavy speckle: the
  // average is a colour that appears nowhere on the reel, so say so and let
  // the caller prefer a source that lists the real colours.
  return { hex: hex(chosen[0].r, chosen[0].g, chosen[0].b), confident: spread < 34 };
}
