# Yukina Bot Transfer API

A API fica no mesmo serviço da Yukina e usa o MongoDB configurado por `MONGODB_URI` e `MONGODB_DB`. Ela aceita apenas bots que tenham uma integração ativa criada por um administrador da Yukina.

## Comandos Discord

- `/api gerar bot_id:<ID_DO_BOT>` ou `Yapi gerar <ID_DO_BOT>`: cria uma integração e gera uma chave. O slash mostra a chave em resposta privada; o comando por prefixo envia a chave por DM.
- `/api moeda codigo:<CÓDIGO> nome:<NOME> simbolo:<SÍMBOLO>` ou `Yapi moeda <CÓDIGO> <NOME> <SÍMBOLO>`: cadastra/ativa uma moeda aceita pela API.
- `/api revogar bot_id:<ID_DO_BOT>` ou `Yapi revogar <ID_DO_BOT>`: invalida a chave e desativa a integração.

A chave é mostrada apenas na criação. Guarde-a em variável de ambiente no bot integrado, por exemplo `YUKINA_TRANSFER_API_KEY`. Nunca a envie em mensagens públicas ou a coloque no repositório.

## Base URL

`https://yukina.onrender.com/api/bot-transfer`

Todas as rotas recebem `Authorization: Bearer SUA_CHAVE` e corpo JSON. Respostas JSON. O serviço não aceita moedas que não estejam cadastradas e ativas.

## Rotas (POST)

### `/currencies`
Lista moedas cadastradas e ativas. Corpo: `{}`.

### `/balance`
Consulta o saldo central de um usuário no bot autenticado.
```json
{ "userId": "123456789012345678", "currency": "KZ" }
```

### `/credit`
Credita saldo na carteira central do usuário pertencente ao bot autenticado. Use para sincronizar ganhos/depósitos do bot integrado. Cada evento deve ter uma `idempotencyKey` única e estável; repetir a mesma chave não credita novamente.
```json
{ "userId": "123456789012345678", "currency": "KZ", "amount": 500, "idempotencyKey": "daily-2026-10-28-user123" }
```
**Importante:** esta rota permite ao bot autenticado creditar saldo da API. Só integre bots confiáveis e mantenha a chave secreta.

### `/transfer`
Transfere da conta central do usuário no bot autenticado para uma conta de um segundo bot que também esteja integrado.
```json
{
  "fromUserId": "123456789012345678",
  "toBotId": "234567890123456789",
  "toUserId": "345678901234567890",
  "currency": "KZ",
  "amount": 250,
  "idempotencyKey": "transfer-unique-operation-0001"
}
```
A API valida a chave, os dois bots integrados, a moeda e o saldo; debita e credita em uma transação MongoDB e registra o histórico. A chave de idempotência evita processar novamente a mesma transferência.

### `/history`
Lista até 50 transferências de entrada e saída do bot autenticado. Corpo opcional: `{"limit":20}`.

## Códigos de resposta comuns

- `200/201`: operação concluída (a resposta inclui `duplicate: true` quando já processada).
- `400`: campos inválidos.
- `401`: chave ausente, inválida ou revogada.
- `403`: bot de destino não integrado.
- `404`: moeda ou rota não encontrada.
- `409`: saldo insuficiente.
- `503`: banco temporariamente indisponível.

## Limites importantes

Os saldos mantidos por esta API são saldos centrais da API; eles **não alteram automaticamente** as carteiras locais de cada bot. Cada bot integrado precisa sincronizar seus ganhos com `/credit`, consultar o saldo central e refletir uma transferência concluída na sua própria interface/economia. O registro central é a fonte de verdade para transferências entre bots. O MongoDB Atlas precisa aceitar transações (cluster replica set/sharded, como o Atlas padrão).
