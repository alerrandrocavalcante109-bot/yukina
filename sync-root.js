const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const ROOT_DIR = __dirname;
const REMOTE = process.env.GIT_REMOTE || 'origin';
const BRANCH = process.env.GIT_BRANCH || 'main';

async function git(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: ROOT_DIR,
    windowsHide: true,
  });

  return stdout.trim();
}

async function getSyncState(fetchRemote = true) {
  if (fetchRemote) {
    await git(['fetch', REMOTE, BRANCH]);
  }

  const currentBranch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const localSha = await git(['rev-parse', 'HEAD']);
  const remoteSha = await git(['rev-parse', `${REMOTE}/${BRANCH}`]);
  const status = await git(['status', '--porcelain']);

  return {
    branch: currentBranch,
    localSha,
    remoteSha,
    clean: status === '',
    synchronized: currentBranch === BRANCH && localSha === remoteSha && status === '',
  };
}

async function assertSynchronized() {
  const state = await getSyncState();

  if (!state.synchronized) {
    const reasons = [];

    if (state.branch !== BRANCH) {
      reasons.push(`branch atual é ${state.branch}, esperado ${BRANCH}`);
    }

    if (state.localSha !== state.remoteSha) {
      reasons.push(
        `commits diferentes (local ${state.localSha.slice(0, 7)} / remoto ${state.remoteSha.slice(0, 7)})`,
      );
    }

    if (!state.clean) {
      reasons.push('existem alterações locais não commitadas');
    }

    throw new Error(
      `[Yukina] Sincronização bloqueada: ${reasons.join('; ')}. Nenhum push será realizado.`,
    );
  }

  return state;
}

async function createSyncBaseline() {
  const state = await assertSynchronized();

  return {
    branch: state.branch,
    sha: state.localSha,
  };
}

async function safePush(message, baseline) {
  if (!message || !message.trim()) {
    throw new Error('[Yukina] Push bloqueado: mensagem de commit obrigatória.');
  }

  if (!baseline?.sha || baseline.branch !== BRANCH) {
    throw new Error(
      '[Yukina] Push bloqueado: é obrigatório informar uma linha de base sincronizada.',
    );
  }

  const beforePush = await getSyncState();

  if (
    beforePush.branch !== BRANCH ||
    beforePush.localSha !== baseline.sha ||
    beforePush.remoteSha !== baseline.sha
  ) {
    throw new Error(
      '[Yukina] Push bloqueado: Termux e GitHub divergiram desde a linha de base. ' +
      'Nenhum push será realizado.',
    );
  }

  if (beforePush.clean) {
    throw new Error(
      '[Yukina] Push cancelado: nenhuma alteração local foi preparada para envio.',
    );
  }

  await git(['add', '-A']);

  const staged = await git(['diff', '--cached', '--name-only']);
  if (!staged) {
    throw new Error('[Yukina] Push cancelado: nenhuma alteração para enviar.');
  }

  await git(['commit', '-m', message.trim()]);
  await git(['push', REMOTE, BRANCH]);

  const finalState = await getSyncState();

  if (!finalState.synchronized) {
    throw new Error(
      '[Yukina] Push concluído, mas a verificação final não confirmou sincronização.',
    );
  }

  return finalState;
}

module.exports = {
  getSyncState,
  assertSynchronized,
  createSyncBaseline,
  safePush,
};
