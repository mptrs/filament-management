import { mutate } from './store';
import { totalSlots, type Location, type Printer, type Spool } from './types';
import { newId } from './util';

export function addSpool(spool: Omit<Spool, 'id' | 'addedAt'>): string {
  const id = newId();
  mutate((inv) => {
    inv.spools.unshift({ ...spool, id, addedAt: new Date().toISOString() });
    // A refill that arrives already on a reusable spool takes one from the pool.
    if (spool.form === 'refill' && spool.mounted) inv.emptySpools = Math.max(0, inv.emptySpools - 1);
  }, `Add ${spool.brand} ${spool.material} ${spool.colorName}`);
  return id;
}

export function updateSpool(id: string, patch: Partial<Spool>, message?: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (spool) Object.assign(spool, patch);
  }, message ?? 'Update spool');
}

export function deleteSpool(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    // A mounted refill hands its reusable spool back when the filament is gone.
    if (spool?.form === 'refill' && spool.mounted) inv.emptySpools += 1;
    if (spool?.form === 'spool') inv.emptySpools += 1;
    inv.spools = inv.spools.filter((s) => s.id !== id);
  }, 'Remove spool');
}

/** Moves a spool, evicting whatever already sits in the target slot. */
export function setLocation(id: string, location: Location): void {
  mutate((inv) => {
    if (location.kind !== 'storage') {
      for (const other of inv.spools) {
        if (other.id === id) continue;
        const l = other.location;
        if (l.kind === 'storage' || l.printer !== location.printer) continue;
        const clash = location.kind === 'ams' ? l.kind === 'ams' && l.slot === location.slot : l.kind === 'direct';
        if (clash) other.location = { kind: 'storage' };
      }
    }
    const spool = inv.spools.find((s) => s.id === id);
    if (spool) spool.location = location;
  }, 'Move spool');
}

export function mountRefill(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool || spool.mounted || inv.emptySpools <= 0) return;
    spool.mounted = true;
    inv.emptySpools -= 1;
  }, 'Mount refill on a spool');
}

export function unmountRefill(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool || !spool.mounted) return;
    spool.mounted = false;
    inv.emptySpools += 1;
    // Filament with no spool under it cannot stay loaded in a printer.
    spool.location = { kind: 'storage' };
  }, 'Free up a spool');
}

export function setEmptySpools(n: number): void {
  mutate((inv) => {
    inv.emptySpools = Math.max(0, n);
  }, 'Update empty spool count');
}

export function upsertPrinter(printer: Printer): void {
  mutate((inv) => {
    const existing = inv.printers.find((p) => p.id === printer.id);
    const hadAms = existing ? existing.amsUnits > 0 : printer.amsUnits > 0;
    if (existing) Object.assign(existing, printer);
    else inv.printers.push(printer);

    const mine = inv.spools.filter((s) => s.location.kind !== 'storage' && s.location.printer === printer.id);

    if (!hadAms && printer.amsUnits > 0) {
      // Fitting a unit: whatever was loaded straight into the printer is now
      // sitting in the first slot, not suddenly back on the shelf.
      const taken = new Set(mine.filter((s) => s.location.kind === 'ams').map((s) => (s.location as { slot: number }).slot));
      for (const spool of mine) {
        if (spool.location.kind !== 'direct') continue;
        spool.location = taken.has(1) ? { kind: 'storage' } : { kind: 'ams', printer: printer.id, slot: 1 };
        taken.add(1);
      }
    } else if (hadAms && printer.amsUnits === 0) {
      // Taking the unit off: slot one keeps feeding the printer, the rest go back.
      for (const spool of mine) {
        if (spool.location.kind !== 'ams') continue;
        spool.location = spool.location.slot === 1 ? { kind: 'direct', printer: printer.id } : { kind: 'storage' };
      }
    }

    // Losing slots must not leave spools pointing at somewhere that no longer
    // exists - send those back to storage instead.
    const max = totalSlots(printer);
    for (const spool of inv.spools) {
      const l = spool.location;
      if (l.kind === 'storage' || l.printer !== printer.id) continue;
      if (printer.amsUnits === 0 && l.kind === 'ams') spool.location = { kind: 'storage' };
      else if (printer.amsUnits > 0 && l.kind === 'direct') spool.location = { kind: 'storage' };
      else if (l.kind === 'ams' && l.slot > max) spool.location = { kind: 'storage' };
    }
  }, `Save printer ${printer.name}`);
}

export function deletePrinter(id: string): void {
  mutate((inv) => {
    inv.printers = inv.printers.filter((p) => p.id !== id);
    for (const spool of inv.spools) {
      if (spool.location.kind !== 'storage' && spool.location.printer === id) {
        spool.location = { kind: 'storage' };
      }
    }
  }, 'Remove printer');
}

export function blankPrinter(): Printer {
  return { id: newId(), name: '', model: 'Bambu Lab A1 mini', amsUnits: 0, slotsPerUnit: 4 };
}

export function encodeLocation(loc: Location): string {
  if (loc.kind === 'storage') return 'storage';
  if (loc.kind === 'ams') return `ams:${loc.printer}:${loc.slot}`;
  return `direct:${loc.printer}`;
}

export function decodeLocation(value: string): Location {
  const [kind, printer, slot] = value.split(':');
  if (kind === 'ams') return { kind: 'ams', printer, slot: Number(slot) };
  if (kind === 'direct') return { kind: 'direct', printer };
  return { kind: 'storage' };
}

export function locationOptions(printers: Printer[]): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (const p of printers) {
    if (p.amsUnits > 0) {
      for (let slot = 1; slot <= totalSlots(p); slot++) {
        out.push({ value: `ams:${p.id}:${slot}`, label: `${p.name} · A${slot}` });
      }
    } else {
      out.push({ value: `direct:${p.id}`, label: p.name });
    }
  }
  out.push({ value: 'storage', label: 'Storage' });
  return out;
}
