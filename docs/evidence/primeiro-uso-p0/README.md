# Primeiro uso e versões observadas do P0

Registro de 16/11/2026. A revisão de código usa a `develop` em `0797e0e`. O ensaio de 15/11, a inspeção de deployments e os testes da correção têm origens distintas.

## Ensaio de 15/11

- O ensaio de primeiro uso usou o Totem no Galaxy A54, KDS Android em AVD e Dashboard. Os logs locais registram builds Android concluídos, login, gestão de catálogo, ativação de dispositivos e leitura da fila. A tentativa com `GET /dispositivos/me` em 503 foi seguida por uma segunda ativação rejeitada. O log não registra um cadastro novo bem-sucedido e mostra conflitos de cadastro HTTP 409.
- O mesmo registro mostra criação de um pedido (201), liberação DEMO (200), atribuição da senha (200), três transições (200) e consultas de acompanhamento. A fila também retornou 401 em um cenário de revogação. A validação anterior com dois AVDs e os limites de hardware constam do [card #40](https://trello.com/c/KTkrIl4Z).
- O pareamento por HTTPS sem USB foi confirmado pelo operador em uma rodada separada. O SHA e o hash do APK instalado nessa rodada não estão disponíveis no registro consultado. O aceite do fluxo em hardware gerenciado e a operação comercial continuam pendentes.

## Versões e ambientes

| Componente | Evidência | Commit ou artefato |
| --- | --- | --- |
| Repositório | [PR #35](https://github.com/GabrielNito/TotemOS/pull/35) integrado em `develop`. | `0797e0e` |
| Dashboard Vercel | Deployment de 15/11/2026 às 20h40 BRT, alvo `production`, estado `READY` em 16/11. | `dpl_7Bb1TWAwxHvVx6c8MFQH8H89kVi9`. A inspeção não retornou commit Git. [Deployment](https://totem-r1fy63aul-gabriel-nito.vercel.app/) |
| Backend Vercel | Deployment de 15/11/2026 às 20h40 BRT, alvo `production`, estado `READY` em 16/11. | `dpl_5LFnP4GDdJJmpDTU5ehtswtoYT6u`. A inspeção não retornou commit Git. [Deployment](https://totem-os-backend-dzsob1i9y-gabriel-nito.vercel.app/) |
| Totem Android | Build de laboratório no A54 e pareamento HTTPS sem USB relatado em rodada separada. | SHA e SHA-256 do APK da rodada HTTPS sem registro confirmado. |
| KDS Android | Build de laboratório e fila em AVD. | SHA e SHA-256 do APK desse ensaio sem registro confirmado. |

`READY` descreve o estado do build na Vercel. A consulta não verificou a versão servida por cada domínio canônico nem o destino PostgreSQL. Para comparar uma nova rodada, anote o SHA de cada app, os IDs do Backend e do Dashboard, o SHA-256 de cada APK, o ambiente e os cenários aprovados.

## Critérios para o primeiro piloto

O marco proposto `MVP_PILOT_READY` exige instalação e pareamento HTTPS em equipamentos do piloto, catálogo publicado, integração de pagamento com confirmação legítima e contingência, fila KDS e recuperação após perda de rede ou reinício. O aceite também depende de hardware dedicado com o DPC da operação, ambiente persistente com migrações verificadas e procedimentos de monitoramento e suporte. O fluxo DEMO reproduzível é o [roteiro de laboratório](../../guias/guia-reproducao-p0.md).
