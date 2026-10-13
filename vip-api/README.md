# Yukina VIP — loja em preparação

O catálogo de planos fica em `../vip.html`. A página `../vip-comprovante.html` é um protótipo de formulário; ela não envia nem armazena arquivos.

## Estado atual

- Login Discord: base OAuth implementada, requer D1 e secrets configurados.
- `GET /api/auth/me`: informa se existe sessão válida.
- `POST /api/auth/logout`: encerra sessão.
- `GET /api/vip/plans`: lista preços oficiais em centavos.
- `POST /api/vip/checkout`: desativado e responde 503.
- `POST /api/vip/proofs`: desativado e responde 503.
- `POST /api/vip/webhook`: desativado e responde 503.
- Nenhum pagamento é criado e nenhum VIP é ativado nesta etapa.

## Preços (BRL)

| Plano | Mensal | Anual |
|---|---:|---:|
| Starter | R$ 7,90 | R$ 79,90 |
| Plus | R$ 9,90 | R$ 99,90 |
| Premium | R$ 14,90 | R$ 149,90 |
| Ultra | R$ 19,90 | R$ 199,90 |
| Infinity | R$ 29,90 | R$ 299,90 |

Veja [AUTH_SETUP.md](./AUTH_SETUP.md) para configurar Discord OAuth e D1 sem expor credenciais. A base ainda não está pronta para produção até configurar o ambiente e executar testes reais.
