const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || "";
const REPOSITORY = process.env.GITHUB_REPOSITORY || "alerrandrocavalcante109-bot/yukina";
const API_VERSION = "2026-03-10";

function configured() {
  return TOKEN.length > 0 && REPOSITORY.includes("/");
}

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${TOKEN}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "Yukina-Manager"
  };
}

async function request(endpoint, options = {}) {
  if (!configured()) {
    throw new Error("GitHub não configurado. Defina GITHUB_TOKEN e GITHUB_REPOSITORY.");
  }

  const response = await fetch(API + endpoint, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const message = data?.message || `GitHub respondeu HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function repositoryPath() {
  const [owner, name] = REPOSITORY.split("/");
  if (!owner || !name || REPOSITORY.split("/").length !== 2) {
    throw new Error("GITHUB_REPOSITORY deve estar no formato owner/repository.");
  }
  return { owner, name };
}

async function login() {
  const user = await request("/user");
  return {
    authenticated: true,
    login: user.login,
    id: user.id,
    type: user.type,
    name: user.name || null
  };
}

async function repository() {
  const { owner, name } = repositoryPath();
  const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  return {
    accessible: true,
    fullName: data.full_name,
    private: data.private,
    defaultBranch: data.default_branch,
    permissions: data.permissions || {}
  };
}

async function repositories({ page = 1, perPage = 100 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 100));
  const query = new URLSearchParams({
    visibility: "all",
    affiliation: "owner,collaborator,organization_member",
    sort: "updated",
    direction: "desc",
    per_page: String(safePerPage),
    page: String(safePage)
  });

  const data = await request(`/user/repos?${query.toString()}`);

  return {
    page: safePage,
    perPage: safePerPage,
    repositories: data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      private: Boolean(repo.private),
      visibility: repo.visibility,
      defaultBranch: repo.default_branch,
      language: repo.language || null,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      permissions: repo.permissions || {}
    }))
  };
}

async function file(path, ref) {
  const { owner, name } = repositoryPath();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${encodedPath}${query}`);
}

async function status() {
  if (!configured()) {
    return { configured: false, authenticated: false, repository: REPOSITORY };
  }

  try {
    const [user, repo] = await Promise.all([login(), repository()]);
    return {
      configured: true,
      authenticated: true,
      user,
      repository: repo
    };
  } catch (error) {
    return {
      configured: true,
      authenticated: false,
      repository: REPOSITORY,
      error: error.message
    };
  }
}

module.exports = {
  configured,
  login,
  repository,
  repositories,
  file,
  status
};

if (require.main === module) {
  status()
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
