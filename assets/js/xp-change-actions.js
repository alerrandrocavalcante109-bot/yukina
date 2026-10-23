(() => {
  "use strict";
  const panel = document.getElementById("xpRolesPanel");
  const anchor = document.getElementById("xpUnsaved");
  if (!panel || !anchor) return;

  const actions = document.createElement("div");
  actions.id = "xpChangeActions";
  actions.className = "panel";
  actions.hidden = true;
  actions.style.cssText = "margin:14px 0;padding:14px;border:1px solid #e7bd75!important;background:transparent!important";
  actions.innerHTML = '<strong>⚠️ Você tem alterações não salvas.</strong><div class="row" style="margin-top:10px"><button type="button" data-xp-action="reset">Redefinir</button><button type="button" class="btn" data-xp-action="save">Salvar</button></div>';
  const wasDirty = !anchor.hidden;
  anchor.replaceWith(actions);

  const saveButton = actions.querySelector('[data-xp-action="save"]');
  const resetButton = actions.querySelector('[data-xp-action="reset"]');

  function setDirty(dirty) {
    actions.hidden = !dirty;
  }

  window.addEventListener("yukina:xp-dirty", event => {
    setDirty(Boolean(event.detail && event.detail.dirty));
  });

  async function waitForAction(name) {
    // A página principal inicializa os handlers após montar o painel. Aguarda brevemente
    // em vez de falhar imediatamente em dispositivos lentos ou com cache parcial.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (typeof window[name] === "function") return window[name];
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("O painel de XP não terminou de inicializar. Atualize a página e tente novamente.");
  }

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      const action = await waitForAction("YukinaXpSave");
      await action();
    } catch (error) {
      window.alert(error.message || "Não foi possível inicializar o salvamento de XP.");
    } finally {
      saveButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      const action = await waitForAction("YukinaXpReset");
      await action();
    } catch (error) {
      window.alert(error.message || "Não foi possível inicializar a redefinição de XP.");
    } finally {
      resetButton.disabled = false;
    }
  });

  // Recalcula a visibilidade a partir do estado atual, inclusive se o script principal
  // tiver emitido o evento antes deste arquivo ser carregado.
  setDirty(wasDirty);
  // Se o script principal inicializar depois, o evento sincroniza o estado real.
  window.addEventListener("yukina:xp-dirty", event => {
    setDirty(Boolean(event.detail && event.detail.dirty));
  });
})();