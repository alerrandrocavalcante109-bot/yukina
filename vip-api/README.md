# Yukina VIP — comprovantes (estrutura em preparação)

O catálogo de planos fica em `../vip.html`. A página `../vip-comprovante.html` é um protótipo de formulário para recolher o ID do Discord, plano, periodicidade, valor informado, referência da transação e um arquivo de comprovante.

## Estado atual — não produção

- A página VIP encaminha a escolha para o formulário de comprovante.
- O formulário valida localmente o tipo e o tamanho do arquivo, mas **não envia nem armazena o arquivo**.
- `POST /api/vip/proofs` responde `503 proof_review_not_configured` de propósito.
- `POST /api/vip/checkout` e `POST /api/vip/webhook` continuam desativados.
- Nenhuma compra é aprovada e nenhum VIP é ativado.
- Não existe banco de dados de transações configurado nesta etapa.

## Regra de aprovação planejada

O comprovante visual não deve, sozinho, aprovar a compra: uma imagem ou PDF pode ser editado ou reutilizado. A implementação futura deve:

1. Armazenar o arquivo em armazenamento privado, com limite de tamanho, validação real do tipo de arquivo, nome aleatório e proteção contra conteúdo malicioso.
2. Criar registro de compra no banco com ID único, usuário Discord, plano, periodicidade, preço esperado em centavos, status `pending` e data.
3. Comparar a referência/ID de transação com um registro confiável do banco e garantir que a transação não tenha sido usada anteriormente.
4. Conferir valor exato, moeda BRL, destinatário/conta recebedora, data e estado real da transação. Quando não houver API bancária disponível, encaminhar para revisão manual por um administrador; não confiar só no texto do comprovante.
5. Aprovar somente quando todas as regras forem satisfeitas e a transação for confirmada por fonte confiável. Caso contrário, manter pendente ou recusar com motivo registrado.
6. Tornar a aprovação idempotente para impedir que um mesmo pagamento seja usado em duas compras.
7. Ativar VIP no backend apenas depois da aprovação, vinculando a assinatura ao usuário Discord correto e guardando auditoria de quem decidiu.
8. Proteger endpoints de administração com autenticação e autorização fortes, limitar tentativas e manter arquivos privados. Nunca guardar senhas ou tokens do Discord enviados pelo usuário.

## Endpoints existentes

- `GET /health`: estado do serviço de preparação.
- `GET /api/vip/plans`: preços oficiais em centavos.
- `POST /api/vip/proofs`: desativado até existir banco, armazenamento privado, autenticação e lógica de comparação.
- `POST /api/vip/checkout`: desativado.
- `POST /api/vip/webhook`: desativado.

## Preços (BRL)

| Plano | Mensal | Anual |
|---|---:|---:|
| Starter | R$ 7,90 | R$ 79,90 |
| Plus | R$ 9,90 | R$ 99,90 |
| Premium | R$ 14,90 | R$ 149,90 |
| Ultra | R$ 19,90 | R$ 199,90 |
| Infinity | R$ 29,90 | R$ 299,90 |

**Não usar em produção ainda.** Os próximos detalhes necessários incluem qual banco será usado, como os pagamentos serão registrados antes do envio do comprovante, quem poderá revisar/recusar e como será comprovada a transação verdadeira.