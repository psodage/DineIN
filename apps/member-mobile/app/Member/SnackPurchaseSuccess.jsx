import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";

/** Expo Router may pass string | string[] for the same param. */
function normalizeRouterParam(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.length ? String(v[0]).trim() : "";
  return String(v).trim();
}

/** Comma-separated (URL-safe) or legacy JSON array string. */
function parseOrderIdsList(raw) {
  if (raw == null || raw === "") return [];
  const s = normalizeRouterParam(raw);
  if (!s) return [];
  try {
    if (s.startsWith("[")) {
      const maybe = JSON.parse(s);
      if (Array.isArray(maybe)) {
        return maybe.map((x) => String(x).trim()).filter(Boolean);
      }
    }
  } catch (_) {
    /* fall through */
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseNamesList(raw) {
  if (raw == null || raw === "") return [];
  const s = normalizeRouterParam(raw);
  if (!s) return [];
  try {
    if (s.startsWith("[")) {
      const maybe = JSON.parse(s);
      if (Array.isArray(maybe)) {
        return maybe.map((x) => String(x).trim()).filter(Boolean);
      }
    }
  } catch (_) {
    /* fall through */
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

const SnackPurchaseSuccess = () => {
  const router = useRouter();
  const {
    snackName,
    quantity,
    totalPrice,
    orderId,
    orderIds,
    orderDate,
    memberName,
    splitMemberNames,
    fromHistory,
  } = useLocalSearchParams();

  const fromHistoryRaw = Array.isArray(fromHistory)
    ? fromHistory[0]
    : fromHistory;
  const isFromHistory =
    fromHistoryRaw === "1" ||
    fromHistoryRaw === "true" ||
    String(fromHistoryRaw || "").toLowerCase() === "yes";

  const parsedQuantity = Number(quantity || 0);
  const parsedTotal = Number(totalPrice || 0);

  const orderIdStr = normalizeRouterParam(orderId);
  const parsedOrderIds = parseOrderIdsList(orderIds);
  const parsedSplitMemberNames = parseNamesList(splitMemberNames);

  /** Never show the literal "bulk" as a reference — use real Mongo ids only. */
  const referenceIds =
    orderIdStr && orderIdStr.toLowerCase() !== "bulk"
      ? [orderIdStr]
      : parsedOrderIds;

  const parsedOrderDate = orderDate ? new Date(orderDate) : null;
  const displayDate = parsedOrderDate
    ? parsedOrderDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  const hasQrPayload = referenceIds.length > 0;

  const qrValue = hasQrPayload
    ? JSON.stringify({
        orderId: referenceIds.length === 1 ? referenceIds[0] : "bulk",
        orderIds: referenceIds.length > 1 ? referenceIds : undefined,
        snackName,
        quantity: parsedQuantity,
        totalPrice: parsedTotal,
        memberName,
        splitMemberNames: parsedSplitMemberNames.length
          ? parsedSplitMemberNames
          : undefined,
        orderDate,
      })
    : null;

  const primaryReferenceId = referenceIds.length === 1 ? referenceIds[0] : "";
  const showReferenceIds = referenceIds.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons
            name={isFromHistory ? "receipt-outline" : "checkmark-circle"}
            size={72}
            color="#16A34A"
          />
        </View>
        <Text style={styles.title}>
          {isFromHistory ? "Order receipt" : "Purchase Successful"}
        </Text>

        <Text style={styles.subtitle}>
          {isFromHistory
            ? "Details for this snack order. Show the QR when collecting your snack."
            : "Your snack purchase has been recorded and added to your mess due."}
        </Text>

        {qrValue && (
          <View style={styles.qrCard}>

            <View style={styles.qrWrapper}>
              <QRCode value={qrValue} size={180} />
            </View>
          </View>
        )}

        <View style={styles.detailsCard}>
          {snackName ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Snack</Text>
              <Text style={styles.detailValue}>{snackName}</Text>
            </View>
          ) : null}

          {parsedQuantity > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{parsedQuantity}</Text>
            </View>
          ) : null}

          {parsedTotal > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={styles.detailValue}>
                ₹{parsedTotal.toLocaleString("en-IN")}
              </Text>
            </View>
          ) : null}

          {orderDate ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {new Date(orderDate).toLocaleString("en-IN")}
              </Text>
            </View>
          ) : null}

          {showReferenceIds ? (
            primaryReferenceId ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference ID</Text>
                <Text style={[styles.detailValueMono, styles.referenceIdSingle]} selectable>
                  {primaryReferenceId}
                </Text>
              </View>
            ) : (
              <View style={styles.referenceBlock}>
                <Text style={styles.detailLabel}>Reference IDs</Text>
                <ScrollView
                  style={styles.referenceScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {referenceIds.map((id) => (
                    <Text
                      key={id}
                      style={[styles.detailValueMono, styles.referenceLine]}
                      selectable
                    >
                      {id}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() =>
              isFromHistory ? router.back() : router.replace("/Member/SnackOrderPage")
            }
          >
            <Ionicons
              name={isFromHistory ? "arrow-back-outline" : "fast-food-outline"}
              size={18}
              color="#111827"
            />
            <Text style={styles.secondaryButtonText}>
              {isFromHistory ? "Back to history" : "Buy More Snacks"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.replace("/Member/MemberDashboard")}
          >
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SnackPurchaseSuccess;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 32,
    alignItems: "center",
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 24,
  },
  qrCard: {
    marginBottom: 24,
  },
  qrWrapper: {
    marginBottom: 16,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  detailValueMono: {
    fontSize: 13,
    color: "#111827",
    fontFamily: "monospace",
    maxWidth: "100%",
    textAlign: "right",
  },
  referenceIdSingle: {
    maxWidth: "62%",
  },
  referenceBlock: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    marginTop: 4,
  },
  referenceScroll: {
    maxHeight: 120,
    marginTop: 4,
  },
  referenceLine: {
    marginBottom: 6,
    textAlign: "right",
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#0F8F88",
    gap: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

