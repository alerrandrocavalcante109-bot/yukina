# Yukina Manager — Authentication

Camada de autenticação da API.

A API deve receber:

Authorization: Bearer SEU_TOKEN

ou:

X-Yukina-Token: SEU_TOKEN

O token é lido exclusivamente de YUKINA_MANAGER_TOKEN. Não coloque o token no GitHub.

Por segurança, o token precisa ter pelo menos 32 caracteres. A comparação usa uma função resistente a diferenças de tempo.
