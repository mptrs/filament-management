import type { JSX } from 'preact';
import { match, useRoute } from './lib/router';
import { canEdit, useApp } from './lib/store';
import { NeedsAccess } from './components/ui';
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

export function App(): JSX.Element {
  const path = useRoute();
  const app = useApp();
  const { loading, inv } = app;
  const writable = canEdit(app);

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

  // These screens exist only to change something, so without a token there is
  // nothing for them to do. Reached by a stale link or a typed URL.
  const printer = match('/printer/:id', path);
  if (printer) {
    return writable ? <PrinterEdit id={printer.id} /> : <NeedsAccess title="Printer" what="Changing a printer" />;
  }

  const load = match('/load/:printer/:slot', path);
  if (load) {
    return writable ? (
      <LoadSlot printerId={load.printer} slot={Number(load.slot)} />
    ) : (
      <NeedsAccess title="Load slot" what="Loading a slot" />
    );
  }

  const recolor = match('/recolor/:id', path);
  if (recolor) {
    return writable ? <Recolor id={recolor.id} /> : <NeedsAccess title="Change colour" what="Changing a colour" />;
  }

  switch (path) {
    case '/inventory':
      return <Inventory />;
    case '/add':
      return writable ? <AddSpool /> : <NeedsAccess title="Add spool" what="Adding a spool" />;
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
