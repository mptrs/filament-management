import type { JSX } from 'preact';
import { canEdit, useApp } from '../lib/store';
import { href } from '../lib/router';
import { totalSlots, type Printer, type Spool } from '../lib/types';
import { Bar, Icon, Note, ReadOnlyNote, Swatch, TabBar, pctColor } from '../components/ui';
import { unloadSpool } from '../lib/actions';
import { relativeTime } from '../lib/util';

const LOW_PCT = 15;

export function Printers(): JSX.Element {
  const app = useApp();
  const { inv, pending, syncing, online, lastSync } = app;
  const writable = canEdit(app);

  const loaded = inv.spools.filter((s) => s.location.kind !== 'storage');
  const low = loaded.filter((s) => s.remainingPct <= LOW_PCT);
  const stored = inv.spools.length - loaded.length;
  const refillsWaiting = inv.spools.filter((s) => s.form === 'refill' && !s.mounted).length;

  const syncLabel = !online ? 'Offline' : syncing ? 'Saving' : pending > 0 ? `${pending} to push` : 'Synced';
  const syncTone = !online ? 'var(--faint)' : pending > 0 || syncing ? 'var(--accent)' : 'var(--green)';

  return (
    <div class="screen screen--tabbed">
      <header class="topbar">
        <div class="grow">
          <h1>Spoolhive</h1>
          <div class="topbar__sub">
            {inv.spools.length} {inv.spools.length === 1 ? 'spool' : 'spools'} · {inv.printers.length}{' '}
            {inv.printers.length === 1 ? 'printer' : 'printers'}
          </div>
        </div>
        <div class="syncchip" title={`Last synced ${relativeTime(lastSync)}`}>
          <span class="dot" style={{ background: syncTone }} />
          <span>{syncLabel}</span>
        </div>
        <a class="iconbtn" href={href('/connect')} aria-label="Sync settings">
          <Icon name="gear" size={17} />
        </a>
      </header>

      <div class="screen__body stack">
        {!writable && <ReadOnlyNote />}

        {low.length > 0 && (
          <Note tone="bad" icon="warn">
            <strong style={{ display: 'block', fontSize: '13px' }}>
              {low.length} {low.length === 1 ? 'spool is' : 'spools are'} running low
            </strong>
            <span style={{ color: 'var(--dim)' }}>
              {low.map((s) => `${s.colorName} (${s.remainingPct}%)`).join(', ')}
            </span>
          </Note>
        )}

        {inv.printers.length === 0 && (
          <div class="card">
            <div style={{ fontSize: '14px', fontWeight: 600 }}>No printers yet</div>
            <p class="muted" style={{ margin: '6px 0 12px', lineHeight: 1.45 }}>
              {writable
                ? 'Add your machines first — then every spool can say which one it is loaded on.'
                : 'Nothing has been set up in this inventory yet.'}
            </p>
            {writable && (
              <a class="btn btn--block" href={href('/printer/new')} style={{ display: 'block', textAlign: 'center' }}>
                Add a printer
              </a>
            )}
          </div>
        )}

        {inv.printers.map((p) => (
          <PrinterCard key={p.id} printer={p} spools={inv.spools} writable={writable} />
        ))}

        <a class="card stats" href={href('/inventory')}>
          <div>
            <div class="stats__n">{stored}</div>
            <div class="stats__l">in storage</div>
          </div>
          <div class="stats__div" />
          <div>
            <div class="stats__n" style={{ color: refillsWaiting > 0 ? 'var(--accent)' : undefined }}>
              {refillsWaiting}
            </div>
            <div class="stats__l">refills waiting</div>
          </div>
          <div class="stats__div" />
          <div>
            <div class="stats__n">{inv.emptySpools}</div>
            <div class="stats__l">empty spools</div>
          </div>
        </a>

        <a class="card card--quiet rowlink" href={href('/printers')}>
          <Icon name="printer" size={17} />
          <span class="grow" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            {writable ? 'Manage printers' : 'Printers'}
          </span>
          <span class="muted">{inv.printers.length}</span>
          <Icon name="chevronRight" size={16} />
        </a>
      </div>

      <TabBar active="printers" />
    </div>
  );
}

function PrinterCard({
  printer,
  spools,
  writable,
}: {
  printer: Printer;
  spools: Spool[];
  writable: boolean;
}): JSX.Element {
  const count = totalSlots(printer);
  const slots = Array.from({ length: count }, (_, i) => {
    const slot = i + 1;
    return spools.find((s) =>
      printer.amsUnits > 0
        ? s.location.kind === 'ams' && s.location.printer === printer.id && s.location.slot === slot
        : s.location.kind === 'direct' && s.location.printer === printer.id,
    );
  });

  return (
    <section class="card">
      <a class="rowlink" href={href(`/printer/${printer.id}`)} style={{ marginBottom: '12px' }}>
        <span class="dot" style={{ background: 'var(--green)' }} />
        <span class="grow">
          <span style={{ display: 'block', fontFamily: 'var(--display)', fontSize: '15px', fontWeight: 600 }}>
            {printer.name}
          </span>
          <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--faint)', marginTop: '1px' }}>
            {printer.model} · {printer.amsUnits > 0 ? `AMS × ${printer.amsUnits}` : 'single spool'}
          </span>
        </span>
        <Icon name="chevronRight" size={16} />
      </a>

      <div class="grid-slots" style={{ gridTemplateColumns: `repeat(${count > 1 ? 2 : 1}, minmax(0, 1fr))` }}>
        {slots.map((spool, i) => (
          <SlotTile key={i} printer={printer} slot={i + 1} spool={spool} writable={writable} />
        ))}
      </div>
    </section>
  );
}

function SlotTile({
  printer,
  slot,
  spool,
  writable,
}: {
  printer: Printer;
  slot: number;
  spool?: Spool;
  writable: boolean;
}): JSX.Element {
  const tag = printer.amsUnits > 0 ? `A${slot}` : 'Direct';

  if (!spool) {
    const body = (
      <>
        <span
          class="swatch"
          style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--line)' }}
        />
        <div class="slot__name" style={{ color: 'var(--faint)' }}>
          Empty
        </div>
        {writable && <div class="slot__sub">Tap to load</div>}
        <div class="row" style={{ gap: '7px', marginTop: '9px' }}>
          <span class="mono slot__tag">{tag}</span>
        </div>
      </>
    );
    // Nothing to load it with, so the tile is just a statement of fact.
    return writable ? (
      <a class="slot slot--empty" href={href(`/load/${printer.id}/${slot}`)}>
        {body}
      </a>
    ) : (
      <div class="slot slot--empty">{body}</div>
    );
  }

  return (
    <div class="slot slot--filled" data-low={spool.remainingPct <= LOW_PCT}>
      {/* The tile is the link; eject sits over its corner as a real button,
          so one tap at the machine takes the roll out. */}
      <a class="slot__link" href={href(`/spool/${spool.id}`)}>
        <Swatch hex={spool.hex} hexes={spool.hexes} size={28} radius={8} />
        <div class="slot__name truncate">{spool.colorName}</div>
        <div class="slot__sub truncate">
          {spool.brand} · {spool.material}
        </div>
        <div class="row" style={{ gap: '7px', marginTop: '9px' }}>
          <span class="mono slot__tag">{tag}</span>
          <Bar pct={spool.remainingPct} />
          <span class="mono" style={{ fontSize: '10.5px', color: pctColor(spool.remainingPct) }}>
            {spool.remainingPct}%
          </span>
        </div>
      </a>
      {writable && (
        <button
          type="button"
          class="slot__eject"
          aria-label={`Unload ${spool.colorName} from ${printer.name} ${tag}`}
          title="Unload to storage"
          onClick={() => unloadSpool(spool.id)}
        >
          <Icon name="eject" size={15} />
        </button>
      )}
    </div>
  );
}
