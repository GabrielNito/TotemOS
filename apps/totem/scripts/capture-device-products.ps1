param([string]$Output = "$env:TEMP\totemos-visual-audit\native")
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly

function Reveal-Product([string]$Name) {
  for ($attempt = 0; $attempt -lt 9; $attempt++) {
    $xml = Read-Ui
    $node = $xml.SelectNodes('//node[@clickable="true"]') | Where-Object { $_.'content-desc' -eq "Personalizar $Name" } | Select-Object -First 1
    if ($node) {
      $bounds = [regex]::Match($node.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
      if ([int]$bounds.Groups[2].Value -ge 200 -and [int]$bounds.Groups[4].Value -le 1950) { return }
    }
    & $Adb -s $Serial shell input swipe 540 1650 540 950 350
    Start-Sleep -Milliseconds 350
  }
  throw "Product not revealed above dock: $Name"
}

$ui = Read-Ui
if ($ui.OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
Tap-Label 'brioche, início'
Tap-Label 'Lanches'
$cases = @(
  @{ name = 'Smash Clássico'; category = 'Lanches'; file = '39-smash-product' },
  @{ name = 'Chicken Crispy'; category = 'Lanches'; file = '40-chicken-product' },
  @{ name = 'Double Cheddar'; category = 'Lanches'; file = '41-double-product' },
  @{ name = 'Combo Smash'; category = 'Combos'; file = '42-combo-smash-product' },
  @{ name = 'Combo Chicken'; category = 'Combos'; file = '43-combo-chicken-product' },
  @{ name = 'Batata Rústica'; category = 'Porções'; file = '45-potato-product' },
  @{ name = 'Onion Rings'; category = 'Porções'; file = '46-onion-product' }
)
$category = 'Lanches'
foreach ($case in $cases) {
  if ($category -ne $case.category) { Tap-Label $case.category; $category = $case.category }
  # Return the filtered list to its beginning before comparing a category.
  & $Adb -s $Serial shell input swipe 540 550 540 1800 350
  Start-Sleep -Milliseconds 350
  if ($case.file -eq '45-potato-product') { Capture '44-portions' }
  Reveal-Product $case.name
  Tap-Label "Personalizar $($case.name)"
  Capture $case.file
  & $Adb -s $Serial shell input keyevent 4
  Start-Sleep -Milliseconds 650
}
Write-Output "Remaining product audit passed: $Output"
