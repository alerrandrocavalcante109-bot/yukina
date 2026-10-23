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
  anchor.replaceWith(actions);

  const saveButton = actions.querySelector('[data-xp-action="save"]');
  const resetButton = actions.querySelector('[data-xp-action="reset"]');

  function setDirty(dirty) {
    actions.hidden = !dirty;
  }

  window.addEventListener("yukina:xp-dirty", event => {
    setDirty(Boolean(event.detail && event.detail.dirty));
  });

  saveButton.addEventListener("click", async () => {
    if (typeof window.YukinaXpSave !== "function") {
      window.alert("O sistema de salvamento de XP ainda não foi carregado. Recarregue o painel.");
      return;
    }
    saveButton.disabled = true;
    try { await window.YukinaXpSave(); }
    finally { saveButton.disabled = false; }
  });

  resetButton.addEventListener("click", async () => {
    if (typeof window.YukinaXpReset !== "function") {
      window.alert("O sistema de redefinição de XP ainda não foi carregado. Recarregue o painel.");
      return;
    }
    resetButton.disabled = true;
    try { await window.YukinaXpReset(); }
    finally { resetButton.disabled = false; }
  });

  // Recalcula a visibilidade a partir do estado atual, inclusive se o script principal
  // tiver emitido o evento antes deste arquivo ser carregado.
  const check = () => {
    const warning = document.getElementById("xpWarningText");
    if (warning) setDirty(!warning.parentElement.hidden);
  };
  check();
})();