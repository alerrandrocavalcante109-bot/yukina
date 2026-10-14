# Yukina

Site estático da Yukina, com páginas públicas e uma API VIP em preparação.

## Estrutura

- **Páginas do site na raiz**: mantidas na raiz intencionalmente para preservar URLs públicas, links relativos, GitHub Pages e verificação do Google.
- **`assets/`**: imagens e recursos estáticos referenciados pelo site.
- **`vip-api/`**: Cloudflare Worker, schema D1 e instruções da API VIP. Pagamentos e envio de comprovantes permanecem desativados até configuração e testes.
- **`.github/workflows/`**: automação de deploy do site.
- **`docs/`**: documentação de arquitetura, manutenção e próximos passos.
- **`bot/`**: espaço reservado para o bot Discord quando o código definitivo for integrado. Não mover arquivos do site para esta pasta sem atualizar os caminhos e o deploy.

## Desenvolvimento seguro

- Não versionar `.env`, tokens, bancos locais, `node_modules/`, ambientes virtuais ou comprovantes.
- Usar os arquivos `.env.example` apenas como modelos sem credenciais reais.
- Testar alterações de deploy em uma branch antes de mesclar em `main`.
- Não considerar um comprovante como confirmação de pagamento; conferir a transação na fonte de recebimento.

Consulte [a documentação da estrutura](docs/ESTRUTURA.md) e [o estado da API VIP](vip-api/README.md).
