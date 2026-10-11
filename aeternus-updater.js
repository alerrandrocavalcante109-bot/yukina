require('dotenv').config();

const POLL_INTERVAL_MS = 5000;

function getRepositoryParts(repository) {
  const clean = repository.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const [owner, name] = clean.split('/');

  if (!owner || !name) {
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
    `https://api.github.com/repos/${owner}/${name}/commits/${encodeURIComponent(branch)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`GitHub respondeu HTTP ${response.status}.`);
  }

  const data = await response.json();

  if (!data.sha) {
    throw new Error('GitHub não retornou o SHA do commit.');
  }

  return data.sha;
}

async function triggerRenderDeploy(deployHookUrl) {
  const response = await fetch(deployHookUrl, {
    method: 'POST',
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

  const { owner, name } = getRepositoryParts(repository);
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
      console.error('[Yukina] Falha ao verificar/atualizar o Aeternus:', error);
    } finally {
      checking = false;
    }
  }

  console.log(
    `[Yukina] Auto-updater do Aeternus ativo: GitHub ${owner}/${name} (${branch}), verificação a cada 5 segundos.`,
  );

  checkForUpdate();
  setInterval(checkForUpdate, POLL_INTERVAL_MS);
}

module.exports = { startAeternusUpdater };
