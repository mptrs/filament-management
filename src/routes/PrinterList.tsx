import type { JSX } from 'preact';
import { canEdit, useApp } from '../lib/store';
import { href } from '../lib/router';
import { totalSlots } from '../lib/types';
import { BackButton, Icon, Note, swatchBackground } from '../components/ui';

export function PrinterList(): JSX.Element {
  const app = useApp();
  const { inv } = app;
  const writable = canEdit(app);
  const loadedCount = inv.spools.filter((s) => s.location.kind !== 'storage').length;
  const capacity = inv.printers.reduce((n, p) => n + totalSlots(p), 0);

  return (
    <div class="screen">
      <header class="topbar">
        <BackButton to="/" label="Back to printers" />
        <div class="topbar__title">{writable ? 'Manage printers' : 'Printers'}</div>
      </header>

      <div class="screen__body">
        <div class="sectionhead" style={{ marginTop: '6px' }}>
          <span class="label grow">In the workshop · {inv.printers.length}</span>
        </div>

        {inv.printers.map((p) => {
          const colors = inv.spools
            .filter((s) => s.location.kind !== 'storage' && s.location.printer === p.id)
            .map((s) => swatchBackground(s.hex, s.hexes));
          return (
            <a key={p.id} class="card row" href={href(`/printer/${p.id}`)} style={{ gap: '12px', marginBottom: '10px' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-2)' }}>
                <Icon name="printer" size={22} />
              </span>
              <span class="grow">
                <span style={{ display: 'block', fontFamily: 'var(--display)', fontSize: '16px', fontWeight: 600 }}>
                  {p.name}
                </span>
                <span class="muted" style={{ display: 'block', marginTop: '2px' }}>
                  {p.model} · {p.amsUnits > 0 ? `AMS × ${p.amsUnits}` : 'single spool'}
                </span>
                <span class="row" style={{ gap: '4px', marginTop: '8px' }}>
                  {colors.length === 0 ? (
                    <span class="muted">nothing loaded</span>
                  ) : (
                    colors.map((background, i) => (
                      <span key={i} style={{ width: '22px', height: '10px', borderRadius: '3px', background, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }} />
                    ))
                  )}
                </span>
              </span>
              <Icon name="chevronRight" size={16} />
            </a>
          );
        })}

        {writable && (
          <a
            href={href('/printer/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: '1px dashed #343941', borderRadius: '16px', padding: '16px', marginTop: '4px' }}
          >
            <Icon name="plus" />
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Add a printer</span>
          </a>
        )}

        <div class="sectionhead">
          <span class="label grow">Slots in use</span>
        </div>
        <div class="card" style={{ padding: '4px 14px' }}>
          <div class="row" style={{ padding: '12px 0', borderBottom: '1px solid #23262c' }}>
            <span class="grow" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              Loaded slots
            </span>
            <span class="mono" style={{ fontSize: '12.5px' }}>
              {loadedCount} of {capacity}
            </span>
          </div>
          <div class="row" style={{ padding: '12px 0' }}>
            <span class="grow" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              In storage
            </span>
            <span class="mono" style={{ fontSize: '12.5px', color: 'var(--faint)' }}>
              {inv.spools.length - loadedCount}
            </span>
          </div>
        </div>

        {writable && (
          <div style={{ marginTop: '16px' }}>
            <Note>
              Removing a printer never deletes filament. Anything loaded on it moves back to storage, so you keep the
              spool and its history.
            </Note>
          </div>
        )}
      </div>
    </div>
  );
}
