// Configuração central da API da Yukina.
// A principal é usada normalmente; a reserva é tentada em falhas de rede/servidor.
(() => {
  const primary = "https://yukina-s1lz.onrender.com";
  const backup = "https://yukina-jspa.onrender.com";
  window.YUKINA_API_URL = primary;
  window.YUKINA_API_BACKUP_URL = backup;
  window.YUKINA_API_URLS = [primary, backup];

  if (window.__YUKINA_API_FAILOVER_INSTALLED__) return;
  window.__YUKINA_API_FAILOVER_INSTALLED__ = true;
  const nativeFetch = window.fetch.bind(window);
  const bases = [primary, backup];

  window.fetch = async (input, init) => {
    const originalUrl = typeof input === "string" ? input : (input && input.url);
    if (!originalUrl) return nativeFetch(input, init);
    const matchedBase = bases.find(base => originalUrl.startsWith(base + "/") || originalUrl === base);
    if (!matchedBase) return nativeFetch(input, init);

    const pathAndQuery = originalUrl.slice(matchedBase.length);
    let lastError;
    for (let index = 0; index < bases.length; index++) {
      const base = bases[index];
      const target = base + pathAndQuery;
      try {
        const requestInput = typeof input === "string" ? target : new Request(target, input);
        const response = await nativeFetch(requestInput, init);
        if (index === 0 && [502, 503, 504].includes(response.status)) continue;
        return response;
      } catch (error) {
        lastError = error;
        if (index === bases.length - 1) throw error;
      }
    }
    throw lastError || new Error("As APIs da Yukina estão indisponíveis.");
  };
})();
