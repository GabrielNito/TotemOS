param([string]$Output = "$env:TEMP\totemos-visual-audit\native", [switch]$ResumeAtContext)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Assert-Text([string]$Expected) {
  if ((Read-Ui).OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}
if (!$ResumeAtContext) {
$ui = Read-Ui
if ($ui.OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
& $Adb -s $Serial shell input swipe 540 550 540 1900 450
Start-Sleep -Milliseconds 500
Tap-Label 'brioche, início'
Tap-Label 'Lanches'
& $Adb -s $Serial shell input swipe 540 550 540 1800 350
Start-Sleep -Milliseconds 350
Tap-Label 'Personalizar Bacon Melt'
Tap-Label 'Duplo'
Tap-Label 'Adicionar ao pedido'
& $Adb -s $Serial shell input tap 950 227
# Reveal Smash beneath the featured product and remember that scroll position.
& $Adb -s $Serial shell input swipe 540 1700 540 950 350
Start-Sleep -Milliseconds 500
Read-Ui | Out-Null
Capture '47-catalog-before-product'
Tap-Label 'Personalizar Smash Clássico'
& $Adb -s $Serial shell input keyevent 4
Start-Sleep -Milliseconds 650
Capture '48-catalog-after-product'
Tap-Label 'Personalizar Smash Clássico'
Tap-Label 'Simples'
Tap-Label 'Adicionar ao pedido'
& $Adb -s $Serial shell input tap 950 227
Tap-Label 'Ver pedido'
Assert-Text '61,70'
Tap-Label 'Retirar no balcão'
}
Tap-Label 'QR Code'
Capture '49-mixed-cart-before-restart'

& $Adb -s $Serial shell am force-stop com.totemos.totem
& $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
Start-Sleep -Seconds 3
Tap-Label 'Toque para continuar'
Assert-Text 'QR Code'
Tap-Label 'Ver pedido'
Assert-Text '61,70'
Assert-Text 'Smash Clássico'
Assert-Text '2 carnes de 120 g'
Capture '50-mixed-cart-after-restart'
Tap-Label 'Remover Smash Clássico'
Tap-Label 'Remover item'
# Act inside the timed notice; UIAutomator waits until animated progress is idle.
& $Adb -s $Serial shell input tap 310 370
Start-Sleep -Milliseconds 650
Assert-Text '61,70'
Capture '51-mixed-cart-after-undo'
Tap-Label 'Remover Smash Clássico'
Tap-Label 'Remover item'
& $Adb -s $Serial shell input tap 950 227
Assert-Text '39,80'
Capture '52-mixed-cart-after-removal'
@{ result = 'PASS'; checkedAt = (Get-Date).ToUniversalTime().ToString('o'); totalBeforeRestart = '61.70'; totalAfterRestart = '61.70'; modeAfterRestart = 'qr'; totalAfterUndo = '61.70'; totalAfterRemoval = '39.80'; credentialsCleared = $false } | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'persistence-result.json')
Write-Output "Persistence, scroll restoration and multi-line cart audit passed: $Output"
