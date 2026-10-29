param(
  [string]$Adb = (Get-Command adb -ErrorAction Stop).Source,
  [string]$Serial = $env:ANDROID_SERIAL,
  [string]$Output = "$env:TEMP\totemos-visual-audit\native",
  [switch]$LaunchFromIcon,
  [switch]$DefinitionsOnly
)
$ErrorActionPreference = 'Stop'
if (!$Serial) {
  $connected = @(& $Adb devices | ForEach-Object { if ($_.Trim() -match '^(\S+)\s+device$') { $Matches[1] } })
  if ($connected.Count -ne 1) { throw 'Specify -Serial or ANDROID_SERIAL when there is not exactly one authorized device.' }
  $Serial = $connected[0]
}
New-Item -ItemType Directory -Force $Output | Out-Null
function Read-Ui {
  & $Adb -s $Serial shell uiautomator dump /sdcard/visual-audit.xml | Out-Null
  if ($LASTEXITCODE) { throw "Could not inspect the A54 UI. Verify that device $Serial is connected and authorized." }
  [xml]$xml = & $Adb -s $Serial shell cat /sdcard/visual-audit.xml
  if ($LASTEXITCODE -or !$xml) { throw "Could not read the A54 UI hierarchy for device $Serial." }
  return $xml
}
function Tap-Label([string]$Label) {
  $xml = Read-Ui
  $node = $xml.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -like "$Label*" -or $_.text -eq $Label } | Select-Object -First 1
  if (!$node) { throw "Control not visible: $Label" }
  $bounds = [regex]::Match($node.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
  $tapX = [int](($bounds.Groups[1].Value -as [int]) + ($bounds.Groups[3].Value -as [int])) / 2
  $tapY = [int](($bounds.Groups[2].Value -as [int]) + ($bounds.Groups[4].Value -as [int])) / 2
  & $Adb -s $Serial shell input tap ([int]$tapX) ([int]$tapY)
  Start-Sleep -Milliseconds 650
}
function Capture([string]$Name) {
  $xml = Read-Ui
  & $Adb -s $Serial shell screencap -p /sdcard/visual-audit.png
  & $Adb -s $Serial pull /sdcard/visual-audit.png (Join-Path $Output "$Name.png") | Out-Null
  $xml.Save((Join-Path $Output "$Name.xml"))
}
function Hide-Keyboard {
  $ime = (& $Adb -s $Serial shell dumpsys input_method) -join "`n"
  if ($ime -match 'mInputShown=true') {
    & $Adb -s $Serial shell input keyevent 4
    Start-Sleep -Milliseconds 300
  }
}
if ($DefinitionsOnly) { return }

& $Adb -s $Serial shell am force-stop com.totemos.totem
if ($LaunchFromIcon) {
  & $Adb -s $Serial shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.totemos.totem/.MainActivity | Out-Null
} else {
  & $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
}
Start-Sleep -Seconds 3
Capture '01-standby'
Tap-Label 'Toque para começar o pedido'
Capture '02-catalog'
Tap-Label 'Personalizar Bacon Melt'
Capture '03-product'
Tap-Label 'Duplo'
Capture '04-product-selected'
Tap-Label 'Adicionar ao pedido'
Tap-Label 'Ver pedido'
Capture '05-cart'
Tap-Label 'Identificar pedido'
Capture '06-identification'
Tap-Label 'Seu nome ou apelido'
& $Adb -s $Serial shell input text Nito
Hide-Keyboard
Tap-Label 'Escolher pagamento'
Capture '07-payment'
$paymentUi = Read-Ui
if ($paymentUi.OuterXml -notmatch 'simula|Simular') { throw 'Expected explicitly simulated payment screen' }
Tap-Label 'Cartão'
Tap-Label 'Simular pagamento'
Capture '08-confirmation'
Write-Output "Native audit captures saved to $Output"
