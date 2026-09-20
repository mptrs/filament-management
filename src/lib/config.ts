import type { Inventory } from './types';

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

const OVERRIDE_KEY = 'fm.repo';
const TOKEN_KEY = 'fm.token';

export const DATA_PATH = 'data/inventory.json';

/**
 * A GitHub Pages project site is served from https://<owner>.github.io/<repo>/,
 * so the app can work out which repo it lives in without being told. Anything
 * else (local dev, a custom domain) falls back to build-time env or a manual
 * override the user can set on the Sync screen.
 */
export function detectRepo(): RepoRef | null {
  const stored = localStorage.getItem(OVERRIDE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as RepoRef;
      if (parsed.owner && parsed.repo) return parsed;
    } catch {
      /* fall through to detection */
    }
  }

  const envOwner = import.meta.env.VITE_GH_OWNER as string | undefined;
  const envRepo = import.meta.env.VITE_GH_REPO as string | undefined;
  if (envOwner && envRepo) {
    return { owner: envOwner, repo: envRepo, branch: 'main', path: DATA_PATH };
  }

  const match = /^([\w-]+)\.github\.io$/.exec(location.hostname);
  if (match) {
    const segments = location.pathname.split('/').filter(Boolean);
    const owner = match[1];
    // A user site (owner.github.io) keeps its data in the same repo.
    const repo = segments.length > 0 ? segments[0] : `${owner}.github.io`;
    return { owner, repo, branch: 'main', path: DATA_PATH };
  }

  return null;
}

export function saveRepoOverride(ref: RepoRef | null): void {
  if (ref) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(ref));
  else localStorage.removeItem(OVERRIDE_KEY);
}

export function readToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function writeToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function emptyInventory(): Inventory {
  return {
    version: 1,
    printers: [],
    spools: [],
    emptySpools: 0,
    updatedAt: new Date().toISOString(),
  };
}
