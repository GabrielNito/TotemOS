param([string]$Output = "$env:TEMP\totemos-visual-audit\native")
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
$timings = [ordered]@{ startedAt = (Get-Date).ToUniversalTime().ToString('o'); dialogWaitSeconds = 62; standbyWaitSeconds = 62 }
if ((Read-Ui).OuterXml -match 'Toque para continuar') { Tap-Label 'Toque para continuar' }
Tap-Label 'Remover Bacon Melt'
if ((Read-Ui).OuterXml -notmatch 'Manter item') { throw 'Removal dialog did not open before the idle test' }
Start-Sleep -Seconds 31
Start-Sleep -Seconds 31
Capture '35-removal-after-idle'
$timings.dialogCheckedAt = (Get-Date).ToUniversalTime().ToString('o')
Tap-Label 'Manter item'
$ui = Read-Ui
if ($ui.OuterXml -match 'Toque para continuar') { throw 'Standby interrupted the removal dialog' }
if ($ui.OuterXml -notmatch '159,40') { throw 'Order changed while the removal dialog was open' }
Capture '36-cart-after-dialog'
Start-Sleep -Seconds 31
Start-Sleep -Seconds 31
Capture '37-idle-standby'
$ui = Read-Ui
if ($ui.OuterXml -notmatch 'Toque para continuar') { throw 'Expected standby after sixty idle seconds' }
$timings.standbyCheckedAt = (Get-Date).ToUniversalTime().ToString('o')
Tap-Label 'Toque para continuar'
$ui = Read-Ui
if ($ui.OuterXml -notmatch '159,40') { throw 'Order was lost after resuming from standby' }
Capture '38-resumed-cart'
$timings.result = 'PASS'
$timings | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'idle-timings.json')
Write-Output "Idle A54 audit passed: $Output"
