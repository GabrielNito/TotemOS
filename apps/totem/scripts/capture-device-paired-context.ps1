param([string]$Output = "$env:TEMP\totemos-visual-audit\native-paired", [switch]$CheckIdle)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Assert-Text([string]$Expected) {
  if ((Read-Ui).OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}
function Assert-Radio([string]$Name) {
  $node = (Read-Ui).SelectNodes('//node[@checkable="true"]') | Where-Object { $_.'content-desc' -like "$Name*" } | Select-Object -First 1
  if (!$node -or $node.checked -ne 'true') { throw "Payment option is not checked: $Name" }
}
if ((Read-Ui).OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
Tap-Label 'Retirar no balcão'
Capture '19-paired-context'
if ($CheckIdle) { Start-Sleep -Seconds 31; Start-Sleep -Seconds 31 }
$ui = Read-Ui
if ($ui.OuterXml -match 'mesa 12|marca fictícia|Toque para') { throw 'Live context contains demo data or was interrupted by standby' }
Capture '20-paired-context-after-wait'
Tap-Label 'Voltar à tela inicial'
Capture '21-paired-manual-standby'
Tap-Label 'Toque para'
$ui = Read-Ui
$tab = $ui.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq 'Todos' } | Select-Object -First 1
if (!$tab) { throw 'Category rail is not visible' }
$bounds = [regex]::Match($tab.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
$railY = [int](([int]$bounds.Groups[2].Value + [int]$bounds.Groups[4].Value) / 2)
& $Adb -s $Serial shell input swipe 950 $railY 180 $railY 400
Tap-Label 'Bebidas'
Tap-Label 'Personalizar Coca-Cola'
Tap-Label 'Adicionar ao pedido'
& $Adb -s $Serial shell input tap 950 227
Tap-Label 'Ver pedido'
Assert-Text '7,00'
Capture '22-paired-cart-before-context'
Tap-Label 'Retirar no balcão'
Capture '23-paired-context-with-cart'
Tap-Label 'Voltar à tela inicial'
Capture '24-paired-resume-with-cart'
Tap-Label 'Toque para continuar'
Assert-Text '7,00'
Capture '25-paired-cart-after-context'
Tap-Label 'Identificar pedido'
Capture '26-paired-optional-name'
Assert-Text '(opcional)'
Tap-Label 'Escolher pagamento'
Tap-Label 'Cartão'
Assert-Radio 'Cartão'
Capture '27-paired-card-selected'
Tap-Label 'Pix'
Assert-Radio 'Pix'
Capture '28-paired-pix-selected'
$ui = Read-Ui
$pay = $ui.SelectNodes('//node[@class="android.widget.Button"]') | Where-Object { $_.'content-desc' -eq 'Pagar' -or $_.SelectNodes('.//node[@text="Pagar"]').Count -gt 0 } | Select-Object -First 1
if (!$pay -or $pay.enabled -ne 'false') { throw 'Payment must remain disabled without a backend integration' }
Assert-Text 'Pagamento indisponível'
& $Adb -s $Serial shell input keyevent 4
Start-Sleep -Milliseconds 450
& $Adb -s $Serial shell input keyevent 4
Start-Sleep -Milliseconds 450
Tap-Label 'Remover Coca-Cola'
Tap-Label 'Remover item'
& $Adb -s $Serial shell input tap 950 227
Assert-Text 'Seu pedido está vazio'
@{ result='PASS'; checkedAt=(Get-Date).ToUniversalTime().ToString('o'); modalWaitSeconds=$(if ($CheckIdle) { 62 } else { 0 }); optionalNameAccepted=$true; cardSelected=$true; pixSelected=$true; paymentDisabledWithoutIntegration=$true; testCartCleared=$true } | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'paired-context-result.json')
Write-Output "Paired context, optional identification and payment choices passed: $Output"
