import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { canEdit, pull, push, setRepo, setToken, useApp } from '../lib/store';
import { DATA_PATH, saveRepoOverride } from '../lib/config';
import { checkToken } from '../lib/github';
import { BackButton, Icon, Note } from '../components/ui';
import { relativeTime } from '../lib/util';

export function Connect(): JSX.Element {
  const app = useApp();
  const [token, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [owner, setOwner] = useState(app.repo?.owner ?? '');
  const [repo, setRepoName] = useState(app.repo?.repo ?? '');
  const connected = canEdit(app);

  const unlock = async (): Promise<void> => {
    if (!app.repo || !token) return;
    setBusy(true);
    setProblem(null);
    try {
      const { canWrite } = await checkToken(app.repo, token);
      if (!canWrite) {
        setProblem('That token can read the repository but not write to it. It needs Contents: Read and write.');
        return;
      }
      setToken(token);
      setDraft('');
      await pull();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="screen">
      <header class="topbar">
        <BackButton to="/" label="Back to printers" />
        <div class="topbar__title">Sync</div>
      </header>

      <div class="screen__body">
        <div class="card row" style={{ gap: '11px' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-2)' }}>
            <Icon name="github" size={20} />
          </span>
          <span class="grow">
            <span class="mono truncate" style={{ display: 'block', fontSize: '12.5px' }}>
              {app.repo ? `${app.repo.owner}/${app.repo.repo}` : 'No repository detected'}
            </span>
            <span class="muted" style={{ display: 'block', marginTop: '3px' }}>
              {DATA_PATH} · {app.inv.spools.length} spools · synced {relativeTime(app.lastSync)}
            </span>
          </span>
        </div>

        {!app.repo && (
          <div style={{ marginTop: '14px' }}>
            <Note tone="warn" icon="warn">
              The app could not tell which repository it lives in. That is normal on localhost or a custom domain — set
              it here.
            </Note>
            <div class="row" style={{ gap: '9px', marginTop: '12px' }}>
              <input class="field grow" placeholder="owner" value={owner} onInput={(e) => setOwner((e.target as HTMLInputElement).value)} />
              <input class="field grow" placeholder="repo" value={repo} onInput={(e) => setRepoName((e.target as HTMLInputElement).value)} />
            </div>
            <button
              type="button"
              class="btn btn--block"
              style={{ marginTop: '10px' }}
              disabled={!owner || !repo}
              onClick={() => {
                const ref = { owner, repo, branch: 'main', path: DATA_PATH };
                saveRepoOverride(ref);
                setRepo(ref);
                void pull();
              }}
            >
              Use this repository
            </button>
          </div>
        )}

        {app.conflict && (
          <div style={{ marginTop: '14px' }}>
            <Note tone="bad" icon="warn">
              GitHub has a newer version of this file — it was edited somewhere else. Pulling replaces your{' '}
              {app.pending} unsent {app.pending === 1 ? 'change' : 'changes'}.
              <button type="button" class="btn btn--ghost btn--block" style={{ marginTop: '10px' }} onClick={() => void pull({ discardLocal: true })}>
                Pull and discard my changes
              </button>
            </Note>
          </div>
        )}

        {/* When no repo is set at all, the amber note above already says so. */}
        {app.error && !app.conflict && app.repo && (
          <div style={{ marginTop: '14px' }}>
            <Note tone="bad" icon="warn">
              {app.error}
            </Note>
          </div>
        )}

        {!connected ? (
          <>
            <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none' }}>
              {[
                'Reading the inventory needs no sign-in at all.',
                'A token unlocks editing on this device.',
                'Every save is a commit, so nothing is ever lost.',
              ].map((text, i) => (
                <li key={i} class="row" style={{ gap: '8px', marginTop: i === 0 ? 0 : '9px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--dim)' }}>{text}</span>
                </li>
              ))}
            </ol>

            <label class="label" for="tok" style={{ margin: '20px 0 8px' }}>
              Fine-grained access token
            </label>
            <input
              id="tok"
              class="field mono"
              type="password"
              autocomplete="off"
              placeholder="github_pat_…"
              value={token}
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            />
            <div class="muted" style={{ marginTop: '8px', lineHeight: 1.45 }}>
              Needs one permission: <span style={{ color: 'var(--text-2)' }}>Contents → Read and write</span>, on this
              repository only.{' '}
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                Create one
              </a>
              .
            </div>

            {problem && (
              <div style={{ marginTop: '12px' }}>
                <Note tone="bad" icon="warn">
                  {problem}
                </Note>
              </div>
            )}

            <button type="button" class="btn btn--block" style={{ marginTop: '14px' }} disabled={!token || !app.repo || busy} onClick={() => void unlock()}>
              {busy ? 'Checking…' : 'Unlock editing'}
            </button>

            <div style={{ marginTop: '14px' }}>
              <Note icon="lock">
                The token stays in this browser’s storage. It is sent only to github.com, never to the page itself —
                there is no server.
              </Note>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: '14px' }}>
              <Note tone="ok" icon="check">
                <strong style={{ display: 'block', fontSize: '13.5px' }}>Editing unlocked</strong>
                <span style={{ color: 'var(--dim)' }}>Token stored on this device only</span>
              </Note>
            </div>

            <div class="card" style={{ padding: '4px 13px', marginTop: '12px' }}>
              <Line label="Last synced" value={relativeTime(app.lastSync)} />
              <Line
                label="Queued edits"
                value={app.pending === 0 ? 'none' : `${app.pending} waiting`}
                tone={app.pending > 0 ? 'var(--accent)' : undefined}
              />
              <Line label="Connection" value={app.online ? 'online' : 'offline'} tone={app.online ? undefined : 'var(--accent)'} last />
            </div>

            <button
              type="button"
              class="btn btn--block"
              style={{ marginTop: '12px' }}
              disabled={app.pending === 0 || app.syncing || !app.online}
              onClick={() => void push()}
            >
              {app.syncing ? 'Pushing…' : app.pending === 0 ? 'Everything is pushed' : `Push ${app.pending} changes`}
            </button>
            <button type="button" class="btn btn--ghost btn--block" style={{ marginTop: '9px' }} onClick={() => setToken('')}>
              Forget token on this device
            </button>
          </>
        )}

        <div style={{ marginTop: '14px' }}>
          <Note icon="offline">
            Out of signal in the workshop? The last synced copy still opens, and edits queue until you are back.
          </Note>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }): JSX.Element {
  return (
    <div class="row" style={{ padding: '11px 0', borderBottom: last ? 'none' : '1px solid #23262c' }}>
      <span class="grow" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
        {label}
      </span>
      <span class="mono" style={{ fontSize: '12px', color: tone ?? 'var(--faint)' }}>
        {value}
      </span>
    </div>
  );
}
