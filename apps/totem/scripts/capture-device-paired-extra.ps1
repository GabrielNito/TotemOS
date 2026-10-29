param(
  [Parameter(Mandatory = $true)][string]$NegocioId,
  [decimal]$ExpectedBaseTotal = 101.7,
  [string]$ApiUrl = 'http://127.0.0.1:3001',
  [string]$Output = "$env:TEMP\totemos-visual-audit\native-paired"
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Assert-Text([string]$Expected) {
  if ((Read-Ui).OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}
function Assert-Amount([decimal]$Expected) { Assert-Text ($Expected.ToString('N2', [Globalization.CultureInfo]::GetCultureInfo('pt-BR'))) }
$catalog = Invoke-RestMethod -Uri "$ApiUrl/catalogo/publico/$NegocioId"
$drink = @($catalog | ForEach-Object { $_.produtos }) | Where-Object nome -eq 'Coca-Cola' | Select-Object -First 1
if (!$drink) { throw 'Paired beverage is unavailable' }
$mixedTotal = $ExpectedBaseTotal + [decimal]$drink.precoBase
& $Adb -s $Serial shell am force-stop com.totemos.totem
& $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
Start-Sleep -Seconds 5
Capture '10-paired-resume-standby'
Tap-Label 'Toque para continuar'
Assert-Amount $ExpectedBaseTotal
Tap-Label 'Ver pedido'
Tap-Label 'Voltar ao cardápio'
$ui = Read-Ui
$tab = $ui.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq 'Todos' } | Select-Object -First 1
if (!$tab) { throw 'Category rail is not visible' }
$bounds = [regex]::Match($tab.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
$railY = [int](([int]$bounds.Groups[2].Value + [int]$bounds.Groups[4].Value) / 2)
& $Adb -s $Serial shell input swipe 950 $railY 180 $railY 400
Tap-Label 'Bebidas'
$ui = Read-Ui
$card = $ui.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq 'Personalizar Coca-Cola' } | Select-Object -First 1
if (!$card) { throw 'Beverage card is not visible' }
$cardBounds = [regex]::Match($card.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
$cardHeight = [int]$cardBounds.Groups[4].Value - [int]$cardBounds.Groups[2].Value
if ($cardHeight -gt 563) { throw "Beverage card exceeds 200 dp on the A54: $cardHeight pixels" }
Capture '11-paired-beverages'
Tap-Label 'Personalizar Coca-Cola'
Capture '12-paired-drink-product'

$recording = $null
$recordPid = ''
try {
  if (& $Adb -s $Serial shell pidof screenrecord) { throw 'Another recording is active' }
  $recording = Start-Process -FilePath $Adb -ArgumentList @('-s', $Serial, 'shell', 'screenrecord', '--time-limit', '175', '--bit-rate', '4000000', '/sdcard/totemos-paired-cart.mp4') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $Output 'paired-recording.log')
  Start-Sleep -Milliseconds 700
  $recordPid = (& $Adb -s $Serial shell pidof screenrecord).Trim()
  if ($recordPid -notmatch '^\d+$') { throw 'Could not identify the recording process' }
  Tap-Label 'Adicionar ao pedido'
  & $Adb -s $Serial shell input tap 950 227
  Tap-Label 'Ver pedido'
  Assert-Amount $mixedTotal
  Capture '13-paired-mixed-cart'
  Tap-Label 'Remover Coca-Cola'
  Capture '14-paired-removal-dialog'
  Tap-Label 'Remover item'
  & $Adb -s $Serial shell input tap 310 370
  Start-Sleep -Milliseconds 650
  Assert-Amount $mixedTotal
  Capture '15-paired-after-undo'
  Tap-Label 'Remover Coca-Cola'
  Tap-Label 'Remover item'
  & $Adb -s $Serial shell input tap 950 227
  Assert-Amount $ExpectedBaseTotal
  Capture '16-paired-after-removal'
  # These lines were created by the paired UI audit, which required an empty cart.
  Tap-Label 'Remover Bacon Melt'
  Tap-Label 'Remover item'
  & $Adb -s $Serial shell input tap 950 227
  Assert-Text 'Seu pedido está vazio'
  Capture '17-paired-empty-cart'
  & $Adb -s $Serial shell am force-stop com.totemos.totem
  & $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
  Start-Sleep -Seconds 5
  Capture '18-paired-welcome'
  @{ result='PASS'; negocioId=$NegocioId; checkedAt=(Get-Date).ToUniversalTime().ToString('o'); mixedTotal=$mixedTotal; restoredAfterUndo=$mixedTotal; totalAfterRemoval=$ExpectedBaseTotal; beverageCardHeightPixels=$cardHeight; testCartCleared=$true } | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'paired-extra-result.json')
  Write-Output "Paired mixed-cart, undo and cleanup audit passed: $Output"
} finally {
  if ($recording) {
    $processName = if ($recordPid -match '^\d+$') { (& $Adb -s $Serial shell ps -p $recordPid -o NAME) -join ' ' } else { '' }
    if ($processName -match 'screenrecord') { & $Adb -s $Serial shell kill -2 $recordPid }
    [void]$recording.WaitForExit(5000)
    & $Adb -s $Serial pull /sdcard/totemos-paired-cart.mp4 (Join-Path $Output 'paired-cart-motion.mp4')
  }
}
