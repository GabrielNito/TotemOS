import { ScrollView, View, StyleSheet, ActivityIndicator } from "react-native";
import { Action, BrandHeader, KioskText, colors } from "../kiosk/ui";
import { formatCurrency } from "./model";
import type { OrderSubmission, PendingOrder } from "./order-submission";
import { orderCopy } from "./order-tracking";
import { useOrderTracking } from "./use-order-tracking";

type Props = {
  negocioId: string;
  submission: OrderSubmission;
  result?: PendingOrder;
  busy: boolean;
  error: string;
  onRetry: () => void;
  onBack?: () => void;
  onNew: () => Promise<void> | void;
};
export function OrderStatus(props: Props) {
  return (
    <View style={styles.root}>
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.content}>
        {props.result ? (
          <Tracking key={props.result.id} {...props} result={props.result} />
        ) : (
          <>
            <KioskText menu style={styles.title}>
              {props.busy
                ? "Registrando seu pedido"
                : "Confira o envio do pedido"}
            </KioskText>
            {props.busy && (
              <ActivityIndicator size="large" color={colors.action} />
            )}
            <KioskText style={styles.copy}>
              {props.error ||
                "Aguarde enquanto confirmamos seu pedido com o estabelecimento."}
            </KioskText>
            <KioskText style={styles.copy}>
              Se o envio ficou incerto, consulte novamente para recuperar o
              mesmo pedido. Solicite assistência se não conseguir continuar.
            </KioskText>
            {!props.busy && (
              <Action onPress={props.onRetry}>Consultar novamente</Action>
            )}
            {!props.busy && props.onBack && (
              <Action onPress={props.onBack}>Revisar carrinho</Action>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Tracking({
  negocioId,
  submission,
  result,
  onNew,
  busy,
  error,
}: Props & { result: PendingOrder }) {
  const tracking = useOrderTracking(negocioId, result.id, submission);
  const current = tracking.snapshot;
  const copy = current ? orderCopy[current.status] : undefined;
  const ready = current?.status === "PRONTO";
  return (
    <>
      {current?.demo && (
        <KioskText style={styles.badge}>Operação demonstrativa</KioskText>
      )}
      <KioskText menu accessibilityRole="header" style={styles.title}>
        {copy?.title ?? "Confirmando o acompanhamento"}
      </KioskText>
      <KioskText accessibilityLiveRegion="polite" style={styles.copy}>
        {copy?.description ??
          "Pedido registrado. Consultando o estado atual com o estabelecimento."}
      </KioskText>
      {current && (
        <View style={[styles.ticket, ready && styles.readyTicket]}>
          <KioskText style={styles.copy}>
            {current.senha === null
              ? "Senha ainda não atribuída pelo KDS"
              : "Sua senha"}
          </KioskText>
          {current.senha !== null && (
            <KioskText
              menu
              style={[styles.password, ready && styles.readyPassword]}
            >
              {current.senha}
            </KioskText>
          )}
          {current.dataOperacional && (
            <KioskText style={styles.copy}>
              Data operacional: {current.dataOperacional}
            </KioskText>
          )}
        </View>
      )}
      <KioskText style={styles.total}>
        {formatCurrency(Number(current?.valorTotal ?? result.valorTotal))}
      </KioskText>
      <KioskText style={styles.copy}>
        Total confirmado pelo estabelecimento
      </KioskText>
      <KioskText selectable style={styles.copy}>
        Referência: {result.id.slice(0, 8).toUpperCase()}
      </KioskText>
      {current?.autorizacaoOperacional?.tipo === "DEMO" && (
        <KioskText style={styles.copy}>
          Liberação operacional de demonstração. Não representa quitação
          financeira.
        </KioskText>
      )}
      {tracking.busy && (
        <View style={styles.updating}>
          <ActivityIndicator color={colors.action} />
          <KioskText style={styles.copy}>
            Atualizando acompanhamento...
          </KioskText>
        </View>
      )}
      <KioskText style={styles.copy}>
        Última sincronização:{" "}
        {tracking.syncedAt
          ? new Date(tracking.syncedAt).toLocaleString("pt-BR")
          : "aguardando primeira consulta"}
      </KioskText>
      {tracking.stale && (
        <KioskText accessibilityLiveRegion="polite" style={styles.copy}>
          Estado desatualizado. O último estado confirmado foi preservado.
        </KioskText>
      )}
      {(error || tracking.error) && (
        <KioskText accessibilityRole="alert" style={styles.copy}>
          {error || tracking.error?.message}
        </KioskText>
      )}
      {current?.status === "ENTREGUE" ? (
        <Action
          disabled={busy}
          onPress={() => {
            void onNew();
          }}
        >
          {busy ? "Encerrando atendimento..." : "Novo atendimento"}
        </Action>
      ) : (
        <>
          <KioskText style={styles.copy}>
            Consultas periódicas enquanto o aplicativo está aberto. Se precisar,
            solicite assistência ao estabelecimento.
          </KioskText>
          <Action disabled={tracking.busy || busy} onPress={tracking.refresh}>
            Atualizar acompanhamento
          </Action>
        </>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 28, gap: 18, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 38, lineHeight: 42, color: colors.ink },
  copy: { fontSize: 15, lineHeight: 23, color: colors.muted },
  total: { fontSize: 30, fontWeight: "600", color: colors.ink },
  badge: { fontSize: 16, fontWeight: "600", color: colors.action },
  ticket: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.wash,
    alignItems: "center",
    gap: 8,
  },
  readyTicket: { borderWidth: 2, borderColor: colors.action },
  password: { fontSize: 64, lineHeight: 70, color: colors.ink },
  readyPassword: { fontSize: 104, lineHeight: 112, color: colors.action },
  updating: { flexDirection: "row", gap: 12, alignItems: "center" },
});
