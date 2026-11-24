// Live editing: the admin on the live site reads and saves the site content in the GitHub repository.
// Every save is one commit on the main branch; Vercel sees it and republishes the site (about a minute).
//
// Settings (Vercel → Settings → Environment Variables):
//   GITHUB_TOKEN   fine-grained token for this repository only, permission "Contents: Read and write"
//   GITHUB_REPO    owner/name, e.g. Erik333M/44lounge-react (optional: Vercel already knows it)
//   GITHUB_BRANCH  optional, default "main"

export const CONTENT_PATH = 'src/content/site.json';
const API = 'https://api.github.com';

export function githubConfig(env = process.env) {
  const token = env.GITHUB_TOKEN;
  const repo =
    env.GITHUB_REPO || (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}` : '');
  const branch = env.GITHUB_BRANCH || 'main';
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { token, repo, branch };
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function client({ token, repo }) {
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(`${API}/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'site-admin',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GitHubError(data.message || `GitHub error ${res.status}`, res.status);
    return data;
  };
}

// Latest site content and the version id (blob sha) it was read at.
export async function readContent(cfg) {
  const gh = client(cfg);
  const file = await gh(`/contents/${CONTENT_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
  let text = Buffer.from(file.content || '', 'base64').toString('utf8');
  if (!file.content && file.download_url) text = await (await fetch(file.download_url)).text(); // files over 1 MB
  return { content: JSON.parse(text), sha: file.sha };
}

// Stores a file in the repository without committing it yet (it becomes part of the next save).
export async function storeFile(cfg, base64) {
  const gh = client(cfg);
  const blob = await gh('/git/blobs', { method: 'POST', body: { content: base64, encoding: 'base64' } });
  return blob.sha;
}

/**
 * Commits the new content plus any uploaded files in one commit.
 * `baseSha` is the content version the editor started from: if site.json changed on GitHub since then
 * (another person saved, or a push), nothing is written and a 409 is thrown.
 */
export async function publish(cfg, { content, baseSha, uploads = [], message }) {
  const gh = client(cfg);
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const head = await gh(`/git/commits/${ref.object.sha}`);
    const current = await gh(`/contents/${CONTENT_PATH}?ref=${ref.object.sha}`);
    if (baseSha && current.sha !== baseSha) {
      throw new GitHubError('The site content was changed somewhere else since you opened the editor.', 409);
    }
    const text = `${JSON.stringify(content, null, 2)}\n`;
    const tree = await gh('/git/trees', {
      method: 'POST',
      body: {
        base_tree: head.tree.sha,
        tree: [
          { path: CONTENT_PATH, mode: '100644', type: 'blob', content: text },
          ...uploads.map((u) => ({ path: `public/${u.path}`, mode: '100644', type: 'blob', sha: u.sha })),
        ],
      },
    });
    const commit = await gh('/git/commits', {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [head.sha] },
    });
    try {
      await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
    } catch (e) {
      // someone pushed in between: build again on top of the new head
      if (e.status === 422 && attempt < 2) continue;
      throw e;
    }
    const saved = await gh(`/contents/${CONTENT_PATH}?ref=${commit.sha}`);
    return { sha: saved.sha, commit: commit.sha, url: commit.html_url };
  }
  throw new GitHubError('Could not save, please try again.', 409);
}

const IMAGE = /\.(jpe?g|png|gif|webp|svg|avif)$/i;

// Every image under public/, as site paths (images/menu/44-burger.webp).
export async function listImages(cfg) {
  const gh = client(cfg);
  const tree = await gh(`/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`);
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.startsWith('public/') && IMAGE.test(e.path))
    .map((e) => e.path.slice('public/'.length));
}
