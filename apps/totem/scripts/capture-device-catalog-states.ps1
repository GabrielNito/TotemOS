param(
  [string]$Output = "$env:TEMP\totemos-catalog-card\states",
  [string]$ControlFile = "$env:TEMP\totemos-catalog-card\control.json",
  [string]$NegocioId,
  [string]$ApiUrl = 'http://127.0.0.1:3001'
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Set-Scenario([string]$Mode) {
  @{mode=$Mode} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $ControlFile
}
function Assert-Text([string]$Expected) {
  if ((Read-Ui).OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}
function Restart-Catalog {
  & $Adb -s $Serial shell am force-stop com.totemos.totem
  & $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
  Start-Sleep -Seconds 3
}
function Resume-Catalog {
  if ((Read-Ui).OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
  Assert-Text 'Personalizar Bacon Melt'
}
$result = [ordered]@{negocioId=$NegocioId;actualOrdersCreated=0;paymentsStarted=0;catalogMutations=0;scenarios=@()}
try {
  Set-Scenario 'loading'
  Restart-Catalog
  Assert-Text 'Carregando o cardápio'
  Capture '01-loading'
  Set-Scenario 'empty'
  Start-Sleep -Seconds 1
  Assert-Text 'ainda não tem produtos disponíveis'
  Capture '02-empty'
  Set-Scenario 'passthrough'
  Tap-Label 'Tentar novamente'
  Resume-Catalog
  Capture '03-empty-recovered'
  $result.scenarios += 'loading/empty/retry: PASS'

  foreach ($scenario in @('http-error','network-error','invalid')) {
    Set-Scenario $scenario
    Restart-Catalog
    Assert-Text 'Não foi possível carregar o catálogo'
    Capture "04-$scenario"
    Set-Scenario 'passthrough'
    Tap-Label 'Tentar novamente'
    Resume-Catalog
    Capture "05-$scenario-recovered"
    $result.scenarios += "${scenario}/retry: PASS"
  }

  Set-Scenario 'availability'
  Restart-Catalog
  Resume-Catalog
  if ((Read-Ui).OuterXml -match 'Categoria inativa auditoria|Produto indisponível auditoria') { throw 'Unavailable catalog content was displayed' }
  Capture '06-availability-filtered'
  Tap-Label 'Personalizar Bacon Melt'
  $initialUi = Read-Ui
  $add = $initialUi.SelectNodes('//node') | Where-Object { $_.'content-desc' -eq 'Adicionar ao pedido' } | Select-Object -First 1
  if (!$add -or $add.enabled -ne 'false') { throw 'Adding a product without choosing its variation must be blocked' }
  if ($initialUi.OuterXml -match 'Opção esgotada auditoria|Adicional esgotado auditoria') { throw 'Unavailable configuration was displayed' }
  $catalog = Invoke-RestMethod -Uri "$ApiUrl/catalogo/publico/$NegocioId"
  $product = $catalog.produtos | Where-Object nome -eq 'Bacon Melt' | Select-Object -First 1
  $variation = $product.variacoes | Where-Object nome -eq 'Duplo' | Select-Object -First 1
  $extra = $product.adicionais | Where-Object { !$_.esgotado -and $_.maximo -le 5 } | Select-Object -First 1
  if (!$variation -or !$extra) { throw 'Expected real catalog configuration is missing' }
  Tap-Label 'Duplo'
  Tap-Label 'Adicionais'
  for ($count=0; $count -lt [int]$extra.maximo; $count++) { Tap-Label "Aumentar $($extra.nome)" }
  $limitUi = Read-Ui
  $increase = $limitUi.SelectNodes('//node') | Where-Object { $_.'content-desc' -eq "Aumentar $($extra.nome)" } | Select-Object -First 1
  if (!$increase -or $increase.enabled -ne 'false') { throw 'Additional maximum did not disable the increment' }
  $expected = [decimal]$variation.preco + [decimal]$extra.preco * [decimal]$extra.maximo
  Assert-Text ($expected.ToString('N2', [Globalization.CultureInfo]::GetCultureInfo('pt-BR')))
  Capture '07-real-additional-maximum'
  $result.scenarios += 'availability/required variation/real additional maximum: PASS'
  $result.additionalMaximum = $extra.maximo
  $result.configuredUnitPrice = $expected
  $result.result = 'PASS'
  $result.checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  $result | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'result.json')
  Write-Output 'Connected catalog device scenarios passed'
} finally { Set-Scenario 'passthrough' }
