param([string]$Output = "$env:TEMP\totemos-visual-audit\native")
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly

function Assert-Text([string]$Expected) {
  $xml = Read-Ui
  if ($xml.OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}

$ui = Read-Ui
if ($ui.OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
if ((Read-Ui).OuterXml -match 'Começar novo pedido') {
  # The confirmation is taller than the viewport. Reveal the full action first.
  & $Adb -s $Serial shell input swipe 540 1800 540 1050 400
  Start-Sleep -Milliseconds 500
  Tap-Label 'Começar novo pedido'
}
Tap-Label 'Retirar no balcão'
Capture '09-context'
Tap-Label 'Fechar'
Tap-Label 'Combos'
Capture '10-combos'
Tap-Label 'Personalizar Combo Bacon Melt'
Capture '11-combo-product'
& $Adb -s $Serial shell input keyevent 4
Start-Sleep -Milliseconds 450
Assert-Text 'Personalizar Combo Bacon Melt'
Tap-Label 'Personalizar Combo Bacon Melt'
Tap-Label 'Aumentar Combo Bacon Melt'
Tap-Label 'Adicionar ao pedido'
Assert-Text 'Combos'
Tap-Label 'Ver pedido'
Assert-Text '85,80'
Capture '12-combo-cart'
Tap-Label 'Remover Combo Bacon Melt'
Capture '13-removal-dialog'
Tap-Label 'Manter item'
Assert-Text 'Combo Bacon Melt'
Tap-Label 'Remover Combo Bacon Melt'
Tap-Label 'Remover item'
& $Adb -s $Serial shell screencap -p /sdcard/visual-audit.png
& $Adb -s $Serial pull /sdcard/visual-audit.png (Join-Path $Output '14-empty-cart.png') | Out-Null
# A54 coordinates from the visible notice frame. UIAutomator waits for idle
# while its six-second progress bar animates, so query only after this tap.
& $Adb -s $Serial shell input tap 310 370
Start-Sleep -Milliseconds 650
Assert-Text '85,80'
Capture '15-restored-cart'
Tap-Label 'Identificar pedido'
Tap-Label 'Seu nome ou apelido'
& $Adb -s $Serial shell input text Nito
Hide-Keyboard
Tap-Label 'Quero CPF na nota'
Tap-Label 'Escolher pagamento'
Hide-Keyboard
Assert-Text 'Informe os 11 dígitos'
Capture '16-invalid-cpf'
Tap-Label 'Quero CPF na nota'
Tap-Label 'Voltar à etapa anterior'
Tap-Label 'Identificar pedido'
Assert-Text 'Nito'
Tap-Label 'Escolher pagamento'
Tap-Label 'Pix'
Capture '17-pix-selected'
Tap-Label 'Retirar no balcão'
Tap-Label 'Tablet'
Assert-Text 'Revise seu pedido'
Assert-Text '85,80'
Capture '18-table-cart'
Tap-Label 'Enviar pedido'
Assert-Text 'Mesa 12'
Assert-Text 'Nenhum pedido real'
Capture '19-table-confirmation'

Tap-Label 'Voltar ao cardápio'
Tap-Label 'Tablet'
Tap-Label 'QR Code'
Tap-Label 'Todos'
$ui = Read-Ui
$tab = $ui.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq 'Todos' } | Select-Object -First 1
if (!$tab) { throw 'Category rail is not visible' }
$bounds = [regex]::Match($tab.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
$railY = [int](([int]$bounds.Groups[2].Value + [int]$bounds.Groups[4].Value) / 2)
& $Adb -s $Serial shell input swipe 950 $railY 180 $railY 400
Tap-Label 'Bebidas'
Capture '20-beverages'
Tap-Label 'Personalizar Coca-Cola'
Capture '21-simple-product'
Tap-Label 'Aumentar Coca-Cola'
Tap-Label 'Aumentar Coca-Cola'
Tap-Label 'Adicionar ao pedido'
Tap-Label 'Ver pedido'
Assert-Text '21,00'
Capture '22-qr-cart'
Tap-Label 'Enviar pedido'
Assert-Text 'Mesa 12'
Capture '23-qr-confirmation'
Tap-Label 'Voltar ao cardápio'
Tap-Label 'QR Code'
Tap-Label 'Ver tela de espera'
Assert-Text 'Peça no seu ritmo.'
Capture '24-qr-standby'
Write-Output "Extended A54 audit passed: $Output"
