# Prévia Brioche no A54

Rodada 24, 29/10/2026. Cada par mostra a referência V2 à esquerda e o app nativo à direita. As 50 comparações foram capturadas com o mesmo APK instalado.

[Catálogo](02-catalog.png) · [Personalização](03-product.png) · [Carrinho](05-cart.png) · [Identificação](06-identification.png) · [Pagamento](07-payment.png) · [Confirmação](08-confirmation.png)

A prévia abre pelo ícone, funciona offline e simula o pagamento. As imagens dos sete assets de produto são as originais. A interface usa componentes React Native, sem capturas como conteúdo.

O recorte remove apenas as barras do Android: 95 pixels no topo e 42 no rodapé. A área comparada equivale a 384 × 783 pontos, escala 2,8125. A referência foi aberta no Chrome desktop nesse viewport; o app foi executado no A54 físico.

[Validações e escopo](checks.json): 123 testes em 30 suítes, lint e TypeScript sem erros, sete imagens originais por SHA-256 e modelo de preços inalterado desde as 5.760 verificações de domínio. A [sequência da remoção no carrinho](cart-removal-motion.png) mostra quadros a cada 100 ms entre 94,5 e 96 segundos da gravação do aparelho.

As diferenças residuais de rasterização e métricas subpixel das fontes permanecem visíveis nos pares. As transições usam Reanimated no Android e View Transition/Motion no navegador. Não se afirma identidade absoluta de pixels ou de todos os quadros das animações.

[Manifesto do APK e fontes](build.json) · [Hashes das capturas](captures.json) · [Teste offline](offline-result.json) · [Inatividade](idle-timings.json) · [Persistência e desfazer](persistence-result.json) · [Arquivo entregue e instalado](installed-artifact.json) · [Estado pronto para demonstrar](ready-result.json)

| Estado | Referência e app |
| --- | --- |
| 01-standby | [Abrir comparação](01-standby.png) |
| 02-catalog | [Abrir comparação](02-catalog.png) |
| 03-product | [Abrir comparação](03-product.png) |
| 04-product-selected | [Abrir comparação](04-product-selected.png) |
| 05-cart | [Abrir comparação](05-cart.png) |
| 06-identification | [Abrir comparação](06-identification.png) |
| 07-payment | [Abrir comparação](07-payment.png) |
| 08-confirmation | [Abrir comparação](08-confirmation.png) |
| 09-context | [Abrir comparação](09-context.png) |
| 10-combos | [Abrir comparação](10-combos.png) |
| 11-combo-product | [Abrir comparação](11-combo-product.png) |
| 12-combo-cart | [Abrir comparação](12-combo-cart.png) |
| 13-removal-dialog | [Abrir comparação](13-removal-dialog.png) |
| 14-empty-cart | [Abrir comparação](14-empty-cart.png) |
| 15-restored-cart | [Abrir comparação](15-restored-cart.png) |
| 16-invalid-cpf | [Abrir comparação](16-invalid-cpf.png) |
| 17-pix-selected | [Abrir comparação](17-pix-selected.png) |
| 18-table-cart | [Abrir comparação](18-table-cart.png) |
| 19-table-confirmation | [Abrir comparação](19-table-confirmation.png) |
| 20-beverages | [Abrir comparação](20-beverages.png) |
| 21-simple-product | [Abrir comparação](21-simple-product.png) |
| 22-qr-cart | [Abrir comparação](22-qr-cart.png) |
| 23-qr-confirmation | [Abrir comparação](23-qr-confirmation.png) |
| 24-qr-standby | [Abrir comparação](24-qr-standby.png) |
| 25-remove-open | [Abrir comparação](25-remove-open.png) |
| 26-remove-selected | [Abrir comparação](26-remove-selected.png) |
| 27-extras-open | [Abrir comparação](27-extras-open.png) |
| 28-extras-selected | [Abrir comparação](28-extras-selected.png) |
| 29-pairing-open | [Abrir comparação](29-pairing-open.png) |
| 30-pairing-selected | [Abrir comparação](30-pairing-selected.png) |
| 31-custom-cart | [Abrir comparação](31-custom-cart.png) |
| 32-edit-product | [Abrir comparação](32-edit-product.png) |
| 33-edited-cart | [Abrir comparação](33-edited-cart.png) |
| 34-quantity-cart | [Abrir comparação](34-quantity-cart.png) |
| 35-removal-after-idle | [Abrir comparação](35-removal-after-idle.png) |
| 36-cart-after-dialog | [Abrir comparação](36-cart-after-dialog.png) |
| 37-idle-standby | [Abrir comparação](37-idle-standby.png) |
| 38-resumed-cart | [Abrir comparação](38-resumed-cart.png) |
| 39-smash-product | [Abrir comparação](39-smash-product.png) |
| 40-chicken-product | [Abrir comparação](40-chicken-product.png) |
| 41-double-product | [Abrir comparação](41-double-product.png) |
| 42-combo-smash-product | [Abrir comparação](42-combo-smash-product.png) |
| 43-combo-chicken-product | [Abrir comparação](43-combo-chicken-product.png) |
| 44-portions | [Abrir comparação](44-portions.png) |
| 45-potato-product | [Abrir comparação](45-potato-product.png) |
| 46-onion-product | [Abrir comparação](46-onion-product.png) |
| 49-mixed-cart-before-restart | [Abrir comparação](49-mixed-cart-before-restart.png) |
| 50-mixed-cart-after-restart | [Abrir comparação](50-mixed-cart-after-restart.png) |
| 51-mixed-cart-after-undo | [Abrir comparação](51-mixed-cart-after-undo.png) |
| 52-mixed-cart-after-removal | [Abrir comparação](52-mixed-cart-after-removal.png) |
