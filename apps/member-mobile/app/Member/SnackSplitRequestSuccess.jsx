import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../lib/api";

const SnackSplitRequestSuccess = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const SPLIT_TIMEOUT_SEC = 60;

  const totalPrice = Number(params?.totalPrice || 0);
  const memberCount = Number(params?.memberCount || 0);
  const orderDate = params?.orderDate ? String(params.orderDate) : "";
  const requestId = params?.requestId ? String(params.requestId) : "";
  const memberName = params?.memberName ? String(params.memberName) : "";
  const snackName = params?.snackName ? String(params.snackName) : "Multiple Snacks";
  const totalQuantity = Number(params?.quantity || 0);

  const displayDate = orderDate ? new Date(orderDate).toLocaleDateString("en-IN") : "";

  const startedAtRef = useRef(Date.now());
  const [timeLeftSec, setTimeLeftSec] = useState(SPLIT_TIMEOUT_SEC);
  const isPollingRef = useRef(false);
  const [splitFinalStatus, setSplitFinalStatus] = useState(null); // "Completed" | "Failed"
  const intervalsRef = useRef({ tick: null, poll: null });

  const stopPolling = () => {
    const { tick, poll } = intervalsRef.current || {};
    if (tick) clearInterval(tick);
    if (poll) clearInterval(poll);
    intervalsRef.current = { tick: null, poll: null };
  };

  useEffect(() => {
    if (!requestId) return;

    startedAtRef.current = Date.now();

    const tick = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const left = Math.max(0, SPLIT_TIMEOUT_SEC - elapsedSec);
      setTimeLeftSec(left);
    }, 250);

    // Poll split status periodically (avoid hammering backend /api).
    const poll = setInterval(async () => {
      if (isPollingRef.current) return;
      try {
        isPollingRef.current = true;
        const res = await api.get(`/api/bill-splits/${requestId}`);
        const status = String(res?.data?.status || "");

        if (status === "Completed") {
          stopPolling();
          setSplitFinalStatus("Completed");

          const snackOrderIds = Array.isArray(res?.data?.snackOrderIds)
            ? res.data.snackOrderIds
            : [];
          const ids = snackOrderIds.map((x) => String(x).trim()).filter(Boolean);
          const useBulk = ids.length !== 1;

          router.replace({
            pathname: "/Member/SnackPurchaseSuccess",
            params: {
              snackName,
              quantity: String(totalQuantity),
              totalPrice: String(totalPrice),
              orderId: useBulk ? "bulk" : ids[0],
              orderIds: ids.join(","),
              orderDate,
              memberName,
              splitMemberNames: Array.isArray(res?.data?.splitMembers)
                ? res.data.splitMembers
                    .map((m) => String(m?.name || "").trim())
                    .filter(Boolean)
                    .join(",")
                : "",
            },
          });
          return;
        }

        if (status === "Failed") {
          stopPolling();
          setSplitFinalStatus("Failed");
        }
      } catch (e) {
        // Keep polling; transient errors shouldn't block the flow.
        console.error("Split status poll error:", e);
      } finally {
        isPollingRef.current = false;
      }
    }, 5000);

    intervalsRef.current = { tick, poll };

    return () => {
      stopPolling();
    };
  }, [requestId, router, snackName, totalQuantity, totalPrice, orderDate, memberName]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.timerBanner}>
        <View style={styles.timerBannerInner}>
          <Ionicons name="timer-outline" size={18} color="#FFFFFF" />
          <Text style={styles.timerBannerText}>
            Waiting for approvals: {timeLeftSec}s
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="people-outline" size={66} color="#065F46" />
        </View>

        <Text style={styles.title}>Split Request Sent</Text>
        <Text style={styles.subtitle}>
          Your share has been recorded. Other members will approve their share before the bill is finalized.
        </Text>

        {splitFinalStatus === "Failed" && (
          <View style={styles.cancelCard}>
            <Text style={styles.cancelTitle}>Split Failed</Text>
            <Text style={styles.cancelSubtitle}>
              Not all selected members approved the split within time.
            </Text>
          </View>
        )}

        {!!totalPrice && (
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={styles.detailValue}>
                ₹{totalPrice.toLocaleString("en-IN")}
              </Text>
            </View>
            {!!memberCount && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Split Between</Text>
                <Text style={styles.detailValue}>{memberCount} members</Text>
              </View>
            )}
            {!!displayDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{displayDate}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => router.replace("/Member/SnackOrderPage")}
          >
            <Ionicons name="fast-food-outline" size={18} color="#111827" />
            <Text style={styles.secondaryButtonText}>Buy More Snacks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.replace("/Member/MemberDashboard")}
          >
            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SnackSplitRequestSuccess;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  timerBanner: {
    backgroundColor: "#111827",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  timerBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerBannerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 32,
    alignItems: "center",
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 20,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 26,
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
    fontWeight: "700",
    color: "#111827",
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelCard: {
    width: "100%",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 6,
  },
  cancelSubtitle: {
    fontSize: 13,
    color: "#7F1D1D",
    textAlign: "center",
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
    fontWeight: "700",
    color: "#111827",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
    gap: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

