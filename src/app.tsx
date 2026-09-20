import type { JSX } from 'preact';
import { match, useRoute } from './lib/router';
import { useApp } from './lib/store';
import { Printers } from './routes/Printers';
import { Inventory } from './routes/Inventory';
import { SpoolDetail } from './routes/SpoolDetail';
import { AddSpool } from './routes/AddSpool';
import { Refills } from './routes/Refills';
import { PrinterList } from './routes/PrinterList';
import { PrinterEdit } from './routes/PrinterEdit';
import { Connect } from './routes/Connect';

export function App(): JSX.Element {
  const path = useRoute();
  const { loading, inv } = useApp();

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
