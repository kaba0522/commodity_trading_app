import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import { CounterSheet } from "@/features/negotiation/components/CounterSheet";
import { OfferSheet, type OfferDraft } from "@/features/negotiation/components/OfferSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { Toast } from "@/features/negotiation/components/Toast";
import { ThreadMessage } from "@/features/negotiation/components/ThreadMessage";
import { useToast } from "@/features/negotiation/hooks/useToast";
import {
  acceptOffer,
  declineOffer,
  startOfferThread,
  submitCounter,
  useNegotiationThread,
  withdrawOffer,
} from "@/features/negotiation/store";
import {
  countersRemaining,
  isOfferWindowOpen,
  latestCounterPrice,
  latestOfferPrice,
  type NegotiationRole,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { NegotiationMessage, VoiceNote } from "@/types/domain";
import { FlashList } from "@shopify/flash-list";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface NegotiationChatScreenProps {
  id?: string;
  simulateCutoff?: boolean;
}

/** Shared negotiation chat for both roles — the thread decides whose UI it is. */
export function NegotiationChatScreen({
  id,
  simulateCutoff = false,
}: NegotiationChatScreenProps) {
  const threadOrNull = useNegotiationThread(id);
  const { session } = useAuth();
  const [toast, setToast] = useToast();
  const [counterOpen, setCounterOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [acceptingPartially, setAcceptingPartially] = useState(false);
  const withdrawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (withdrawTimer.current) clearTimeout(withdrawTimer.current);
    },
    [],
  );

  const role: NegotiationRole = threadOrNull?.role ?? "buyer";
  const backendRole = resolveBackendRole(session?.user);
  if (threadOrNull && backendRole !== threadOrNull.role) {
    return <Redirect href={role === "seller" ? "/requirements" : "/browse"} />;
  }

  if (!threadOrNull) {
    return (
      <View style={styles.emptyScreen}>
        <BackButton fallback={role === "seller" ? "/orders" : "/trades"} />
        <Text style={styles.emptyText}>This negotiation is no longer available.</Text>
      </View>
    );
  }

  const thread = threadOrNull;
  const theirPrice = latestCounterPrice(thread);
  const remaining = countersRemaining(thread);
  const finalPrice = thread.trade?.price ?? thread.agreedPrice ?? latestOfferPrice(thread);
  const finalBags = thread.trade?.bags ?? thread.requestedBags;
  const partialAvailable = thread.availableBags > 0 && thread.requestedBags > thread.availableBags;
  const fallback = role === "seller" ? "/orders" : "/trades";

  function offersAllowed(): boolean {
    if (isOfferWindowOpen(new Date(), simulateCutoff)) return true;
    setCutoffOpen(true);
    return false;
  }

  function openCounter() {
    if (remaining > 0 && offersAllowed()) setCounterOpen(true);
  }

  function sendCounter(price: number, note?: string, voice?: VoiceNote) {
    submitCounter(thread.id, price, note, voice);
    setCounterOpen(false);
    setToast("Counter sent!");
  }

  function sendOffer(draft: OfferDraft) {
    const nextId = startOfferThread({
      role,
      counterparty: thread.counterparty,
      item: thread.item,
      category: thread.category,
      listedPrice: thread.listedPrice,
      availableBags: thread.availableBags,
      requestedBags: draft.bags,
      price: draft.price,
      bags: draft.bags,
      note: draft.note,
      voice: draft.voiceNote,
      weightKg: thread.weightKg,
      paymentTerms: thread.paymentTerms,
    });
    setOfferOpen(false);
    router.push({ pathname: "/negotiation/[id]", params: { id: nextId } });
  }

  function accept(bags: number) {
    acceptOffer(thread.id, bags);
    setToast("Offer accepted");
    router.push({ pathname: "/negotiation/confirm", params: { id: thread.id } });
  }

  function handleAccept() {
    if (partialAvailable) {
      setAcceptingPartially(true);
      setQtyOpen(true);
      return;
    }
    accept(thread.requestedBags);
  }

  function decline() {
    declineOffer(thread.id);
    setToast("Offer declined");
  }

  function withdraw() {
    withdrawOffer(thread.id);
    setToast("Offer withdrawn");
    if (withdrawTimer.current) clearTimeout(withdrawTimer.current);
    withdrawTimer.current = setTimeout(() => router.replace(fallback), 800);
  }

  function confirmPartial() {
    setQtyOpen(false);
    if (acceptingPartially) {
      accept(thread.availableBags);
    }
    setAcceptingPartially(false);
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
        <BackButton
          accessibilityLabel="Back to trades"
          fallback={fallback}
        />
        <View style={styles.headerText}>
          <Text style={styles.counterparty}>{thread.counterparty}</Text>
          <Text style={styles.item} numberOfLines={1}>
            {thread.item}
          </Text>
        </View>
        {thread.status === "your_turn" || thread.status === "waiting" ? (
          <Pressable
            onPress={withdraw}
            style={styles.withdrawButton}
            accessibilityRole="button"
            accessibilityLabel="Withdraw offer"
          >
            <Text style={styles.withdrawText}>Withdraw</Text>
          </Pressable>
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
              title={`Accept ${priceLabel(theirPrice ?? latestOfferPrice(thread))}`}
              onPress={handleAccept}
            />
            <View style={styles.actionRow}>
              <View style={styles.actionFlex}>
                <Button
                  title="Counter offer"
                  variant="secondary"
                  onPress={openCounter}
                  disabled={remaining <= 0}
                />
              </View>
              <View style={styles.actionFlex}>
                <Button title="Decline" variant="secondary" onPress={decline} />
              </View>
            </View>
            {remaining <= 0 ? (
              <Text style={styles.limitNote}>Counter limit reached (2/2)</Text>
            ) : null}
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
                  params: { id: thread.id },
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
                  ? "Negotiation cancelled"
                  : `Offer declined by ${role === "seller" ? "buyer" : "seller"}`}
              </Text>
            </View>
            <Button
              title="Make new offer"
              variant="secondary"
              onPress={() => {
                if (offersAllowed()) setOfferOpen(true);
              }}
            />
          </View>
        ) : null}
      </View>

      {counterOpen ? (
        <CounterSheet
          visible
          role={role}
          listedPrice={thread.listedPrice}
          theirOffer={theirPrice ?? latestOfferPrice(thread)}
          remaining={remaining}
          onClose={() => setCounterOpen(false)}
          onSubmit={sendCounter}
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
          onSubmit={sendOffer}
        />
      ) : null}

      <QtyMismatchDialog
        visible={qtyOpen}
        requestedBags={thread.requestedBags}
        availableBags={thread.availableBags}
        price={theirPrice ?? latestOfferPrice(thread)}
        onCancel={() => {
          setQtyOpen(false);
          setAcceptingPartially(false);
        }}
        onConfirm={confirmPartial}
      />

      <CutoffSheet visible={cutoffOpen} onClose={() => setCutoffOpen(false)} />
    </View>
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
    marginTop: spacing.xl,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  withdrawText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
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
