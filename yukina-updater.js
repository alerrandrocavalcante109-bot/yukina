const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { getSyncState } = require('./sync-root');

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 30_000;
const NPM_INSTALL_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 60_000;

async function git(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: __dirname,
    windowsHide: true,
    timeout: GIT_TIMEOUT_MS,
    killSignal: 'SIGTERM',
    maxBuffer: 2 * 1024 * 1024,
  });

  return stdout.trim();
}

async function restartYukina() {
  const child = require('node:child_process').spawn(
    process.execPath,
    process.argv.slice(1),
    {
      cwd: __dirname,
      env: process.env,
      detached: true,
      stdio: 'inherit',
    },
  );

  child.unref();

  console.log('[Yukina] Nova versão iniciada. Encerrando a versão antiga...');
  process.exit(0);
}

function startYukinaUpdater() {
  let checking = false;

  async function checkForUpdate() {
    if (checking) return;
    checking = true;

    try {
      const state = await getSyncState();

      if (state.branch !== 'main') {
        console.warn(
          `[Yukina] ⚠️ Atualização bloqueada: branch atual é ${state.branch}; esperado main.`,
        );
        return;
      }

      if (!state.clean) {
        console.warn(
          '[Yukina] ⚠️ Atualização bloqueada: existem alterações locais não commitadas. ' +
          'Nenhum arquivo será sobrescrito.',
        );
        return;
      }

      if (state.localSha === state.remoteSha) return;

      console.log(
        `[Yukina] 🆕 Novo commit detectado: ${state.remoteSha.slice(0, 7)}. Atualizando...`,
      );

      const changedFiles = await git([
        'diff',
        '--name-only',
        'HEAD',
        'origin/main',
      ]);

      const packageChanged = changedFiles
        .split('\n')
        .some((file) => file === 'package.json' || file === 'package-lock.json');

      await git(['merge', '--ff-only', 'origin/main']);

      const finalState = await getSyncState(false);

      if (!finalState.synchronized) {
        const reasons = [];
        if (finalState.branch !== 'main') {
          reasons.push(`branch=${finalState.branch}`);
        }
        if (finalState.localSha !== finalState.remoteSha) {
          reasons.push(
            `local=${finalState.localSha.slice(0, 7)} remoto=${finalState.remoteSha.slice(0, 7)}`,
          );
        }
        if (!finalState.clean) reasons.push('há alterações locais não commitadas');

        throw new Error(
          '[Yukina] Atualização aplicada, mas a validação falhou: ' +
          reasons.join('; '),
        );
      }

      if (packageChanged) {
        console.log('[Yukina] Dependências mudaram. Executando npm install...');
        await execFileAsync('npm', ['install'], {
          cwd: __dirname,
          windowsHide: true,
          timeout: NPM_INSTALL_TIMEOUT_MS,
          killSignal: 'SIGTERM',
          maxBuffer: 10 * 1024 * 1024,
        });
      }

      console.log(`[Yukina] ✅ Atualizada para ${finalState.localSha.slice(0, 7)}.`);
      await restartYukina();
    } catch (error) {
      const detail = error?.stderr?.trim() || error?.message || String(error);
      console.error('[Yukina] Falha no auto-update:', detail);
    } finally {
      checking = false;
    }
  }

  console.log(
    '[Yukina] 🔄 Auto-update ativo: verificando o repositório a cada 60 segundos.',
  );

  checkForUpdate();
  setInterval(checkForUpdate, POLL_INTERVAL_MS);
}

module.exports = { startYukinaUpdater };
