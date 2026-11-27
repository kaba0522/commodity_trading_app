import { BackButton } from "@/components/common/BackButton";
import { ConfirmSheet } from "@/components/common/ConfirmSheet";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, formatTradeDateLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ChatComposer } from "@/features/negotiation/components/ChatComposer";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import { CounterSheet } from "@/features/negotiation/components/CounterSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { Toast } from "@/features/negotiation/components/Toast";
import { ThreadMessage } from "@/features/negotiation/components/ThreadMessage";
import { useNegotiationActions } from "@/features/negotiation/hooks/useNegotiationActions";
import { useNegotiationThread } from "@/features/negotiation/hooks/useNegotiationThread";
import { useToast } from "@/features/negotiation/hooks/useToast";
import {
  getPartialFillInfo,
  isOfferWindowOpen,
  latestCounterPrice,
  latestOfferPrice,
  threadState,
  type NegotiationRole,
  type PartialFillInfo,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { NegotiationMessage, NegotiationThread, VoiceNote } from "@/types/domain";
import { FlashList } from "@shopify/flash-list";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface NegotiationChatScreenProps {
  id?: string;
  simulateCutoff?: boolean;
}

/** Prototype chat header: "Rajma · Disco · Bold" without duplicated parts. */
function listingLabel(thread: NegotiationThread): string {
  let label = thread.item?.trim() || "Negotiation";
  const category = thread.category?.trim();
  const quality = thread.quality?.trim();
  if (category && !label.toLowerCase().includes(category.toLowerCase())) {
    label = `${category} · ${label}`;
  }
  if (quality && !label.toLowerCase().includes(quality.toLowerCase())) {
    label = `${label} · ${quality}`;
  }
  return label;
}

/** Shared negotiation chat for both roles — the thread decides whose UI it is. */
export function NegotiationChatScreen({
  id,
  simulateCutoff = false,
}: NegotiationChatScreenProps) {
  const {
    thread: threadOrNull,
    setThread,
    isLoading,
    error: loadError,
    retry,
  } = useNegotiationThread(id);
  const actions = useNegotiationActions();
  const { session } = useAuth();
  const [toast, setToast] = useToast();
  const [counterOpen, setCounterOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partial, setPartial] = useState<PartialFillInfo | null>(null);

  const role: NegotiationRole = threadOrNull?.role ?? "buyer";
  const backendRole = resolveBackendRole(session?.user);
  if (threadOrNull && backendRole !== threadOrNull.role) {
    return <Redirect href={role === "seller" ? "/requirements" : "/browse"} />;
  }

  const fallback = role === "seller" ? "/orders" : "/trades";

  if (isLoading && !threadOrNull) {
    return (
      <View style={styles.emptyScreen}>
        <BackButton fallback={fallback} />
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.emptyText}>Loading negotiation…</Text>
      </View>
    );
  }

  if (!threadOrNull) {
    return (
      <View style={styles.emptyScreen}>
        <BackButton fallback={fallback} />
        <FormStatus
          kind="error"
          message={loadError ?? "This negotiation is no longer available."}
        />
        {loadError ? (
          <Button title="Retry" variant="secondary" onPress={() => void retry()} />
        ) : null}
      </View>
    );
  }

  const thread = threadOrNull;
  const state = threadState(thread);
  const {
    phase,
    canChat: conversationOpen,
    canCounter,
    countersLeft,
    completedTrade,
    declinedNotice,
  } = state;
  const offerToActOn =
    phase === "respond" && thread.pendingOffer?.author === "them"
      ? thread.pendingOffer
      : null;
  const theirPrice =
    offerToActOn?.price ?? latestCounterPrice(thread) ?? latestOfferPrice(thread);
  const remaining = countersLeft;
  const counterMax = thread.counters?.max ?? 2;
  const finalPrice = thread.trade?.price ?? thread.agreedPrice ?? latestOfferPrice(thread);
  const finalBags = thread.trade?.bags ?? thread.requestedBags;
  const finalDate = formatTradeDateLabel(
    thread.confirmedAt ?? thread.trade?.date ?? thread.updatedAt,
  );
  // A confirmed trade still has its own "choose broker" screen; the compact
  // completed box is only for finished trades.
  const hasCompletedTrade = completedTrade && phase !== "confirmed";

  const lastOfferMessage = [...thread.messages]
    .reverse()
    .find((message) => message.kind === "offer");
  // Both roles must see the same footer text. Work out who declined from the
  // rejected offer's author, then render the same label on either side.
  const declinerRole =
    lastOfferMessage?.author === "you"
      ? role === "buyer"
        ? "seller"
        : "buyer"
      : role;
  const declinedTitle = `Offer declined by ${declinerRole}`;
  // §22D: a decline returns the turn to the OFFERER and spends no counter.
  // The decliner has no offer action; a fresh negotiation must be started from
  // the listing / requirement, not from an already-open thread.
  const showClosedFooter = phase === "cancelled" || phase === "closed";
  const canRespond = phase === "respond" && !showClosedFooter;
  const canCounterNow = canCounter && !showClosedFooter;
  const showDeclinedNotice = declinedNotice && !showClosedFooter;
  const waitingForReply = phase === "waiting" && !showClosedFooter;

  function offersAllowed(): boolean {
    if (isOfferWindowOpen(new Date(), simulateCutoff)) return true;
    setCutoffOpen(true);
    return false;
  }

  function openCounterSheet() {
    setFormError(null);
    if (offersAllowed()) setCounterOpen(true);
  }

  function showError(
    e: unknown,
    fallbackMessage: string,
    attemptedBags = thread.requestedBags,
    allowPartial = false,
  ): boolean {
    const info = getPartialFillInfo(e);
    if (info && allowPartial) {
      setPartial({ ...info, requested: info.requested ?? attemptedBags });
      setFormError(null);
      setQtyOpen(true);
      return true;
    }
    setFormError(getFriendlyApiError(e, fallbackMessage));
    return false;
  }

  async function sendCounter(price: number, note?: string, voice?: VoiceNote) {
    setBusy(true);
    setFormError(null);
    try {
      setThread(await actions.counter(thread.id, { price, note, voice }));
      setCounterOpen(false);
      setToast("Counter sent!");
    } catch (e) {
      showError(e, "Could not send your counter");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer(bags: number, acceptPartial = false) {
    if (!offerToActOn?.id) {
      setFormError("The pending offer is missing its id. Refresh and try again.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await actions.accept(offerToActOn.id, acceptPartial);
      setThread(result.thread);
      setToast(
        result.status === "partial_fill_proposed"
          ? "Partial quantity proposed"
          : "Offer accepted",
      );
      if (result.status === "trade_confirmed" || result.tradeId) {
        router.push({
          pathname: "/negotiation/confirm",
          params: {
            id: thread.id,
            ...(result.tradeId ? { tradeId: result.tradeId } : {}),
          },
        });
      }
    } catch (e) {
      showError(e, "Could not accept the offer", bags, true);
    } finally {
      setBusy(false);
    }
  }

  function handleAccept() {
    // §22D decides the shortfall on the server. A local availability guess can
    // belong to a different buyer's trade; only PARTIAL_FILL_REQUIRED should
    // open the "Partial Availability" dialog before retrying with acceptPartial.
    if (!offerToActOn) {
      setFormError("There is no pending offer to accept. Refresh and try again.");
      return;
    }
    setPartial(null);
    void acceptOffer(bagsSafe(offerToActOn.bags || thread.requestedBags));
  }

  async function decline() {
    if (!offerToActOn?.id) {
      setFormError("The pending offer is missing its id. Refresh and try again.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      setThread(await actions.decline(offerToActOn.id));
      setToast("Offer declined");
    } catch (e) {
      showError(e, "Could not decline the offer");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setFormError(null);
    try {
      setThread(await actions.withdraw(thread.id));
      setToast("Offer withdrawn");
      setWithdrawOpen(false);
      router.replace(fallback);
    } catch (e) {
      showError(e, "Could not withdraw the offer");
      setBusy(false);
    }
  }

  async function sendChatText(text: string) {
    setThread(await actions.sendMessage(thread.id, { text }));
  }

  async function sendChatVoice(voice: VoiceNote) {
    setThread(await actions.sendMessage(thread.id, { voice }));
  }

  function backToMarket() {
    router.replace(role === "seller" ? "/requirements" : "/browse");
  }

  const renderMessage = ({ item }: { item: NegotiationMessage }) => (
    <ThreadMessage message={item} role={role} />
  );

  return (
    <View style={styles.screen}>
      <Toast message={toast} />

      <View style={styles.header}>
        <BackButton accessibilityLabel="Back to trades" fallback={fallback} />
        <View style={styles.headerText}>
          <Text style={styles.counterparty}>{thread.counterparty}</Text>
          <Text style={styles.item} numberOfLines={1}>
            {listingLabel(thread)}
          </Text>
        </View>
        {conversationOpen ? (
          <PressableWithdraw busy={busy} onPress={() => setWithdrawOpen(true)} />
        ) : null}
      </View>

      <View style={styles.contextBar}>
        <Text style={styles.contextText} numberOfLines={1}>
          <Text style={styles.contextLabel}>
            {role === "buyer" ? "Listed" : "Target"}:{" "}
          </Text>
          <Text style={styles.contextValue}>{priceLabel(thread.listedPrice)}</Text>
        </Text>
        <Text style={styles.contextText} numberOfLines={1}>
          <Text style={styles.contextLabel}>Avail: </Text>
          <Text style={styles.contextValue}>{bagsLabel(thread.availableBags)}</Text>
        </Text>
        <Text style={styles.contextText} numberOfLines={1}>
          <Text style={styles.contextLabel}>Your ask: </Text>
          <Text style={styles.contextValue}>{bagsLabel(thread.requestedBags)}</Text>
        </Text>
      </View>

      {formError ? <FormStatus kind="error" message={formError} /> : null}

      <FlashList<NegotiationMessage>
        data={thread.messages}
        renderItem={renderMessage}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messages}
      />

      <View style={styles.actionBar}>
        {waitingForReply ? (
          <View style={styles.centeredNote}>
            <Text style={styles.waitingTitle}>
              {declinedNotice
                ? "Waiting for a new offer"
                : thread.pendingOffer?.author === "you"
                  ? "Offer Sent"
                  : "Waiting for reply"}
            </Text>
            <Text style={styles.waitingSubtitle}>
              {declinedNotice
                ? `Waiting for ${thread.counterparty} to respond`
                : role === "seller"
                  ? "Awaiting buyer"
                  : "Waiting for reply"}
            </Text>
          </View>
        ) : null}

        {showDeclinedNotice ? (
          <View style={styles.declinedNoticeBox}>
            <Text style={styles.declinedNoticeText}>{declinedTitle}</Text>
          </View>
        ) : null}

        {canRespond ? (
          <View style={styles.actionStack}>
            <ChatActionButton
              title={`Accept ${priceLabel(offerToActOn?.price ?? theirPrice)}`}
              variant="primary"
              onPress={handleAccept}
              disabled={busy}
            />
            <View style={styles.actionRow}>
              {canCounterNow ? (
                <View style={styles.actionFlex}>
                  <ChatActionButton
                    title="Counter offer"
                    onPress={openCounterSheet}
                    disabled={busy}
                  />
                </View>
              ) : null}
              <View style={styles.actionFlex}>
                <ChatActionButton
                  title="Decline"
                  onPress={() => void decline()}
                  disabled={busy}
                />
              </View>
            </View>
            {!canCounterNow ? (
              <Text style={styles.limitNote}>
                Counter limit reached ({counterMax}/{counterMax})
              </Text>
            ) : null}
          </View>
        ) : null}

        {phase === "offer" && canCounterNow ? (
          <View style={styles.actionStack}>
            <ChatActionButton
              title="Counter offer"
              variant="primary"
              onPress={openCounterSheet}
              disabled={busy}
            />
          </View>
        ) : null}

        {phase === "offer" && !canCounterNow ? (
          <Text style={styles.limitNote}>
            Counter limit reached ({counterMax}/{counterMax})
          </Text>
        ) : null}

        {thread.status === "confirmed" ? (
          <View style={styles.actionStack}>
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>
                Trade agreed at {priceLabel(finalPrice)}
              </Text>
              <Text style={styles.successSubtitle}>
                {bagsLabel(finalBags)} · choose a broker to finish
              </Text>
            </View>
            <Button
              title="Confirm trade"
              onPress={() =>
                router.push({
                  pathname: "/negotiation/confirm",
                  params: {
                    id: thread.id,
                    ...(thread.tradeId ? { tradeId: thread.tradeId } : {}),
                  },
                })
              }
            />
          </View>
        ) : null}

        {hasCompletedTrade ? (
          <View style={styles.completedBox}>
            <Text style={styles.completedTitle}>
              Trade completed at {priceLabel(finalPrice)}
            </Text>
            <Text style={styles.completedSubtitle}>
              {bagsLabel(finalBags)} · {finalDate}
            </Text>
          </View>
        ) : null}

        {thread.status === "withdrawn" ? (
          <View style={styles.actionStack}>
            <View style={styles.centeredNote}>
              <Text style={styles.warningTitle}>Offer has been withdrawn</Text>
              <Text style={styles.waitingSubtitle}>
                {role === "seller" ? "Try another buyer" : "Check other similar listings"}
              </Text>
            </View>
            <Button
              title={role === "seller" ? "Check other requirements" : "Check other listings"}
              onPress={backToMarket}
            />
          </View>
        ) : null}

        {showClosedFooter ? (
          <View style={styles.dangerBox}>
            <Text style={styles.dangerTitle}>
              {thread.status === "cancelled"
                ? thread.reasonLabel ?? "Negotiation cancelled"
                : declinedNotice
                  ? declinedTitle
                  : "Negotiation closed"}
            </Text>
            <Pressable
              onPress={backToMarket}
              disabled={busy}
              style={({ pressed }) => [
                styles.dangerButton,
                (pressed || busy) && styles.dangerButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to market"
            >
              <Text style={styles.dangerButtonText}>
                {role === "seller" ? "Check requirements" : "Check listings"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {conversationOpen ? (
          <ChatComposer
            disabled={busy}
            onSendText={sendChatText}
            onSendVoice={sendChatVoice}
          />
        ) : null}
      </View>

      {counterOpen ? (
        <CounterSheet
          visible
          role={role}
          listedPrice={thread.listedPrice}
          theirOffer={theirPrice}
          remaining={remaining}
          max={thread.counters?.max ?? 2}
          submitting={busy}
          submitError={formError}
          onClose={() => setCounterOpen(false)}
          onSubmit={(price, note, voice) => void sendCounter(price, note, voice)}
        />
      ) : null}

      <QtyMismatchDialog
        visible={qtyOpen}
        requestedBags={partial?.requested ?? thread.requestedBags}
        availableBags={partial?.available ?? thread.availableBags}
        price={partial?.price ?? theirPrice}
        onCancel={() => {
          setQtyOpen(false);
          setPartial(null);
        }}
        onConfirm={() => {
          const bags = partial?.available ?? thread.availableBags;
          setQtyOpen(false);
          void acceptOffer(bags, true);
        }}
      />

      <ConfirmSheet
        visible={withdrawOpen}
        title="Withdraw offer?"
        message={`Your offer with ${thread.counterparty} will be withdrawn and this conversation will end.`}
        confirmTitle="Withdraw"
        cancelTitle="Keep offer"
        error={formError}
        isBusy={busy}
        onConfirm={() => void withdraw()}
        onCancel={() => {
          if (!busy) {
            setWithdrawOpen(false);
            setFormError(null);
          }
        }}
      />

      <CutoffSheet visible={cutoffOpen} onClose={() => setCutoffOpen(false)} />
    </View>
  );
}

function bagsSafe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Prototype action-bar button: solid primary accept, neutral outlined secondary. */
function ChatActionButton({
  title,
  onPress,
  variant = "outline",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chatAction,
        primary ? styles.chatActionPrimary : styles.chatActionOutline,
        (pressed || disabled) && styles.chatActionDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text
        style={primary ? styles.chatActionTextPrimary : styles.chatActionTextOutline}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function PressableWithdraw({
  busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.withdrawButton,
        (pressed || busy) && styles.withdrawDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Withdraw offer"
    >
      <Text style={styles.withdrawText}>{busy ? "Withdrawing…" : "Withdraw"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyScreen: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  counterparty: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  item: {
    fontSize: 12,
    color: colors.muted,
  },
  withdrawButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  withdrawText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.dangerText,
  },
  withdrawDisabled: {
    opacity: 0.6,
  },
  contextBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextText: {
    fontSize: 12,
    color: colors.muted,
  },
  contextLabel: {
    color: colors.muted,
  },
  contextValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  messages: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  actionStack: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
  chatAction: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chatActionPrimary: {
    height: 46,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chatActionOutline: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  chatActionTextPrimary: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  chatActionTextOutline: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  chatActionDisabled: {
    opacity: 0.45,
  },
  centeredNote: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  waitingSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.counterparty,
  },
  limitNote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: "center",
  },
  successBox: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.successBg,
    alignItems: "center",
  },
  /** Prototype completed-trade summary — compact centered success panel. */
  completedBox: {
    padding: spacing.compact,
    borderRadius: 12,
    backgroundColor: colors.success100,
    alignItems: "center",
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.success800,
  },
  completedSubtitle: {
    fontSize: 12,
    color: colors.success700,
    marginTop: 2,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.success,
  },
  successSubtitle: {
    fontSize: 12,
    color: colors.success,
    marginTop: 2,
  },
  /** Open-thread declined notice: informs both sides without blocking actions. */
  declinedNoticeBox: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
  },
  declinedNoticeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger800,
    textAlign: "center",
  },
  /** Prototype declined footer: danger-100 panel with the button inside it. */
  dangerBox: {
    padding: spacing.compact,
    borderRadius: 12,
    backgroundColor: colors.danger100,
    alignItems: "center",
    gap: spacing.sm,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.danger800,
    textAlign: "center",
  },
  dangerButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dividerOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.danger800,
  },
  dangerButtonDisabled: {
    opacity: 0.45,
  },
});
