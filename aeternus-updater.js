require('dotenv').config();

const POLL_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

function getRepositoryParts(repository) {
  const clean = repository.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const [owner, name] = clean.split('/');

  if (!owner || !name || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error('AETERNUS_REPO deve estar no formato owner/repository.');
  }

  return { owner, name };
}

async function getLatestCommitSha(owner, name, branch, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Yukina-Aeternus-Updater',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(branch)}`,
    {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub respondeu HTTP ${response.status} ao consultar o Aeternus.`);
  }

  const data = await response.json();

  if (!data.sha) {
    throw new Error('GitHub não retornou o SHA do commit.');
  }

  return data.sha;
}

async function triggerRenderDeploy(deployHookUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(deployHookUrl);
  } catch {
    throw new Error('AETERNUS_RENDER_DEPLOY_HOOK não é uma URL válida.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('O Deploy Hook do Render deve usar HTTPS.');
  }

  const response = await fetch(parsedUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Render respondeu HTTP ${response.status} ao iniciar o deploy.`);
  }
}

function startAeternusUpdater() {
  const repository = process.env.AETERNUS_REPO;
  const branch = process.env.AETERNUS_BRANCH || 'main';
  const deployHookUrl = process.env.AETERNUS_RENDER_DEPLOY_HOOK;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!repository || !deployHookUrl) {
    console.warn(
      '[Yukina] Auto-updater do Aeternus desativado: defina AETERNUS_REPO e AETERNUS_RENDER_DEPLOY_HOOK.',
    );
    return;
  }

  let parts;

  try {
    parts = getRepositoryParts(repository);
  } catch (error) {
    console.error('[Yukina] Configuração do Aeternus inválida:', error.message);
    return;
  }

  const { owner, name } = parts;
  let lastCommitSha = null;
  let checking = false;

  async function checkForUpdate() {
    if (checking) return;
    checking = true;

    try {
      const latestCommitSha = await getLatestCommitSha(
        owner,
        name,
        branch,
        githubToken,
      );

      if (!lastCommitSha) {
        lastCommitSha = latestCommitSha;
        console.log(
          `[Yukina] Aeternus sincronizado no commit ${latestCommitSha.slice(0, 7)}.`,
        );
        return;
      }

      if (latestCommitSha === lastCommitSha) return;

      console.log(
        `[Yukina] Novo commit do Aeternus detectado: ${latestCommitSha.slice(0, 7)}. Iniciando deploy no Render...`,
      );

      await triggerRenderDeploy(deployHookUrl);
      lastCommitSha = latestCommitSha;

      console.log(
        `[Yukina] Deploy do Aeternus solicitado para ${latestCommitSha.slice(0, 7)}.`,
      );
    } catch (error) {
      const reason = error?.name === 'TimeoutError'
        ? 'tempo limite da requisição excedido'
        : (error?.message || String(error));
      console.error(`[Yukina] Falha ao verificar/atualizar o Aeternus: ${reason}`);
    } finally {
      checking = false;
    }
  }

  console.log(
    `[Yukina] Auto-updater do Aeternus ativo: GitHub ${owner}/${name} (${branch}), verificação a cada 60 segundos.`,
  );

  checkForUpdate();
  setInterval(checkForUpdate, POLL_INTERVAL_MS);
}

module.exports = { startAeternusUpdater };
