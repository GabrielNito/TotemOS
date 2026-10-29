# Fechamento do card de catálogo do Totem

Card: https://trello.com/c/sDdhByQD

## Comportamento entregue

Depois do pareamento, o Totem consulta `GET /catalogo/publico/:negocioId` usando a identidade autenticada do dispositivo e apresenta categorias e produtos do negócio. Nome, descrição, imagem, variações e adicionais vêm da API. Categorias e produtos inativos, conteúdo esgotado e adicionais indisponíveis são ocultados. O cliente também filtra uma categoria explicitamente marcada como inativa, mesmo que ela apareça em uma resposta inesperada da API.

A seleção exige uma variação quando o catálogo oferece opções, limita cada adicional pelo `maximo` real e apresenta resumo e preço informativo em BRL. Não foram criados grupos de adicionais ou mínimos fictícios. A tela cobre carregamento, catálogo vazio, falha e retry. Cancelamento de requisições e validação da sessão evitam que uma resposta antiga abra outro catálogo.

`GET /dispositivos/me` acrescenta nome, boas-vindas e modo de identificação do negócio autenticado. As consultas continuam filtradas por dispositivo e `negocioId`; hashes, PIN e identificador Point não são expostos. O cliente rejeita metadados de outro tenant.

A UI também inclui a personalização visual pedida, o carrinho local e a prévia demonstrativa Brioche. Carrinho e prévia usam chaves de armazenamento separadas, com isolamento por negócio. O fluxo conectado não cria pedido nem simula aprovação de pagamento. Preço final, pedido real, Point, cozinha, sincronização offline e Lock Task permanecem fora do escopo.

## TDD e validação local

- O teste novo de categoria inativa falhou antes da correção e passou após o filtro no normalizador.
- Totem: 123 testes em 28 suítes, lint sem erros/avisos e TypeScript aprovado. Foram removidos dois módulos antigos sem consumidores, cujos testes espelhavam a implementação; os comportamentos ativos permanecem cobertos nos componentes compartilhados.
- Backend: 82 testes, lint e build NestJS aprovados, incluindo projeção segura da identidade e rejeição de tenant divergente.
- Exports Android das variantes conectada e demonstrativa aprovados com cache limpo. O workflow de CI agora executa lint, Jest, TypeScript e ambos os exports do Totem.
- `npm ci --ignore-scripts --dry-run` validou a consistência do lockfile.

## Galaxy A54 físico

[Resultado do fluxo conectado](evidence/totem-v2/catalog-card/paired-result.json), [cenários de falha e disponibilidade](evidence/totem-v2/catalog-card/states-result.json), [manifesto do APK de auditoria](evidence/totem-v2/catalog-card/build.json) e [índice das capturas](evidence/totem-v2/catalog-card/captures.json).

O fluxo conectado foi executado contra o backend local e o catálogo real, preservando o token já pareado. Configurar Duplo com um adicional e duas unidades produziu R$ 89,60. Editar para Simples preservou o adicional e produziu R$ 67,80; três unidades resultaram em R$ 101,70, mantidos após reiniciar.

As falhas foram inseridas entre o app e a API por `scripts/catalog-audit-gateway.cjs`. A identidade continua sendo validada pelo backend real; somente as respostas de catálogo são controladas. Os casos incluem carregamento retido, resposta vazia, HTTP 503, conexão encerrada e JSON incompatível. Em todos os casos de falha, retry revalidou a sessão e recuperou o catálogo real.

No cenário de disponibilidade, a resposta recebeu itens de auditoria explicitamente inativos/esgotados. Eles não apareceram no app. Adicionar sem selecionar uma variação permaneceu bloqueado; o adicional real atingiu o máximo de duas unidades e desabilitou o incremento. O preço configurado foi R$ 49,80. O gateway não encaminha POST, PUT, DELETE ou outras mutações; um POST de teste foi rejeitado com 405. Não houve criação de pedido, cobrança ou alteração dos produtos no banco.

As capturas excluem apenas as barras do Android e são evidência, nunca conteúdo da interface. A prévia Brioche aprovada foi restaurada ao terminar e os itens criados pelo teste foram removidos do carrinho conectado.

## Reprodução

Configuração de desenvolvimento: copiar `apps/totem/.env.example` para `.env.local` e definir a URL pública da API. A flag padrão `EXPO_PUBLIC_KIOSK_PREVIEW=0` seleciona o negócio pareado; `1` seleciona a demonstração offline.

Para repetir a auditoria com USB, usar PowerShell 7, ADB e Node. Os scripts aceitam `ANDROID_SERIAL`; sem ele, exigem exatamente um dispositivo autorizado. Configurar `CATALOG_AUDIT_CONTROL` e `CATALOG_AUDIT_EVENTS` para arquivos temporários, iniciar o gateway local, configurar `adb reverse` e gerar uma variante de auditoria com API no gateway. Executar `capture-device-paired.ps1` e `capture-device-catalog-states.ps1` com o `NegocioId` autenticado. Não executar os roteiros de carrinho sobre um carrinho de uso real.

Os utilitários opcionais de comparação usam Playwright/Chrome e Sharp. Os módulos podem ser fornecidos por `PLAYWRIGHT_MODULE` e `SHARP_MODULE`; não são dependências da aplicação.
