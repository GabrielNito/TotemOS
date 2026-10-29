import {
  Image,
  Pressable,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { ArrowRight } from "lucide-react-native";
import type { Mode } from "./reference-model";
import { KioskText as Text } from "./ui";
import { s } from "./kiosk-styles";

export function KioskStandby({
  continuing,
  mode,
  brand,
  hero,
  welcome,
  onContinue,
}: {
  continuing: boolean;
  mode: Mode;
  brand: { name: string; tagline: string };
  hero?: ImageSourcePropType;
  welcome?: string;
  onContinue: () => void;
}) {
  const { width, height } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        continuing
          ? "Toque para continuar o pedido"
          : "Toque para começar o pedido"
      }
      onPress={onContinue}
      style={{ flex: 1 }}
    >
      <View style={s.standby}>
        <View style={s.brand}>
          <Text
            style={s.brandName}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {brand.name}
          </Text>
          <Text style={s.brandSub}>{brand.tagline}</Text>
        </View>
        {hero && (
          <Image
            source={hero}
            resizeMode="contain"
            style={{
              width: Math.min(width * 0.52, 300),
              height: Math.min(width * 0.52, 300, height * 0.3),
            }}
          />
        )}
        <Text style={s.standbyTitle}>
          {continuing
            ? "Seu pedido continua aqui."
            : welcome ||
              (mode === "counter"
                ? "Seu pedido começa aqui."
                : "Peça no seu ritmo.")}
        </Text>
        <Text style={s.standbyCopy}>
          {continuing
            ? "Tudo permanece como você deixou."
            : mode === "counter"
              ? "Escolha, pague e retire no balcão."
              : "Explore o cardápio da mesa 12."}
        </Text>
        <View style={s.standbyAction}>
          <Text style={s.standbyActionText}>
            Toque para {continuing ? "continuar" : "começar"}
          </Text>
          <ArrowRight size={20} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}
