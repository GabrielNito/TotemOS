param(
  [Parameter(Mandatory = $true)][string]$NegocioId,
  [string]$ApiUrl = 'http://127.0.0.1:3001',
  [string]$Output = "$env:TEMP\totemos-visual-audit\native-paired"
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\capture-device.ps1" -Output $Output -DefinitionsOnly
function Assert-Text([string]$Expected) {
  if ((Read-Ui).OuterXml -notmatch [regex]::Escape($Expected)) { throw "Missing expected text: $Expected" }
}
function Assert-Amount([decimal]$Expected) {
  Assert-Text ($Expected.ToString('N2', [Globalization.CultureInfo]::GetCultureInfo('pt-BR')))
}
function Continue-Order {
  if ((Read-Ui).OuterXml -match 'Toque para') { Tap-Label 'Toque para' }
}
$catalog = Invoke-RestMethod -Uri "$ApiUrl/catalogo/publico/$NegocioId"
$products = @($catalog | ForEach-Object { $_.produtos })
$product = $products | Where-Object nome -eq 'Bacon Melt' | Select-Object -First 1
$double = $product.variacoes | Where-Object nome -eq 'Duplo' | Select-Object -First 1
$simple = $product.variacoes | Where-Object nome -eq 'Simples' | Select-Object -First 1
$extra = $product.adicionais | Where-Object { $_.maximo -ge 1 -and !$_.esgotado } | Select-Object -First 1
if (!$product -or !$double -or !$simple -or !$extra) { throw 'Required paired test catalog configuration is unavailable' }
$initialUnit = [decimal]$double.preco + [decimal]$extra.preco
$editedUnit = [decimal]$simple.preco + [decimal]$extra.preco

& $Adb -s $Serial shell am force-stop com.totemos.totem
& $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
Start-Sleep -Seconds 5
Capture '01-paired-entry'
Continue-Order
Assert-Text 'Seu pedido está vazio'
Capture '02-paired-catalog'
Tap-Label 'Personalizar Bacon Melt'
Capture '03-paired-product'
Tap-Label 'Duplo'
Tap-Label 'Adicionais'
Tap-Label "Aumentar $($extra.nome)"
Tap-Label 'Aumentar Bacon Melt'
Assert-Amount ($initialUnit * 2)
Capture '04-paired-configured'
Tap-Label 'Adicionar ao pedido'
& $Adb -s $Serial shell input tap 950 227
Tap-Label 'Ver pedido'
Assert-Amount ($initialUnit * 2)
Capture '05-paired-cart'
Tap-Label 'Editar Bacon Melt'
Tap-Label 'Simples'
Tap-Label 'Salvar alterações'
& $Adb -s $Serial shell input tap 950 227
Assert-Amount ($editedUnit * 2)
Capture '06-paired-edited-cart'
Tap-Label 'Aumentar Bacon Melt'
Assert-Amount ($editedUnit * 3)
Tap-Label 'Identificar pedido'
Capture '07-paired-identification'
$ui = Read-Ui
if ($ui.OuterXml -match 'Seu nome ou apelido') {
  Tap-Label 'Seu nome ou apelido'
  & $Adb -s $Serial shell input text Nito
  Hide-Keyboard
}
Tap-Label 'Escolher pagamento'
Capture '08-paired-payment'
Assert-Text 'Pagamento indisponível'
Assert-Amount ($editedUnit * 3)

& $Adb -s $Serial shell am force-stop com.totemos.totem
& $Adb -s $Serial shell am start -a android.intent.action.VIEW -d totem://catalogo com.totemos.totem | Out-Null
Start-Sleep -Seconds 5
Continue-Order
Tap-Label 'Ver pedido'
Assert-Amount ($editedUnit * 3)
Capture '09-paired-restored-cart'
@{
  result = 'PASS'; negocioId = $NegocioId; checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  productId = $product.id; additionalId = $extra.id; configuredTotal = ($initialUnit * 2)
  editedTotal = ($editedUnit * 2); restoredTotal = ($editedUnit * 3)
  actualOrdersCreated = 0; paymentsStarted = 0; paymentIntegrationAvailable = $false
} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $Output 'paired-result.json')
Write-Output "Paired A54 catalog, editing and persistence audit passed: $Output"
