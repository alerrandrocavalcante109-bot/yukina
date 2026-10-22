// URL pública da API Node (Render). Sem barra no final.
// Cloudflare Pages (site) e Render (bot/API) são serviços diferentes.
// Ajuste para a URL real do serviço no Render se mudar o nome.
(function () {
  const fromMeta = typeof document !== "undefined"
    ? document.querySelector('meta[name="yukina-api"]')?.getAttribute("content")
    : null;
  window.YUKINA_API_URL = (fromMeta || window.YUKINA_API_URL || "https://yukina.onrender.com").replace(/\/$/, "");
})();
