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

/**
 * Forces the inventory back into states that can exist in the real world.
 * Runs after every mutation, so no screen can leave a contradiction behind.
 *
 * The rules, and why:
 *  - A sealed spool is unopened, so it is full, dry, has no opened date, and
 *    cannot be in a printer. Loading or emptying one opens it first.
 *  - `mounted` only means anything for a refill.
 *  - A refill with no spool under it physically cannot be in a printer.
 *  - One slot holds one spool.
 */
export function reconcile(inv: Inventory): void {
  inv.emptySpools = Math.max(0, Math.round(inv.emptySpools));

  for (const spool of inv.spools) {
    spool.remainingPct = Math.max(0, Math.min(100, Math.round(spool.remainingPct)));

    if (spool.form === 'spool') spool.mounted = false;

    if (spool.form === 'refill' && !spool.mounted && spool.location.kind !== 'storage') {
      spool.location = { kind: 'storage' };
    }

    if (spool.sealed) {
      spool.remainingPct = 100;
      spool.openedAt = undefined;
      spool.dryState = 'dry';
      if (spool.location.kind !== 'storage') spool.location = { kind: 'storage' };
    }
  }

  // A printer that no longer exists, or a slot beyond the current AMS size,
  // is not a place a spool can be.
  const byId = new Map(inv.printers.map((p) => [p.id, p]));
  const taken = new Set<string>();
  for (const spool of inv.spools) {
    const loc = spool.location;
    if (loc.kind === 'storage') continue;

    const printer = byId.get(loc.printer);
    if (!printer) {
      spool.location = { kind: 'storage' };
      continue;
    }
    if (loc.kind === 'ams' && (printer.amsUnits === 0 || loc.slot < 1 || loc.slot > totalSlots(printer))) {
      spool.location = { kind: 'storage' };
      continue;
    }
    if (loc.kind === 'direct' && printer.amsUnits > 0) {
      spool.location = { kind: 'storage' };
      continue;
    }

    const key = loc.kind === 'ams' ? `${loc.printer}:${loc.slot}` : loc.printer;
    if (taken.has(key)) spool.location = { kind: 'storage' };
    else taken.add(key);
  }
}
