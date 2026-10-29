# Auditoria visual e funcional da V2 do Totem

A interface nativa foi comparada com `https://totemos-kiosk-preview.vercel.app/v2` e com o projeto de referência fornecido pelo usuário. Os componentes de catálogo, produto, carrinho, espera e checkout são compartilhados entre a demonstração e o negócio pareado. Não há capturas de tela na interface; as sete imagens de produtos são os assets originais.

## Demonstração aprovada no A54

A [galeria final](evidence/totem-v2/final/README.md) registra 50 pares de referência e app, incluindo os dez produtos, personalização, edição, contextos, carrinho, identificação e confirmação simulada. As capturas correspondem ao APK identificado no [manifesto visual](evidence/totem-v2/final/build.json), anterior ao fechamento funcional deste card. As fontes dos componentes visuais permanecem preservadas; o fechamento acrescentou proteção de disponibilidade, testes e CI.

O fluxo demonstrativo passou com Wi-Fi e dados móveis desligados, abrindo pelo ícone. A prévia tem armazenamento exclusivo e não usa as credenciais ou o carrinho do negócio. O [resultado offline](evidence/totem-v2/final/offline-result.json), a [persistência](evidence/totem-v2/final/persistence-result.json), a [inatividade](evidence/totem-v2/final/idle-timings.json) e a [identidade do APK instalado](evidence/totem-v2/final/installed-artifact.json) estão registrados.

## Catálogo conectado

A [validação funcional do card](totem-catalogo-card.md) registra a nova rodada no A54 com `EXPO_PUBLIC_KIOSK_PREVIEW=0`: identidade autenticada, catálogo real, variações, máximo de adicionais, edição e persistência. Também foram verificados loading, vazio, falha HTTP, conexão interrompida, resposta inválida e recuperação por retry.

Falhas e indisponibilidades foram injetadas por um gateway local de auditoria, exclusivamente de leitura. O gateway preserva a identidade real, restringe o catálogo ao tenant autenticado e bloqueia mutações. Os produtos do negócio não foram alterados, pedidos não foram criados e pagamentos não foram iniciados. A prévia Brioche aprovada foi restaurada após os testes.

## Método e limites

A54 SM-A546E, 1080 × 2340 pixels, densidade 450, fonte do sistema 0,9. A comparação usa 384 × 783 pontos e escala 2,8125; o recorte exclui 95 pixels de status e 42 de navegação. A referência foi capturada em Chrome desktop no viewport equivalente; o app foi executado no aparelho físico. Não foi feita comparação no Chrome do próprio celular.

A rasterização e as métricas subpixel das fontes diferem entre Chrome e React Native. As transições usam Reanimated no Android e View Transition/Motion no navegador. Não se afirma identidade absoluta de pixels ou de todos os quadros, nem validação para outros tamanhos de tela.

O APK de auditoria reutiliza a parte nativa já existente, atualiza o bundle Expo/Hermes, recebe alinhamento de 16 KiB e assinatura de desenvolvimento e é verificado antes da instalação. Não é uma nova compilação Gradle completa. Os dois exports Android do código atual passaram separadamente, e agora também fazem parte do CI.

## Escopo funcional

`EXPO_PUBLIC_KIOSK_PREVIEW=1` é a demonstração Brioche offline, com checkout explicitamente simulado. A variante padrão usa o catálogo do negócio autenticado. O pagamento real permanece desabilitado sem integração; o carrinho é mantido. Criação de pedidos, Point, confirmação assíncrona, cozinha, sincronização offline e Lock Task não são entregues por este card.
