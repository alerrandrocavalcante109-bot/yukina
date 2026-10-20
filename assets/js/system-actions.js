/* Yukina — ações compartilhadas dos sistemas
 * Toasts e estado visual reutilizáveis em todas as páginas de configuração.
 */
(() => {
  "use strict";
  let toastTimer = null;

  function toast(message, options = {}) {
    const element = document.getElementById("yukinaToast");
    if (!element) return;
    element.textContent = String(message || "");
    element.classList.toggle("error", options.type === "error");
    element.classList.add("show");
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      element.classList.remove("show");
      toastTimer = null;
    }, Number(options.duration) > 0 ? Number(options.duration) : 4000);
  }

  function setDirtyNotice(elementOrId, dirty, message) {
    const element = typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;
    if (!element) return;
    element.hidden = !dirty;
    if (dirty && message) {
      const text = element.querySelector("[data-unsaved-message]");
      if (text) text.textContent = message;
    }
  }

  function setButtonBusy(button, busy, busyLabel = "Salvando…", idleLabel = null) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent;
      button.disabled = true;
      button.textContent = busyLabel;
    } else {
      button.disabled = false;
      button.textContent = idleLabel || button.dataset.idleLabel || button.textContent;
    }
  }

  window.YukinaSystemActions = Object.freeze({
    toast,
    setDirtyNotice,
    setButtonBusy,
    success(message = "Alterações salvas com sucesso!") {
      toast(message, { type: "success" });
    },
    error(message = "Não foi possível salvar as alterações.") {
      toast(message, { type: "error" });
    },
    reset(message = "Sistema redefinido com sucesso!") {
      toast(message, { type: "success" });
    }
  });
})();
