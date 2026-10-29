import { useCallback, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { ArrowLeft, Check } from "lucide-react-native";
import { ProductArt } from "./product-art";
import type { ArtProduct } from "./product-motion";
import type { MenuItem } from "./menu-screen";
import { money } from "./reference-model";
import {
  Action,
  BrandHeader,
  colors,
  Dock,
  KioskText,
  Quantity,
  type SectionProps,
} from "./ui";
import { styles } from "./product-styles";
import { SectionRevealContext } from "./section-reveal";

export type RevealSection = NonNullable<SectionProps["onReveal"]>;

export function ProductShell({
  product,
  editing,
  heading,
  lead,
  total,
  quantity,
  onQuantity,
  disabled,
  dockDescription,
  onBack,
  onSave,
  children,
}: {
  product: MenuItem & ArtProduct;
  editing: boolean;
  heading: string;
  lead: string;
  total: number;
  quantity: number;
  onQuantity: (quantity: number) => void;
  disabled: boolean;
  dockDescription: string;
  onBack: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [dockHeight, setDockHeight] = useState(140);
  const viewport = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [descriptionHeight, setDescriptionHeight] = useState<number>();
  const followOpening = useCallback<RevealSection>(
    (rect, finished, reduced) => {
      viewport.current?.measureInWindow((_x, top, _width, height) => {
        const remaining =
          Math.min(rect.top + rect.height, rect.top + 190) -
          (top + height - dockHeight - 16);
        if (remaining > 1)
          scroll.current?.scrollTo({
            y:
              scrollOffset.current +
              (finished ? remaining : Math.min(28, remaining * 0.42)),
            animated: finished && !reduced,
          });
      });
    },
    [dockHeight],
  );
  return (
    <View ref={viewport} collapsable={false} style={styles.screen}>
      <ScrollView
        ref={scroll}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: dockHeight + 24 }}
      >
        <BrandHeader />
        <View style={[styles.main, width <= 360 && styles.narrowMain]}>
          <Pressable accessibilityRole="button" onPress={onBack}>
            <View style={styles.back}>
              <ArrowLeft size={18} color="#65695d" />
              <KioskText style={styles.backText}>
                Voltar ao {editing ? "pedido" : "cardápio"}
              </KioskText>
            </View>
          </Pressable>
          <View style={styles.layout}>
            <View style={styles.preview}>
              <ProductArt product={product} detail />
              <View style={styles.previewCopy}>
                <KioskText
                  accessibilityRole="header"
                  style={styles.productTitle}
                >
                  {product.name}
                </KioskText>
                <KioskText
                  style={[
                    styles.description,
                    descriptionHeight !== undefined && {
                      height: descriptionHeight,
                    },
                  ]}
                  onTextLayout={({ nativeEvent: { lines } }) => {
                    if (lines.length) setDescriptionHeight(lines.length * 19.2);
                  }}
                >
                  {product.description}
                </KioskText>
                <View style={styles.priceRow}>
                  <KioskText style={styles.price}>
                    {money(product.price)}
                  </KioskText>
                  {product.oldPrice != null && (
                    <KioskText style={styles.oldPrice}>
                      {money(product.oldPrice)}
                    </KioskText>
                  )}
                </View>
                {product.combo && (
                  <View style={styles.included}>
                    <Check size={17} color={colors.green} />
                    <KioskText style={styles.includedText}>
                      Inclui {product.combo.toLowerCase()}
                    </KioskText>
                  </View>
                )}
              </View>
            </View>
            <View>
              <KioskText accessibilityRole="header" style={styles.heading}>
                {heading}
              </KioskText>
              <KioskText style={styles.lead}>{lead}</KioskText>
              <SectionRevealContext.Provider value={followOpening}>
                {children}
              </SectionRevealContext.Provider>
            </View>
          </View>
        </View>
      </ScrollView>
      <Dock
        description={dockDescription}
        value={total}
        onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
      >
        <Quantity value={quantity} onChange={onQuantity} name={product.name} />
        <Action disabled={disabled} onPress={onSave}>
          {editing ? "Salvar alterações" : "Adicionar ao pedido"}
        </Action>
      </Dock>
    </View>
  );
}
