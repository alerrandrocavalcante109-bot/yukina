const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { getSyncState } = require('./sync-root');

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 5000;

async function git(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: __dirname,
    windowsHide: true,
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

      const finalState = await getSyncState();

      if (!finalState.synchronized) {
        throw new Error(
          '[Yukina] Atualização concluída, mas a verificação final não confirmou sincronização.',
        );
      }

      if (packageChanged) {
        console.log('[Yukina] package.json/package-lock.json mudou. Instalando dependências...');
        await execFileAsync('npm', ['install'], {
          cwd: __dirname,
          windowsHide: true,
          stdio: 'inherit',
        });
      }

      console.log(`[Yukina] ✅ Atualizada para ${finalState.localSha.slice(0, 7)}.`);
      await restartYukina();
    } catch (error) {
      console.error('[Yukina] Falha no auto-update:', error);
    } finally {
      checking = false;
    }
  }

  console.log(
    '[Yukina] 🔄 Auto-update ativo: verificando o repositório a cada 5 segundos.',
  );

  checkForUpdate();
  setInterval(checkForUpdate, POLL_INTERVAL_MS);
}

module.exports = { startYukinaUpdater };
