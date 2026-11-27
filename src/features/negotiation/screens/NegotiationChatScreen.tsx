import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ChatComposer } from "@/features/negotiation/components/ChatComposer";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import { CounterSheet } from "@/features/negotiation/components/CounterSheet";
import {
  OfferSheet,
  type OfferDraft,
} from "@/features/negotiation/components/OfferSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { Toast } from "@/features/negotiation/components/Toast";
import { ThreadMessage } from "@/features/negotiation/components/ThreadMessage";
import { useNegotiationActions } from "@/features/negotiation/hooks/useNegotiationActions";
import { useNegotiationThread } from "@/features/negotiation/hooks/useNegotiationThread";
import { useStartNegotiation } from "@/features/negotiation/hooks/useStartNegotiation";
import { useToast } from "@/features/negotiation/hooks/useToast";
import {
  countersRemaining,
  getPartialFillInfo,
  isOfferWindowOpen,
  latestCounterPrice,
  latestOfferPrice,
  type NegotiationRole,
  type PartialFillInfo,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { NegotiationMessage, NegotiationThread, VoiceNote } from "@/types/domain";
import { FlashList } from "@shopify/flash-list";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface NegotiationChatScreenProps {
  id?: string;
  simulateCutoff?: boolean;
}

/** Pending counterparty offer that can be accepted or declined. */
function actionableOffer(thread: NegotiationThread): NegotiationMessage | null {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const message = thread.messages[i];
    if (
      message.kind === "offer" &&
      message.author === "them" &&
      message.offerId &&
      !message.status
    ) {
      return message;
    }
  }
  return null;
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
  const { start } = useStartNegotiation();
  const { session } = useAuth();
  const [toast, setToast] = useToast();
  const [counterOpen, setCounterOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);
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
  const theirPrice = latestCounterPrice(thread) ?? latestOfferPrice(thread);
  const remaining = countersRemaining(thread);
  const finalPrice = thread.trade?.price ?? thread.agreedPrice ?? latestOfferPrice(thread);
  const finalBags = thread.trade?.bags ?? thread.requestedBags;
  const offerToActOn = actionableOffer(thread);
  const conversationOpen = thread.status === "your_turn" || thread.status === "waiting";

  function offersAllowed(): boolean {
    if (isOfferWindowOpen(new Date(), simulateCutoff)) return true;
    setCutoffOpen(true);
    return false;
  }

  function showError(e: unknown, fallbackMessage: string): boolean {
    const info = getPartialFillInfo(e);
    if (info && !partial) {
      setPartial(info);
      setQtyOpen(true);
      return true;
    }
    setFormError(getFriendlyApiError(e, fallbackMessage));
    return false;
  }

  async function sendCounter(price: number, note?: string, voice?: VoiceNote) {
    setCounterOpen(false);
    setBusy(true);
    setFormError(null);
    try {
      setThread(await actions.counter(thread.id, { price, note, voice }));
      setToast("Counter sent!");
    } catch (e) {
      showError(e, "Could not send your counter");
    } finally {
      setBusy(false);
    }
  }

  async function sendOffer(draft: OfferDraft) {
    if (!thread.listingId) {
      setFormError("This negotiation is missing its listing id.");
      return;
    }
    setOfferOpen(false);
    setBusy(true);
    setFormError(null);
    try {
      const next = await start({
        listingId: thread.listingId,
        price: draft.price,
        bagsRequested: draft.bags,
        note: draft.note,
        voice: draft.voiceNote,
      });
      router.push({ pathname: "/negotiation/[id]", params: { id: next.id } });
    } catch (e) {
      showError(e, "Could not start a new offer");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer(bags: number, acceptPartial = false) {
    if (!offerToActOn?.offerId) {
      setFormError("The pending offer is missing its id. Refresh and try again.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await actions.accept(offerToActOn.offerId, acceptPartial);
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
      showError(e, "Could not accept the offer");
    } finally {
      setBusy(false);
    }
  }

  function handleAccept() {
    const serverAvailable = partial?.available;
    const localAvailable =
      thread.availableBags > 0 && thread.requestedBags > thread.availableBags
        ? thread.availableBags
        : null;
    const available = serverAvailable ?? localAvailable;
    if (available) {
      setPartial({ available, price: partial?.price ?? theirPrice });
      setQtyOpen(true);
      return;
    }
    void acceptOffer(bagsSafe(thread.requestedBags));
  }

  async function decline() {
    if (!offerToActOn?.offerId) {
      setFormError("The pending offer is missing its id. Refresh and try again.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      setThread(await actions.decline(offerToActOn.offerId));
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
            {thread.item}
          </Text>
        </View>
        {conversationOpen ? (
          <PressableWithdraw busy={busy} onPress={() => void withdraw()} />
        ) : null}
      </View>

      <View style={styles.contextBar}>
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>
            {role === "buyer" ? "Listed" : "Target"}
          </Text>
          <Text style={styles.contextValue}>{priceLabel(thread.listedPrice)}</Text>
        </View>
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>Avail</Text>
          <Text style={styles.contextValue}>{bagsLabel(thread.availableBags)}</Text>
        </View>
        <View style={styles.contextItem}>
          <Text style={styles.contextLabel}>Your ask</Text>
          <Text style={styles.contextValue}>{bagsLabel(thread.requestedBags)}</Text>
        </View>
      </View>

      {formError ? <FormStatus kind="error" message={formError} /> : null}

      <FlashList<NegotiationMessage>
        data={thread.messages}
        renderItem={renderMessage}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messages}
      />

      <View style={styles.actionBar}>
        {thread.status === "waiting" ? (
          <View style={styles.centeredNote}>
            <Text style={styles.waitingTitle}>Offer Sent</Text>
            <Text style={styles.waitingSubtitle}>
              {role === "seller" ? "Awaiting buyer" : "Waiting for reply"}
            </Text>
          </View>
        ) : null}

        {thread.status === "your_turn" ? (
          <View style={styles.actionStack}>
            <Button
              title={`Accept ${priceLabel(theirPrice)}`}
              onPress={handleAccept}
              disabled={busy}
            />
            <View style={styles.actionRow}>
              <View style={styles.actionFlex}>
                <Button
                  title="Counter offer"
                  variant="secondary"
                  onPress={() => {
                    if (remaining > 0 && offersAllowed()) setCounterOpen(true);
                  }}
                  disabled={busy || remaining <= 0}
                />
              </View>
              <View style={styles.actionFlex}>
                <Button
                  title="Decline"
                  variant="secondary"
                  onPress={() => void decline()}
                  disabled={busy}
                />
              </View>
            </View>
            <Text style={styles.limitNote}>
              {remaining > 0 ? `${remaining} counter offer(s) remaining` : "Counter limit reached"}
            </Text>
          </View>
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

        {thread.status === "completed" ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>
              Trade completed at {priceLabel(finalPrice)}
            </Text>
            <Text style={styles.successSubtitle}>
              {bagsLabel(finalBags)} · {thread.trade?.date ?? thread.updatedAt}
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

        {thread.status === "declined" || thread.status === "cancelled" ? (
          <View style={styles.actionStack}>
            <View style={styles.dangerBox}>
              <Text style={styles.dangerTitle}>
                {thread.status === "cancelled"
                  ? thread.reasonLabel ?? "Negotiation cancelled"
                  : `Offer declined by ${role === "seller" ? "buyer" : "seller"}`}
              </Text>
            </View>
            <Button
              title="Make new offer"
              variant="secondary"
              disabled={busy}
              onPress={() => {
                if (offersAllowed()) setOfferOpen(true);
              }}
            />
          </View>
        ) : null}

        <ChatComposer
          disabled={!conversationOpen || busy}
          onSendText={sendChatText}
          onSendVoice={sendChatVoice}
        />
      </View>

      {counterOpen ? (
        <CounterSheet
          visible
          role={role}
          listedPrice={thread.listedPrice}
          theirOffer={theirPrice}
          remaining={remaining}
          max={thread.counters?.max ?? 2}
          onClose={() => setCounterOpen(false)}
          onSubmit={(price, note, voice) => void sendCounter(price, note, voice)}
        />
      ) : null}

      {offerOpen ? (
        <OfferSheet
          visible
          role={role}
          listedPrice={thread.listedPrice}
          availableBags={thread.availableBags}
          requestedBags={thread.requestedBags}
          onClose={() => setOfferOpen(false)}
          onSubmit={(draft) => void sendOffer(draft)}
        />
      ) : null}

      <QtyMismatchDialog
        visible={qtyOpen}
        requestedBags={thread.requestedBags}
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

      <CutoffSheet visible={cutoffOpen} onClose={() => setCutoffOpen(false)} />
    </View>
  );
}

function bagsSafe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function PressableWithdraw({
  busy: _busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      title="Withdraw"
      variant="secondary"
      onPress={onPress}
      disabled={_busy}
    />
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
  contextBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextItem: {
    gap: 1,
  },
  contextLabel: {
    fontSize: 10.5,
    color: colors.muted,
  },
  contextValue: {
    fontSize: 12.5,
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
  dangerBox: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.danger,
  },
});
