import { ScrollView, View, StyleSheet, ActivityIndicator } from "react-native";
import { Action, BrandHeader, KioskText, colors } from "../kiosk/ui";
import { formatCurrency } from "./model";
import type { PendingOrder } from "./order-submission";

export function OrderStatus({
  result,
  busy,
  error,
  onRetry,
  onBack,
}: {
  result?: PendingOrder;
  busy: boolean;
  error: string;
  onRetry: () => void;
  onBack?: () => void;
}) {
  return (
    <View style={styles.root}>
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <KioskText menu style={styles.title}>
          {result
            ? "Pedido registrado"
            : busy
              ? "Registrando seu pedido"
              : "Confira o envio do pedido"}
        </KioskText>
        {busy && <ActivityIndicator size="large" color={colors.action} />}
        <KioskText style={styles.copy}>
          {result
            ? "Aguardando pagamento. Seu pedido ainda não foi enviado para preparo."
            : error ||
              "Aguarde enquanto confirmamos seu pedido com o estabelecimento."}
        </KioskText>
        {result && (
          <>
            <KioskText style={styles.total}>
              {formatCurrency(Number(result.valorTotal))}
            </KioskText>
            <KioskText style={styles.copy}>
              Total confirmado pelo estabelecimento
            </KioskText>
            <KioskText selectable style={styles.copy}>
              Referência: {result.id}
            </KioskText>
            <KioskText style={styles.copy}>
              O pagamento neste terminal será habilitado em uma próxima etapa.
              Solicite ajuda ao estabelecimento.
            </KioskText>
          </>
        )}
        {!busy && !result && (
          <Action onPress={onRetry}>Consultar novamente</Action>
        )}
        {!busy && onBack && <Action onPress={onBack}>Revisar carrinho</Action>}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 28, gap: 22, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 38, lineHeight: 42, color: colors.ink },
  copy: { fontSize: 15, lineHeight: 23, color: colors.muted },
  total: { fontSize: 30, fontWeight: "600", color: colors.ink },
});
