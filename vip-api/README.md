# Yukina VIP API — etapa 2 (estrutura segura, não produção)

Este diretório é um esqueleto para um backend Cloudflare Worker. A página pública `vip.html` funciona como catálogo, mas **não realiza cobranças e não ativa assinaturas**.

## Estado atual

- `GET /health`: informa que o serviço de preparação está disponível.
- `GET /api/vip/plans`: retorna os preços aprovados em centavos.
- `POST /api/vip/checkout`: responde `503 payments_not_configured` intencionalmente.
- `POST /api/vip/webhook`: responde `503 webhook_not_configured` intencionalmente.
- Nenhuma credencial, token, chave privada ou URL de pagamento está incluída no repositório.
- Não confie em redirects do navegador, screenshots ou comprovantes como prova de pagamento.

## Para habilitar pagamentos reais

1. Um responsável legal deve verificar a elegibilidade e administrar a conta comercial/provedor de pagamentos aplicável. Não usar credenciais pessoais de terceiros nem tentar contornar as regras de idade.
2. Confirmar no Mercado Pago quais produtos de assinatura, meios de pagamento, recorrência e conta recebedora são permitidos para a situação real. A preferência por receber no Nubank ainda precisa ser validada com o provedor.
3. Definir um backend implantado e um banco persistente para usuários Discord, assinatura, plano, período pago, IDs de pagamento e eventos de Webhook.
4. Implementar criação de assinatura no servidor, com preços derivados exclusivamente da tabela confiável, nunca de valores enviados pelo navegador.
5. Validar a assinatura criptográfica de cada Webhook, consultar a cobrança diretamente à API oficial e conferir estado, valor, moeda, identificador externo e conta/assinatura relacionada.
6. Tornar o processamento idempotente para notificações repetidas e registrar renovações, cancelamentos, falhas, estornos e contestações.
7. Liberar benefícios somente após confirmação do pagamento no backend; manter logs sem armazenar dados de cartão.
8. Testar em ambiente de teste/sandbox e validar cancelamento, pagamento recusado, notificação repetida e indisponibilidade antes de qualquer lançamento.

## Preços aprovados (BRL)

| Plano | Mensal | Anual |
|---|---:|---:|
| Starter | R$ 7,90 | R$ 79,90 |
| Plus | R$ 9,90 | R$ 99,90 |
| Premium | R$ 14,90 | R$ 149,90 |
| Ultra | R$ 19,90 | R$ 199,90 |
| Infinity | R$ 29,90 | R$ 299,90 |

Valores em centavos são definidos em `worker.js`. A página do catálogo é informativa; ela não deve ser considerada um checkout.

## Vínculo de servidor Discord

Uma assinatura poderá vincular um servidor onde o assinante tenha permissão para administrar a Yukina. O backend deve verificar o usuário autenticado, as permissões reais no Discord e o limite de um servidor vinculado por assinatura. Benefícios de servidor são administrativos; multiplicadores pessoais nunca são concedidos a todos os membros.

**Não implantar como integração de produção até que autenticação, banco, verificação de pagamentos, política de cancelamento e configuração legal estejam completos.**