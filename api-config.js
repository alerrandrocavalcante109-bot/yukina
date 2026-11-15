// Configuração simples da API da Yukina.
// A API principal é usada diretamente; a reserva fica disponível para fallback explícito.
(() => {
  const primary = "https://yukina-s1lz.onrender.com";
  window.YUKINA_API_URL = primary;
  window.YUKINA_API_BACKUP_URL = "";
  window.YUKINA_API_URLS = [primary];
})();
