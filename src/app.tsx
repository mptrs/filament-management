import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { match, navigate, useRoute } from './lib/router';
import { canEdit, useApp } from './lib/store';
import { Printers } from './routes/Printers';
import { Inventory } from './routes/Inventory';
import { SpoolDetail } from './routes/SpoolDetail';
import { AddSpool } from './routes/AddSpool';
import { Refills } from './routes/Refills';
import { PrinterList } from './routes/PrinterList';
import { PrinterEdit } from './routes/PrinterEdit';
import { LoadSlot } from './routes/LoadSlot';
import { Recolor } from './routes/Recolor';
import { Connect } from './routes/Connect';

/** Routes that exist only to change something; there is nothing to see on them. */
const EDIT_ONLY = ['/add', '/printer/:id', '/load/:printer/:slot', '/recolor/:id'];

export function App(): JSX.Element {
  const path = useRoute();
  const app = useApp();
  const { loading, inv } = app;
  const writable = canEdit(app);

  // A typed URL or an old link should not land on a screen that cannot work.
  // Replace rather than push, so Back does not bounce straight into it again.
  const blocked = !writable && EDIT_ONLY.some((pattern) => match(pattern, path) !== null);
  useEffect(() => {
    if (blocked) navigate('/', { replace: true });
  }, [blocked]);
  if (blocked) return <div class="screen" />;

  // Only block on the very first load, when there is nothing cached to show.
  if (loading && inv.printers.length === 0 && inv.spools.length === 0) {
    return (
      <div class="screen">
        <div class="screen__body">
          <div class="empty">Loading inventory…</div>
        </div>
      </div>
    );
  }

  const spool = match('/spool/:id', path);
  if (spool) return <SpoolDetail id={spool.id} />;

  const printer = match('/printer/:id', path);
  if (printer) return <PrinterEdit id={printer.id} />;

  const load = match('/load/:printer/:slot', path);
  if (load) return <LoadSlot printerId={load.printer} slot={Number(load.slot)} />;

  const recolor = match('/recolor/:id', path);
  if (recolor) return <Recolor id={recolor.id} />;

  switch (path) {
    case '/inventory':
      return <Inventory />;
    case '/add':
      return <AddSpool />;
    case '/refills':
      return <Refills />;
    case '/printers':
      return <PrinterList />;
    case '/connect':
      return <Connect />;
    default:
      return <Printers />;
  }
}
