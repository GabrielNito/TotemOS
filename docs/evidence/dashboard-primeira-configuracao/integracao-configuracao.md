# Integração das configurações no assistente #38

Base `db0d5561301e74e386b8433cf4cd31e4b3fcc522`, em 13/11/2026. O assistente consulta o contrato dos PRs #28 e #29 com a sessão humana atual. Valores padrão e alterações salvas mantêm **Revisão pendente**, pois o contrato não registra revisão explícita. O link de revisão leva à página que aplica as permissões e valida o PIN.

- RED inicial: 10 falhas e 4 sucessos nos testes de interface com a integração ausente. Um teste posterior falhou quando um cadastro sem data de pareamento era considerado pronto.
- GREEN: 143 testes Dashboard, lint sem avisos, tipagem e build aprovados.
- Playwright Chromium com login real como DONO, Fastify/NestJS e PostgreSQL 18 descartável em loopback. Em 1440 × 1000 e 390 × 844, GET e PATCH retornaram HTTP 200. A volta ao assistente e a recarga exibiram os novos valores e o estado de revisão. Sem overflow horizontal ou erros de console. [Desktop](desktop-configuracao-real.png) · [Mobile](mobile-configuracao-real.png).
- Axe apontou landmarks `main` duplicados no layout administrativo em ambas as larguras e elementos interativos aninhados e regiões fora de landmarks na sidebar desktop. Esses pontos estão no layout compartilhado anterior à mudança do assistente.
- Testes de interface cobrem DONO e GERENTE, payload incompleto, 401/403/404/429/503, tenant divergente, falha parcial e refetch. Testes da consulta cobrem timeout, troca de token e respostas fora de ordem.

O [ensaio original](README.md) registra a fase anterior, com fixture HTTP. A rodada acima usou API e banco reais com dados sintéticos.
