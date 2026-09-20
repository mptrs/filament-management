import raw from '../catalog.generated.json';
import type { CatalogEntry } from './types';

export const catalog = raw as CatalogEntry[];

export const brands: string[] = [...new Set(catalog.map((c) => c.brand))].sort();

export function materialsFor(brand: string): string[] {
  const counts = new Map<string, number>();
  for (const c of catalog) {
    if (c.brand !== brand) continue;
    counts.set(c.material, (counts.get(c.material) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
}

export function colorsFor(brand: string, material: string): CatalogEntry[] {
  return catalog
    .filter((c) => c.brand === brand && c.material === material)
    .sort((a, b) => a.color.localeCompare(b.color));
}

/** True when a swatch is pale enough that it needs a visible outline. */
export function isPale(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.75;
}
