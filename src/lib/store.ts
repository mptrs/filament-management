import { useSyncExternalStore } from 'preact/compat';
import { reconcile, type Inventory } from './types';
import { detectRepo, emptyInventory, readToken, writeToken, type RepoRef } from './config';
import { ConflictError, MissingFileError, fetchInventory, pushInventory } from './github';

const CACHE_KEY = 'fm.cache';
const PUSH_DELAY_MS = 1500;

export interface AppState {
  inv: Inventory;
  sha: string | null;
  repo: RepoRef | null;
  token: string;
  loading: boolean;
  /** Local edits that have not reached GitHub yet. */
  pending: number;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  conflict: boolean;
  online: boolean;
}

interface Cache {
  inv: Inventory;
  sha: string | null;
  pending: number;
  lastSync: number | null;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function writeCache(state: AppState): void {
  try {
    const cache: Cache = { inv: state.inv, sha: state.sha, pending: state.pending, lastSync: state.lastSync };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* private mode, or the quota is full - the app still works for this session */
  }
}

const cached = readCache();

let state: AppState = {
  inv: cached?.inv ?? emptyInventory(),
  sha: cached?.sha ?? null,
  repo: detectRepo(),
  token: readToken(),
  loading: true,
  pending: cached?.pending ?? 0,
  syncing: false,
  lastSync: cached?.lastSync ?? null,
  error: null,
  conflict: false,
  online: navigator.onLine,
};

const listeners = new Set<() => void>();

function set(patch: Partial<AppState>, persist = false): void {
  state = { ...state, ...patch };
  if (persist) writeCache(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): AppState {
  return state;
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, snapshot);
}

export function getState(): AppState {
  return state;
}

export function canEdit(s: AppState = state): boolean {
  return Boolean(s.token && s.repo);
}

/** Applies a change locally, then pushes it to GitHub in the background. */
export function mutate(fn: (draft: Inventory) => void, message = 'Update inventory'): void {
  const next = structuredClone(state.inv);
  fn(next);
  reconcile(next);
  next.updatedAt = new Date().toISOString();
  set({ inv: next, pending: state.pending + 1, conflict: false }, true);
  schedulePush(message);
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pendingMessage = 'Update inventory';

function schedulePush(message: string): void {
  pendingMessage = message;
  if (!canEdit() || !state.online) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(pendingMessage), PUSH_DELAY_MS);
}

export async function push(message = pendingMessage): Promise<void> {
  if (!canEdit() || state.syncing || state.pending === 0) return;
  const { repo, token } = state;
  if (!repo || !token) return;

  const attempted = state.pending;
  set({ syncing: true, error: null });
  try {
    const sha = await pushInventory(repo, token, state.inv, state.sha, message);
    set(
      {
        sha,
        // Anything edited while the request was in flight still needs pushing.
        pending: Math.max(0, state.pending - attempted),
        syncing: false,
        lastSync: Date.now(),
        conflict: false,
      },
      true,
    );
    if (state.pending > 0) schedulePush(pendingMessage);
  } catch (err) {
    if (err instanceof ConflictError) {
      set({ syncing: false, conflict: true, error: 'GitHub has a newer version of this file.' });
    } else {
      set({ syncing: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

/** Pulls from GitHub, discarding local edits. Used to resolve a conflict. */
export async function pull({ discardLocal = false } = {}): Promise<void> {
  const { repo } = state;
  if (!repo) {
    set({ loading: false, error: 'Could not work out which GitHub repository to use.' });
    return;
  }
  if (state.pending > 0 && !discardLocal) {
    set({ loading: false });
    return;
  }

  set({ syncing: true, error: null });
  try {
    const { inventory, sha } = await fetchInventory(repo, state.token || undefined);
    set(
      { inv: inventory, sha, pending: 0, syncing: false, loading: false, lastSync: Date.now(), conflict: false },
      true,
    );
  } catch (err) {
    if (err instanceof MissingFileError) {
      // First run against a fresh repo: keep whatever is local and let the
      // first push create the file.
      set({ sha: null, syncing: false, loading: false, error: null }, true);
      return;
    }
    set({
      syncing: false,
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function setToken(token: string): void {
  writeToken(token);
  set({ token });
  if (token && state.pending > 0) void push();
}

export function setRepo(repo: RepoRef | null): void {
  set({ repo });
}

export function init(): void {
  addEventListener('online', () => {
    set({ online: true });
    if (state.pending > 0) void push();
  });
  addEventListener('offline', () => set({ online: false }));
  void pull();
}
