// Configuração central da API da Yukina.
// Mantém a API principal e troca para a reserva quando ela não entrega dados essenciais.
(() => {
  const primary = "https://yukina-s1lz.onrender.com";
  const backup = "https://yukina-jspa.onrender.com";
  const bases = [primary, backup];
  let activeBase = primary;
  window.YUKINA_API_URL = primary;
  window.YUKINA_API_BACKUP_URL = backup;
  window.YUKINA_API_URLS = bases.slice();

  if (window.__YUKINA_API_FAILOVER_INSTALLED__) return;
  window.__YUKINA_API_FAILOVER_INSTALLED__ = true;
  const nativeFetch = window.fetch.bind(window);

  function needsFallback(response, pathname, method) {
    if (method !== "GET") return false;
    if (response.status === 409 || response.status >= 500) return true;
    if (!response.ok) return false;
    return response.clone().json().then(data => {
      if (pathname === "/api/oauth/guilds") return Array.isArray(data) && data.length === 0;
      if (/^\\/api\\/guilds\\/\\d{17,20}\\/resources$/.test(pathname)) {
        return Boolean(data?.diagnostics?.rolesFetchFailed || data?.diagnostics?.channelsFetchFailed) ||
          !Array.isArray(data?.roles) || data.roles.length <= 1 ||
          !Array.isArray(data?.channels) || data.channels.length === 0;
      }
      if (/^\\/api\\/guilds\\/\\d{17,20}\\/settings$/.test(pathname)) {
        return data?.settings && typeof data.settings === "object" && Object.keys(data.settings).length === 0;
      }
      return false;
    }).catch(() => false);
  }

  window.fetch = async (input, init) => {
    const originalUrl = typeof input === "string" ? input : (input && input.url);
    if (!originalUrl) return nativeFetch(input, init);
    const matchedBase = bases.find(base => originalUrl.startsWith(base + "/") || originalUrl === base);
    if (!matchedBase) return nativeFetch(input, init);

    const pathAndQuery = originalUrl.slice(matchedBase.length);
    const pathname = (() => { try { return new URL(originalUrl).pathname; } catch (_) { return pathAndQuery.split("?")[0]; } })();
    const method = String(init?.method || (typeof input !== "string" && input?.method) || "GET").toUpperCase();
    const firstBase = activeBase;
    const secondBase = bases.find(base => base !== firstBase);
    const orderedBases = [firstBase, secondBase];
    let lastError;

    for (let index = 0; index < orderedBases.length; index++) {
      const base = orderedBases[index];
      const target = base + pathAndQuery;
      try {
        const requestInput = typeof input === "string" ? target : new Request(target, input);
        const response = await nativeFetch(requestInput, init);
        const fallback = index === 0 && await needsFallback(response, pathname, method);
        if (fallback) {
          activeBase = secondBase;
          window.YUKINA_API_URL = activeBase;
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (index === 0) {
          activeBase = secondBase;
          window.YUKINA_API_URL = activeBase;
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error("As APIs da Yukina estão indisponíveis.");
  };
})();
