import type { JSX } from 'preact';
import { useApp } from '../lib/store';
import { navigate } from '../lib/router';
import { ColorPicker } from '../components/ColorPicker';
import { BackButton } from '../components/ui';
import { updateSpool } from '../lib/actions';

/**
 * Correcting the colour of a spool you already logged — a mis-tap, or a
 * catalogue entry that has since been given a better value.
 */
export function Recolor({ id }: { id: string }): JSX.Element {
  const { inv } = useApp();
  const spool = inv.spools.find((s) => s.id === id);

  if (!spool) {
    return (
      <div class="screen">
        <header class="topbar">
          <BackButton to="/inventory" label="Back to inventory" />
          <div class="topbar__title">Change colour</div>
        </header>
        <div class="screen__body">
          <div class="empty">That spool is no longer in the inventory.</div>
        </div>
      </div>
    );
  }

  return (
    <ColorPicker
      title="Change colour"
      meta={spool.colorName}
      backTo={`/spool/${id}`}
      initial={{ brand: spool.brand, material: spool.material }}
      actionLabel={(picked) => `Use ${picked.color}`}
      onPick={(picked) => {
        updateSpool(
          id,
          {
            brand: picked.brand,
            material: picked.material,
            colorName: picked.color,
            hex: picked.hex,
            hexes: picked.hexes,
          },
          `Recolour spool to ${picked.color}`,
        );
        navigate(`/spool/${id}`, { replace: true });
      }}
    />
  );
}
