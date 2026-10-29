import { useState } from "react";
import { Pressable, View } from "react-native";
import { ProductShell } from "../kiosk/product-shell";
import { styles } from "../kiosk/product-styles";
import { MotionSelection } from "../kiosk/motion";
import { KioskText, Quantity, Section } from "../kiosk/ui";
import {
  createInitialSelection,
  formatCurrency,
  getSelectionSummary,
  selectVariation,
  updateAdditionalQuantity,
  type CartLine,
  type ProductSelection,
} from "./model";
import type { BusinessMenuProduct } from "./menu-model";

type Props = {
  product: BusinessMenuProduct;
  initialLine?: CartLine;
  onBack: () => void;
  onSave: (selection: ProductSelection, quantity: number) => void;
};

export function BusinessProductScreen(props: Props) {
  return (
    <BusinessProduct
      key={`${props.product.id}:${props.initialLine?.key ?? "new"}`}
      {...props}
    />
  );
}

function BusinessProduct({ product, initialLine, onBack, onSave }: Props) {
  const raw = product.raw;
  const [selection, setSelection] = useState<ProductSelection>(() => {
    const initial = initialLine?.selection ?? createInitialSelection(raw);
    return { ...initial, adicionais: { ...initial.adicionais } };
  });
  const [quantity, setQuantity] = useState(initialLine?.quantidade ?? 1);
  const [variationOpen, setVariationOpen] = useState(true);
  const [additionalOpen, setAdditionalOpen] = useState(!raw.variacoes.length);
  const summary = getSelectionSummary(raw, selection);
  const needsVariation = raw.variacoes.length > 0 && !summary.variacao;
  const custom = raw.variacoes.length > 0 || raw.adicionais.length > 0;
  return (
    <ProductShell
      product={product}
      editing={!!initialLine}
      heading={
        initialLine
          ? "Editar item"
          : custom
            ? "Personalize seu pedido"
            : "Adicionar ao pedido"
      }
      lead={
        custom
          ? "Escolha uma opção e ajuste os adicionais."
          : "Confira a quantidade e adicione ao seu pedido."
      }
      total={(Math.round(summary.total * 100) * quantity) / 100}
      quantity={quantity}
      onQuantity={setQuantity}
      disabled={needsVariation}
      dockDescription={
        needsVariation
          ? "Escolha uma opção do produto"
          : `${quantity} ${quantity === 1 ? "unidade" : "unidades"} · total deste item`
      }
      onBack={onBack}
      onSave={() => {
        if (!needsVariation)
          onSave(
            { ...selection, adicionais: { ...selection.adicionais } },
            quantity,
          );
      }}
    >
      {raw.variacoes.length > 0 && (
        <Section
          id="variation"
          title="Opções do produto"
          summary={summary.variacao?.nome ?? "Escolha uma opção"}
          open={variationOpen}
          onToggle={() => setVariationOpen((current) => !current)}
        >
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Opções do produto"
            style={styles.radioOptions}
          >
            {raw.variacoes.map((variation) => {
              const checked = variation.id === selection.variacaoId;
              const delta =
                Math.round((variation.preco - raw.precoBase) * 100) / 100;
              return (
                <Pressable
                  key={variation.id}
                  accessibilityRole="radio"
                  accessibilityLabel={variation.nome}
                  accessibilityState={{ checked }}
                  onPress={() => {
                    setSelection((current) =>
                      selectVariation(raw, current, variation.id),
                    );
                    setVariationOpen(false);
                  }}
                >
                  <View
                    style={[
                      styles.radioOption,
                      checked && styles.selectedOption,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioMark,
                        checked && styles.selectedRadio,
                      ]}
                    >
                      {checked && (
                        <MotionSelection>
                          <View style={styles.radioDot} />
                        </MotionSelection>
                      )}
                    </View>
                    <View style={styles.optionCopy}>
                      <KioskText style={styles.optionName}>
                        {variation.nome}
                      </KioskText>
                    </View>
                    <KioskText style={styles.optionPrice}>
                      {delta === 0
                        ? "Incluído"
                        : `${delta > 0 ? "+" : "−"} ${formatCurrency(Math.abs(delta))}`}
                    </KioskText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>
      )}
      {raw.adicionais.length > 0 && (
        <Section
          id="additional"
          title="Adicionais"
          optional
          summary={
            summary.adicionais
              .map((item) => `${item.nome} ×${item.quantidade}`)
              .join(" · ") || "Nenhum adicional selecionado"
          }
          open={additionalOpen}
          onToggle={() => setAdditionalOpen((current) => !current)}
        >
          {raw.adicionais.map((additional, index) => (
            <View
              key={additional.id}
              style={[styles.extraRow, index > 0 && styles.extraDivider]}
            >
              <View style={{ flex: 1 }}>
                <KioskText style={styles.optionName}>
                  {additional.nome}
                </KioskText>
                <KioskText style={styles.optionSubtitle}>
                  + {formatCurrency(additional.preco)}
                </KioskText>
              </View>
              <Quantity
                min={0}
                max={additional.maximo}
                name={additional.nome}
                value={selection.adicionais[additional.id] ?? 0}
                onChange={(value) =>
                  setSelection((current) =>
                    updateAdditionalQuantity(
                      raw,
                      current,
                      additional.id,
                      value - (current.adicionais[additional.id] ?? 0),
                    ),
                  )
                }
              />
            </View>
          ))}
        </Section>
      )}
      {!custom && (
        <View style={styles.simpleProduct}>
          <KioskText style={styles.simpleDescription}>
            Ajuste a quantidade no rodapé e adicione ao pedido.
          </KioskText>
        </View>
      )}
    </ProductShell>
  );
}
