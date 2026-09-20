import type { Inventory } from './types';
import type { RepoRef } from './config';

const API = 'https://api.github.com';

export class ConflictError extends Error {
  constructor() {
    super('The file changed on GitHub since this copy was loaded.');
    this.name = 'ConflictError';
  }
}

export class MissingFileError extends Error {
  constructor() {
    super('No inventory file in the repository yet.');
    this.name = 'MissingFileError';
  }
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface RemoteFile {
  inventory: Inventory;
  sha: string;
}

export async function fetchInventory(ref: RepoRef, token?: string): Promise<RemoteFile> {
  const url = `${API}/repos/${ref.owner}/${ref.repo}/contents/${ref.path}?ref=${encodeURIComponent(ref.branch)}`;
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' });

  if (res.status === 404) throw new MissingFileError();
  if (!res.ok) throw new Error(await describe(res));

  const body = (await res.json()) as { content?: string; sha: string; encoding?: string };
  if (!body.content) throw new Error('GitHub returned no file content.');
  return { inventory: JSON.parse(decodeBase64Utf8(body.content)) as Inventory, sha: body.sha };
}

export async function pushInventory(
  ref: RepoRef,
  token: string,
  inventory: Inventory,
  sha: string | null,
  message: string,
): Promise<string> {
  const url = `${API}/repos/${ref.owner}/${ref.repo}/contents/${ref.path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeUtf8Base64(JSON.stringify(inventory, null, 2) + '\n'),
      branch: ref.branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (res.status === 409 || res.status === 422) throw new ConflictError();
  if (!res.ok) throw new Error(await describe(res));

  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

/** Confirms a token works and can write, without making a commit. */
export async function checkToken(ref: RepoRef, token: string): Promise<{ login: string; canWrite: boolean }> {
  const [userRes, repoRes] = await Promise.all([
    fetch(`${API}/user`, { headers: headers(token) }),
    fetch(`${API}/repos/${ref.owner}/${ref.repo}`, { headers: headers(token) }),
  ]);
  if (!userRes.ok) throw new Error('That token was rejected by GitHub.');
  const user = (await userRes.json()) as { login: string };
  if (!repoRes.ok) throw new Error(`Token cannot see ${ref.owner}/${ref.repo}.`);
  const repo = (await repoRes.json()) as { permissions?: { push?: boolean } };
  return { login: user.login, canWrite: Boolean(repo.permissions?.push) };
}

async function describe(res: Response): Promise<string> {
  if (res.status === 401) return 'GitHub rejected the token (401).';
  if (res.status === 403) {
    return 'GitHub refused the request (403) — either the rate limit, or the token lacks Contents write.';
  }
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ? `GitHub: ${body.message}` : `GitHub returned ${res.status}.`;
  } catch {
    return `GitHub returned ${res.status}.`;
  }
}
