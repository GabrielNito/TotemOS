# Desenvolvimento assistido por IA no TotemOS

O [card #25](https://trello.com/c/xiUHJr2M) registra como a equipe conduz o trabalho assistido por IA na P0. O [roadmap](https://trello.com/c/iKSJ1R4J) define escopo, responsáveis e critérios de aceite. Por exemplo, o [card #38](https://trello.com/c/alj6WGQj) registra a entrega parcial do assistente, o [PR #25](https://github.com/GabrielNito/TotemOS/pull/25) e a dependência dos contratos de configuração. Os comentários registram a revisão técnica e a autorização humana comunicada para a integração parcial.

## Da tarefa à revisão

1. O responsável identifica o card, confere os contratos vigentes e compara o código com a `develop` atual. O Codex pode ler o repositório, localizar mudanças relacionadas e ajudar a identificar o menor incremento necessário.
2. A equipe cria uma branch de trabalho a partir de `develop`. Um worktree separado permite executar testes e preparar a entrega enquanto outro checkout mantém suas alterações. O [guia de contribuição](../CONTRIBUTING.md) descreve os nomes de branches, commits e o destino dos PRs.
3. O trabalho de código segue RED → GREEN → refatoração. Primeiro vem um teste que falha pela regra em falta. Depois vem a mudança mínima e a nova execução. O agente pode preparar o teste e a implementação, rodar a suíte e registrar resultados. Em seguida, a equipe confere o diff, o lint, a tipagem e o build.
4. A [CI](../.github/workflows/ci.yml) valida Backend, Dashboard, Totem e KDS. O PR dá à equipe um ponto de revisão para verificar o escopo e comparar os resultados com os critérios do card. A pessoa responsável decide se a entrega está pronta para merge e se o card pode ser encerrado.

## Instruções e evidência

O [AGENTS.md](../AGENTS.md) orienta mudanças assistidas e registra regras como isolamento por negócio, preço snapshot, autorização por dispositivo e liberação DEMO com PIN. As [regras do Backend](../.agents/rules/backend.md) complementam as exigências de validação, tipagem, segurança e testes.

O registro de uma execução deve indicar a revisão do código, o ambiente, o cenário e o resultado observado. Uma suíte automatizada cobre os casos que executou. Capturas de interface com respostas de teste comprovam a renderização naquele cenário. O [registro histórico do assistente](evidence/dashboard-primeira-configuracao/README.md) descreve os limites dessa cobertura. Homologação em equipamento dedicado exige evidência do equipamento, da versão e do modo de gerenciamento usados.

Cabe à equipe humana aprovar mudanças de contrato, avaliar permissões e isolamento, revisar os PRs e aceitar a demonstração. Resultados automatizados e relatos do agente servem como insumos para essas decisões. Registre somente evidências sanitizadas, sem credenciais, tokens, PINs ou dados pessoais.
