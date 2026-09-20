import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { back, navigate } from '../lib/router';
import { totalSlots, type Printer } from '../lib/types';
import { BackButton, Note } from '../components/ui';
import { blankPrinter, deletePrinter, upsertPrinter } from '../lib/actions';

interface Model {
  label: string;
  ams: string;
  maxUnits: number;
}

// Bambu chain up to four AMS on the X1/P1 series; the A1 family takes a single
// AMS lite. Anything else gets a generic multi-material unit.
const MODELS: Model[] = [
  { label: 'Bambu Lab A1 mini', ams: 'AMS lite', maxUnits: 1 },
  { label: 'Bambu Lab A1', ams: 'AMS lite', maxUnits: 1 },
  { label: 'Bambu Lab P1S', ams: 'AMS', maxUnits: 4 },
  { label: 'Bambu Lab P1P', ams: 'AMS', maxUnits: 4 },
  { label: 'Bambu Lab X1 Carbon', ams: 'AMS', maxUnits: 4 },
  { label: 'Bambu Lab H2D', ams: 'AMS', maxUnits: 4 },
  { label: 'Something else', ams: 'Multi-material unit', maxUnits: 4 },
];

function modelInfo(label: string): Model {
  return MODELS.find((m) => m.label === label) ?? MODELS[MODELS.length - 1];
}

export function PrinterEdit({ id }: { id: string }): JSX.Element {
  const { inv } = useApp();
  const isNew = id === 'new';
  const existing = inv.printers.find((p) => p.id === id);
  const [draft, setDraft] = useState<Printer>(() => existing ?? blankPrinter());

  if (!isNew && !existing) {
    return (
      <div class="screen">
        <header class="topbar">
          <BackButton to="/printers" label="Back to printers" />
          <div class="topbar__title">Printer</div>
        </header>
        <div class="screen__body">
          <div class="empty">That printer is no longer in the list.</div>
        </div>
      </div>
    );
  }

  const model = modelInfo(draft.model);
  const slotCount = totalSlots(draft);
  const loaded = inv.spools.filter((s) => s.location.kind !== 'storage' && s.location.printer === draft.id);

  const patch = (next: Partial<Printer>): void => setDraft({ ...draft, ...next });

  const save = (): void => {
    const name = draft.name.trim() || model.label;
    upsertPrinter({ ...draft, name, amsUnits: Math.min(draft.amsUnits, model.maxUnits) });
    navigate('/printers', { replace: true });
  };

  return (
    <div class="screen">
      <header class="topbar">
        <BackButton to="/printers" label="Back to printers" />
        <div class="topbar__title">{isNew ? 'Add printer' : 'Edit printer'}</div>
        <button type="button" class="btn btn--sm" onClick={save}>
          Save
        </button>
      </header>

      <div class="screen__body">
        <label class="label" for="pname" style={{ marginBottom: '8px' }}>
          Name
        </label>
        <input
          id="pname"
          class="field"
          value={draft.name}
          placeholder="Maker Bee"
          style={{ fontFamily: 'var(--display)', fontSize: '16px', fontWeight: 600 }}
          onInput={(e) => patch({ name: (e.target as HTMLInputElement).value })}
        />

        <label class="label" for="pmodel" style={{ margin: '16px 0 8px' }}>
          Model
        </label>
        <select
          id="pmodel"
          class="field"
          value={draft.model}
          onChange={(e) => {
            const next = modelInfo((e.target as HTMLSelectElement).value);
            patch({ model: next.label, amsUnits: Math.min(draft.amsUnits, next.maxUnits) });
          }}
        >
          {MODELS.map((m) => (
            <option key={m.label} value={m.label}>
              {m.label}
            </option>
          ))}
        </select>

        <span class="label" style={{ margin: '18px 0 8px' }}>
          Filament feed
        </span>

        <div class="card">
          <div class="row" style={{ gap: '12px' }}>
            <div class="grow">
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{model.ams} fitted</div>
              <div class="muted" style={{ marginTop: '3px', lineHeight: 1.4 }}>
                {draft.amsUnits > 0
                  ? 'Slots are tracked one by one, each with its own filament.'
                  : 'One filament at a time, loaded straight into the printer.'}
              </div>
            </div>
            <button
              type="button"
              class="switch"
              data-on={draft.amsUnits > 0}
              aria-pressed={draft.amsUnits > 0}
              aria-label={`${model.ams} fitted`}
              onClick={() => patch({ amsUnits: draft.amsUnits > 0 ? 0 : 1 })}
            >
              <span />
            </button>
          </div>

          {draft.amsUnits > 0 && model.maxUnits > 1 && (
            <div class="row" style={{ gap: '12px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #23262c' }}>
              <div class="grow">
                <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Units chained</div>
                <div class="muted" style={{ marginTop: '3px' }}>
                  {model.label} takes up to {model.maxUnits} × {model.ams}.
                </div>
              </div>
              <div class="stepper">
                <button type="button" aria-label="One unit fewer" onClick={() => patch({ amsUnits: Math.max(1, draft.amsUnits - 1) })}>
                  −
                </button>
                <span>{draft.amsUnits}</span>
                <button type="button" aria-label="One unit more" onClick={() => patch({ amsUnits: Math.min(model.maxUnits, draft.amsUnits + 1) })}>
                  +
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #23262c' }}>
            <div class="row" style={{ alignItems: 'baseline', marginBottom: '9px' }}>
              <span class="muted grow">{draft.amsUnits > 0 ? `${slotCount} slots` : 'Single feed'}</span>
              <span class="muted">{Math.min(loaded.length, slotCount)} loaded</span>
            </div>
            <div style={{ display: 'grid', gap: '7px', gridTemplateColumns: `repeat(${draft.amsUnits > 0 ? 4 : 1}, minmax(0, 1fr))` }}>
              {Array.from({ length: slotCount }, (_, i) => {
                const slot = i + 1;
                // Preview where each spool will be once this is saved: fitting a
                // unit moves the direct-fed spool into slot one, removing it
                // brings slot one back to the direct feed.
                const spool = loaded.find((s) => {
                  if (draft.amsUnits > 0) {
                    if (s.location.kind === 'ams') return s.location.slot === slot;
                    return s.location.kind === 'direct' && slot === 1;
                  }
                  return s.location.kind === 'direct' || (s.location.kind === 'ams' && s.location.slot === 1);
                });
                return (
                  <div key={slot} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '10px', padding: '8px' }}>
                    {spool ? (
                      <span style={{ display: 'block', height: '22px', borderRadius: '6px', background: spool.hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }} />
                    ) : (
                      <span style={{ display: 'block', height: '22px', borderRadius: '6px', border: '1px dashed #343941' }} />
                    )}
                    <span class="mono" style={{ display: 'block', fontSize: '9.5px', color: 'var(--faint)', marginTop: '6px' }}>
                      {draft.amsUnits > 0 ? `A${slot}` : 'Spool'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <Note>
            {draft.amsUnits > 0
              ? 'Fitting a unit adds empty slots — nothing in storage moves until you put it there yourself.'
              : `Fit an ${model.ams} later and the extra slots appear here, ready to fill.`}
          </Note>
        </div>

        {!isNew && (
          <button
            type="button"
            class="btn btn--danger btn--block"
            style={{ marginTop: '16px' }}
            onClick={() => {
              if (confirm(`Remove ${draft.name}? Its ${loaded.length} loaded spools move back to storage.`)) {
                deletePrinter(draft.id);
                back('/printers');
              }
            }}
          >
            Remove this printer
          </button>
        )}
      </div>
    </div>
  );
}
