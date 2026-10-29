param(
  [string]$Output = "$env:TEMP\totemos-visual-audit\native",
  [switch]$RecordVideo
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Assert-Text([string]$Expected) {
  $xml = Read-Ui
  if ($xml.OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}

Tap-Label 'Toque para'
Tap-Label 'QR Code'
Tap-Label 'Retirar no balcão'
$ui = Read-Ui
$tab = $ui.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq 'Bebidas' } | Select-Object -First 1
if (!$tab) { throw 'Selected beverage category is not visible' }
$bounds = [regex]::Match($tab.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
$railY = [int](([int]$bounds.Groups[2].Value + [int]$bounds.Groups[4].Value) / 2)
& $Adb -s $Serial shell input swipe 180 $railY 950 $railY 400
Tap-Label 'Todos'
Tap-Label 'Personalizar Bacon Melt'
Tap-Label 'Duplo'

$recording = $null
$recordPid = ''
try {
  if ($RecordVideo) {
    $existing = & $Adb -s $Serial shell pidof screenrecord
    if ($existing) { throw 'Another device screenrecord process is active' }
    $recording = Start-Process -FilePath $Adb -ArgumentList @('-s', $Serial, 'shell', 'screenrecord', '--time-limit', '175', '--bit-rate', '4000000', '/sdcard/totemos-customization.mp4') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $Output 'motion-recording.log')
    Start-Sleep -Milliseconds 700
    $recordPid = (& $Adb -s $Serial shell pidof screenrecord).Trim()
    if ($recordPid -notmatch '^\d+$') { throw 'Could not identify the audit recording process' }
  }

  Tap-Label 'Retirar ingredientes'
  Capture '25-remove-open'
  Tap-Label 'Bacon'
  Capture '26-remove-selected'
  Tap-Label 'Retirar ingredientes'
  Tap-Label 'Adicionais'
  Capture '27-extras-open'
  Tap-Label 'Aumentar Bacon extra'
  Tap-Label 'Aumentar Bacon extra'
  Capture '28-extras-selected'
  Tap-Label 'Adicionais'
  Tap-Label 'Bebida e acompanhamento'
  Capture '29-pairing-open'
  Tap-Label 'Coca-Cola'
  Tap-Label 'Batata Rústica'
  Capture '30-pairing-selected'
  Tap-Label 'Adicionar ao pedido'
  # Close the fresh notice within its six-second window, before an idle dump.
  & $Adb -s $Serial shell input tap 950 227
  Tap-Label 'Ver pedido'
  Assert-Text '69,70'
  Assert-Text 'Sem bacon'
  Capture '31-custom-cart'
  Tap-Label 'Editar Bacon Melt'
  Capture '32-edit-product'
  # Reveal the third size option above the fixed product dock.
  & $Adb -s $Serial shell input swipe 535 1600 535 900 450
  Start-Sleep -Milliseconds 450
  Tap-Label 'Triplo'
  Tap-Label 'Salvar alterações'
  & $Adb -s $Serial shell input tap 950 227
  Assert-Text '79,70'
  Capture '33-edited-cart'
  Tap-Label 'Aumentar Bacon Melt'
  Assert-Text '159,40'
  Capture '34-quantity-cart'
  Write-Output "Customization A54 audit passed: $Output"
} finally {
  if ($recording) {
    $processName = if ($recordPid -match '^\d+$') { (& $Adb -s $Serial shell ps -p $recordPid -o NAME) -join ' ' } else { '' }
    if ($processName -match 'screenrecord') { & $Adb -s $Serial shell kill -2 $recordPid }
    [void]$recording.WaitForExit(5000)
    & $Adb -s $Serial pull /sdcard/totemos-customization.mp4 (Join-Path $Output 'customization-motion.mp4')
  }
}
