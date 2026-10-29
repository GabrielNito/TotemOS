import { ProductShell } from "./product-shell";
import { styles } from "./product-styles";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Check } from "lucide-react-native";

import { MotionSelection } from "./motion";
import {
  extras,
  findProduct,
  initialConfiguration,
  money,
  pattyPrice,
  unitPrice,
  type Configuration,
  type Line,
  type Product,
} from "./reference-model";
import { KioskText, Quantity, Section, colors } from "./ui";

type ProductScreenProps = {
  product: Product;
  initialLine?: Line;
  onBack: () => void;
  onSave: (configuration: Configuration, quantity: number) => void;
};

type SectionId = "size" | "remove" | "extras" | "pairing";

const selectedMark = FadeIn.duration(200).reduceMotion(ReduceMotion.System);
const pairings = [
  {
    key: "drink",
    product: findProduct("coca"),
    detail: "Lata de 350 ml",
    image: require("../../assets/products/featured-6.png"),
  },
  {
    key: "side",
    product: findProduct("potato"),
    detail: "Porção individual",
    image: require("../../assets/products/product-5.png"),
  },
] as const;

function Checkbox({
  checked,
  pairing = false,
}: {
  checked: boolean;
  pairing?: boolean;
}) {
  return (
    <View
      style={[
        styles.checkbox,
        pairing && styles.pairingCheckbox,
        checked && styles.checked,
      ]}
    >
      {checked && (
        <Animated.View entering={selectedMark}>
          <Check size={16} strokeWidth={2} color={colors.paper} />
        </Animated.View>
      )}
    </View>
  );
}

export function ProductScreen(props: ProductScreenProps) {
  return (
    <ProductConfiguration
      key={`${props.product.id}:${props.initialLine?.key ?? "new"}`}
      {...props}
    />
  );
}

function ProductConfiguration({
  product,
  initialLine,
  onBack,
  onSave,
}: ProductScreenProps) {
  const [configuration, setConfiguration] = useState<Configuration>(() => {
    const initial = initialLine?.configuration ?? initialConfiguration(product);
    return {
      ...initial,
      removed: [...initial.removed],
      extras: { ...initial.extras },
    };
  });
  const [quantity, setQuantity] = useState(initialLine?.quantity ?? 1);
  const [sizeSelected, setSizeSelected] = useState(!!initialLine);
  const [open, setOpen] = useState<Partial<Record<SectionId, boolean>>>({
    size: !!product.patties,
    extras: !product.patties && product.ingredients.length > 0,
  });
  const needsSize = !!product.patties && !sizeSelected;
  const total = unitPrice(product, configuration) * quantity;

  function toggleSection(id: SectionId) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleIngredient(ingredient: string) {
    setConfiguration((current) => ({
      ...current,
      removed: current.removed.includes(ingredient)
        ? current.removed.filter((value) => value !== ingredient)
        : [...current.removed, ingredient],
    }));
  }

  function save() {
    if (needsSize) return;
    onSave(
      {
        ...configuration,
        removed: [...configuration.removed],
        extras: { ...configuration.extras },
      },
      quantity,
    );
  }

  return (
    <ProductShell
      product={product}
      editing={!!initialLine}
      heading={
        initialLine
          ? "Editar item"
          : product.ingredients.length
            ? "Personalize seu lanche"
            : "Adicionar ao pedido"
      }
      lead={
        product.ingredients.length
          ? product.patties
            ? "Escolha o tamanho e ajuste os ingredientes."
            : "Retire ingredientes ou inclua adicionais."
          : "Confira a quantidade e adicione ao seu pedido."
      }
      total={total / 100}
      quantity={quantity}
      onQuantity={setQuantity}
      disabled={needsSize}
      dockDescription={
        needsSize
          ? "Escolha o tamanho do lanche"
          : `${quantity} ${quantity === 1 ? "unidade" : "unidades"} \u00b7 total deste item`
      }
      onBack={onBack}
      onSave={save}
    >
      <>
        {!!product.patties && (
          <Section
            id="size"
            title="Quantidade de carnes"
            summary={
              sizeSelected
                ? `${configuration.patties} ${configuration.patties === 1 ? "carne" : "carnes"} de 120 g`
                : "Escolha o tamanho do lanche"
            }
            open={!!open.size}
            onToggle={() => toggleSection("size")}
          >
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Quantidade de carnes"
              style={styles.radioOptions}
            >
              {[1, 2, 3]
                .filter((count) => count >= (product.patties ?? 0))
                .map((count) => {
                  const selected =
                    sizeSelected && configuration.patties === count;
                  return (
                    <Pressable
                      key={count}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        setConfiguration((current) => ({
                          ...current,
                          patties: count,
                        }));
                        setSizeSelected(true);
                        setOpen((current) => ({
                          ...current,
                          size: false,
                        }));
                      }}
                    >
                      <View
                        style={[
                          styles.radioOption,
                          selected && styles.selectedOption,
                        ]}
                      >
                        <View
                          style={[
                            styles.radioMark,
                            selected && styles.selectedRadio,
                          ]}
                        >
                          {selected && (
                            <MotionSelection>
                              <View style={styles.radioDot} />
                            </MotionSelection>
                          )}
                        </View>
                        <View style={styles.optionCopy}>
                          <KioskText style={styles.optionName}>
                            {["", "Simples", "Duplo", "Triplo"][count]}
                          </KioskText>
                          <KioskText style={styles.optionSubtitle}>
                            {count} {count === 1 ? "carne" : "carnes"} de 120 g
                          </KioskText>
                        </View>
                        <KioskText style={styles.optionPrice}>
                          {count === product.patties
                            ? "Incluído"
                            : `+ ${money(pattyPrice(product, count))}`}
                        </KioskText>
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          </Section>
        )}

        {!!product.ingredients.length && (
          <>
            <Section
              id="remove"
              title="Retirar ingredientes"
              summary={
                configuration.removed
                  .map((ingredient) => `Sem ${ingredient.toLowerCase()}`)
                  .join(" · ") || "Com todos os ingredientes"
              }
              optional
              open={!!open.remove}
              onToggle={() => toggleSection("remove")}
            >
              <KioskText style={styles.optionHint}>
                Marque o que você prefere deixar de fora.
              </KioskText>
              {product.ingredients.map((ingredient) => {
                const checked = configuration.removed.includes(ingredient);
                return (
                  <Pressable
                    key={ingredient}
                    accessibilityRole="checkbox"
                    accessibilityLabel={ingredient}
                    accessibilityState={{ checked }}
                    onPress={() => toggleIngredient(ingredient)}
                  >
                    <View style={styles.removeRow}>
                      <Checkbox checked={checked} />
                      <KioskText style={styles.ingredient}>
                        {ingredient}
                      </KioskText>
                      {checked && (
                        <KioskText style={styles.removedHint}>
                          Sem este ingrediente
                        </KioskText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </Section>

            <Section
              id="extras"
              title="Adicionais"
              summary={
                extras
                  .filter((extra) => configuration.extras[extra.id])
                  .map(
                    (extra) =>
                      `${extra.name} ×${configuration.extras[extra.id]}`,
                  )
                  .join(" · ") || "Nenhum adicional selecionado"
              }
              optional
              open={!!open.extras}
              onToggle={() => toggleSection("extras")}
            >
              {extras.map((extra, index) => (
                <View
                  key={extra.id}
                  style={[styles.extraRow, index > 0 && styles.extraDivider]}
                >
                  <View style={styles.optionCopy}>
                    <KioskText style={styles.optionName}>
                      {extra.name}
                    </KioskText>
                    <KioskText style={styles.optionSubtitle}>
                      + {money(extra.price)}
                    </KioskText>
                  </View>
                  <Quantity
                    name={extra.name}
                    value={configuration.extras[extra.id] ?? 0}
                    min={0}
                    max={9}
                    onChange={(value) =>
                      setConfiguration((current) => ({
                        ...current,
                        extras: { ...current.extras, [extra.id]: value },
                      }))
                    }
                  />
                </View>
              ))}
            </Section>

            {!product.combo && (
              <Section
                id="pairing"
                title="Bebida e acompanhamento"
                summary={
                  [
                    configuration.drink && "Coca-Cola 350 ml",
                    configuration.side && "Batata rústica",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Bebida e acompanhamento não incluídos"
                }
                optional
                open={!!open.pairing}
                onToggle={() => toggleSection("pairing")}
              >
                {pairings.map((pairing) => (
                  <Pressable
                    key={pairing.key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${pairing.product.name}, ${pairing.detail}, mais ${money(pairing.product.price)}`}
                    accessibilityState={{
                      checked: configuration[pairing.key],
                    }}
                    onPress={() =>
                      setConfiguration((current) => ({
                        ...current,
                        [pairing.key]: !current[pairing.key],
                      }))
                    }
                  >
                    <View style={styles.pairingRow}>
                      <Image
                        source={pairing.image}
                        resizeMode="contain"
                        style={styles.pairingImage}
                      />
                      <View style={styles.optionCopy}>
                        <KioskText style={styles.optionName}>
                          {pairing.product.name}
                        </KioskText>
                        <KioskText style={styles.optionSubtitle}>
                          {pairing.detail} · + {money(pairing.product.price)}
                        </KioskText>
                      </View>
                      <Checkbox checked={configuration[pairing.key]} pairing />
                    </View>
                  </Pressable>
                ))}
              </Section>
            )}
          </>
        )}

        {!product.ingredients.length && (
          <View style={styles.simpleProduct}>
            <KioskText style={styles.simpleTitle}>{product.detail}</KioskText>
            <KioskText style={styles.simpleDescription}>
              Ajuste a quantidade no rodapé e adicione ao pedido.
            </KioskText>
          </View>
        )}
      </>
    </ProductShell>
  );
}
