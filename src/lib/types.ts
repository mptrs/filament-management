export type DryState = 'dry' | 'needs-drying' | 'drying';

/** Where a spool physically is. `ams` slots are 1-based across all chained units. */
export type Location =
  | { kind: 'ams'; printer: string; slot: number }
  | { kind: 'direct'; printer: string }
  | { kind: 'storage'; where?: string };

export interface Printer {
  id: string;
  name: string;
  model: string;
  /** 0 means a single direct feed; otherwise the number of chained AMS units. */
  amsUnits: number;
  slotsPerUnit: number;
}

export interface Spool {
  id: string;
  brand: string;
  material: string;
  colorName: string;
  hex: string;
  /** `refill` is spool-less filament; it needs an empty spool before it can be used. */
  form: 'spool' | 'refill';
  /** Only meaningful for refills: whether it is currently on a reusable spool. */
  mounted: boolean;
  netWeightG: number;
  remainingPct: number;
  sealed: boolean;
  openedAt?: string;
  dryState: DryState;
  driedAt?: string;
  location: Location;
  notes?: string;
  addedAt: string;
}

export interface Inventory {
  version: 1;
  printers: Printer[];
  spools: Spool[];
  /** Reusable spools sitting empty, available for a refill. */
  emptySpools: number;
  updatedAt: string;
}

export interface CatalogEntry {
  brand: string;
  material: string;
  color: string;
  hex: string;
  source: string;
}

export function totalSlots(p: Printer): number {
  return p.amsUnits > 0 ? p.amsUnits * p.slotsPerUnit : 1;
}

export function slotLabel(p: Printer, slot: number): string {
  return p.amsUnits > 0 ? `A${slot}` : 'Direct';
}

export function locationText(inv: Inventory, loc: Location): string {
  if (loc.kind === 'storage') return loc.where ? `Storage · ${loc.where}` : 'Storage';
  const printer = inv.printers.find((p) => p.id === loc.printer);
  const name = printer?.name ?? 'Unknown printer';
  return loc.kind === 'ams' ? `${name} · A${loc.slot}` : name;
}

export function isLoaded(s: Spool): boolean {
  return s.location.kind !== 'storage';
}

/** A refill with no spool under it cannot be printed with. */
export function needsSpool(s: Spool): boolean {
  return s.form === 'refill' && !s.mounted;
}

export function remainingGrams(s: Spool): number {
  return Math.round((s.netWeightG * s.remainingPct) / 100);
}
