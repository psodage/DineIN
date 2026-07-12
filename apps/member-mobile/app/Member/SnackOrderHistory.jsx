import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useRouter } from "expo-router";
import FullScreenLoading from "../../components/FullScreenLoading";

const SnackOrderHistory = () => {
  const router = useRouter();

  const [studentId, setStudentId] = useState(null);
  const [memberName, setMemberName] = useState("");
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const getDisplayTotal = (item) => {
    const chargedRaw = item?.chargedAmount;
    const hasChargedAmount = chargedRaw !== null && chargedRaw !== undefined;
    if (hasChargedAmount) {
      const charged = Number(chargedRaw);
      if (Number.isFinite(charged) && charged >= 0) return charged;
    }
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.snackId?.price || 0);
    return qty * price;
  };

  const formatOrderDate = (value) => {
    try {
      const d = value ? new Date(value) : null;
      if (!d || Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (_) {
      return "";
    }
  };

  const getGroupLabel = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "Earlier";

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 7);

    if (d >= startToday && d < startTomorrow) return "Today";
    if (d >= startWeek) return "This Week";
    return "Earlier";
  };

  const displayOrders = useMemo(() => {
    if (!Array.isArray(orderHistory) || orderHistory.length === 0) return [];

    const grouped = [];
    const splitGroups = new Map();

    orderHistory.forEach((order) => {
      const commonOrderId = String(order?.commonOrderId || "").trim();
      const isSplitBill = !!order?.billSplitRequestId && !!commonOrderId;

      if (!isSplitBill) {
        grouped.push(order);
        return;
      }

      const refId = String(order?.purchaseReference || order?._id || "").trim();
      const existing = splitGroups.get(commonOrderId);
      if (!existing) {
        splitGroups.set(commonOrderId, {
          _id: `split-${commonOrderId}`,
          isGroupedSplit: true,
          billSplitRequestId: order?.billSplitRequestId,
          commonOrderId,
          date: order?.date,
          snackNames: [String(order?.snackId?.name || "Snack")],
          quantity: Number(order?.quantity || 0),
          totalPrice: Number(getDisplayTotal(order) || 0),
          orderIds: refId ? [refId] : [],
        });
        return;
      }

      existing.quantity += Number(order?.quantity || 0);
      existing.totalPrice += Number(getDisplayTotal(order) || 0);
      if (order?.date && new Date(order.date) > new Date(existing.date)) {
        existing.date = order.date;
      }
      existing.snackNames.push(String(order?.snackId?.name || "Snack"));
      if (refId) existing.orderIds.push(refId);
    });

    const merged = [...grouped, ...Array.from(splitGroups.values())];
    merged.sort((a, b) => {
      const ad = new Date(a?.date || a?.createdAt || 0).getTime();
      const bd = new Date(b?.date || b?.createdAt || 0).getTime();
      return bd - ad;
    });
    return merged;
  }, [orderHistory]);

  const groupedDisplayRows = useMemo(() => {
    const rows = [];
    let currentLabel = "";
    displayOrders.forEach((item) => {
      const label = getGroupLabel(item?.date || item?.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        rows.push({ _id: `section-${label}`, rowType: "section", label });
      }
      rows.push({ ...item, rowType: "order" });
    });
    return rows;
  }, [displayOrders]);

  useEffect(() => {
    const loadStudentId = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) {
          setError(new Error("Missing member session. Please log in again."));
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(storedUser);
        const id = parsed?._id || parsed?.id || parsed?.memberId;
        if (id) {
          setStudentId(String(id));
        } else {
          setError(new Error("Missing member id. Please log in again."));
          setLoading(false);
        }

        const name =
          parsed?.name ||
          parsed?.fullName ||
          parsed?.studentName ||
          parsed?.email;
        if (name) setMemberName(String(name));
      } catch (e) {
        console.error("Failed to load studentId from storage:", e);
        setError(e);
        setLoading(false);
      }
    };

    loadStudentId();
  }, []);

  const fetchOrderHistory = useCallback(async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(`/api/snack-orders/orders/${studentId}`);
      const items = Array.isArray(res.data) ? res.data : [];
      setOrderHistory(items);
    } catch (e) {
      console.error("Failed to fetch snack order history:", e);
      setError(e);
      setOrderHistory([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  const openOrderReceipt = (item) => {
    const isGroupedSplit = !!item?.isGroupedSplit;
    const qty = Number(item?.quantity || 0);
    const total = isGroupedSplit
      ? Number(item?.totalPrice || 0)
      : getDisplayTotal(item);
    const orderIds = isGroupedSplit
      ? (Array.isArray(item?.orderIds) ? item.orderIds : []).filter(Boolean)
      : [String(item?.purchaseReference || item?._id || "").trim()].filter(Boolean);
    if (orderIds.length === 0) return;
    const refId = orderIds.length === 1 ? orderIds[0] : "";

    const orderDate =
      item?.date != null
        ? new Date(item.date).toISOString()
        : new Date().toISOString();

    const snackName = isGroupedSplit
      ? (() => {
          const names = Array.isArray(item?.snackNames) ? item.snackNames : [];
          if (names.length === 0) return "Split Snack Order";
          if (names.length === 1) return names[0];
          return `${names[0]} +${names.length - 1} more`;
        })()
      : item?.snackId?.name || "Snack";

    router.push({
      pathname: "/Member/SnackPurchaseSuccess",
      params: {
        snackName,
        quantity: String(qty),
        totalPrice: String(total),
        orderId: refId,
        orderIds: JSON.stringify(orderIds),
        orderDate,
        memberName: memberName || "",
        fromHistory: "1",
      },
    });
  };

  const renderRow = ({ item }) => {
    if (item?.rowType === "section") {
      return (
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupHeaderText}>{item.label}</Text>
        </View>
      );
    }

    const qty = Number(item?.quantity || 0);
    const total = item?.isGroupedSplit
      ? Number(item?.totalPrice || 0)
      : getDisplayTotal(item);
    const isSplitBill = !!item?.billSplitRequestId;
    const formattedDate = formatOrderDate(item?.date);
    const orderTitle = item?.isGroupedSplit
      ? (() => {
          const names = Array.isArray(item?.snackNames) ? item.snackNames : [];
          if (names.length === 0) return "Split Snack Order";
          if (names.length === 1) return names[0];
          return `${names[0]} +${names.length - 1} more`;
        })()
      : item?.snackId?.name || "Snack";
    const categoryText = item?.isGroupedSplit
      ? "Combined split snack orders"
      : item?.snackId?.category || "Snack item";
    const imageUri = item?.snackId?.imageUrl || item?.snackId?.image || item?.snackId?.thumbnail;
    const statusLabel = isSplitBill ? "Added to Bill" : "Delivered";

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.75}
        onPress={() => openOrderReceipt(item)}
      >
        <View style={styles.orderCardTop}>
          <View style={styles.orderThumbWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.orderThumb} />
            ) : (
              <Ionicons name="fast-food-outline" size={22} color="#0F8F88" />
            )}
          </View>

          <View style={styles.orderMainInfo}>
            <Text style={styles.orderSnackName} numberOfLines={1}>
              {orderTitle}
            </Text>
            <Text style={styles.orderMeta} numberOfLines={1}>
              {formattedDate || "Recent order"} • Qty: {qty}
            </Text>
            <Text style={styles.orderCategory} numberOfLines={1}>
              {categoryText}
            </Text>
          </View>

          <View style={styles.orderRightCol}>
            <Text style={styles.orderTotal}>₹{total.toLocaleString("en-IN")}</Text>
            <View style={[styles.statusPill, isSplitBill && styles.statusPillBill]}>
              <Text style={[styles.statusPillText, isSplitBill && styles.statusPillTextBill]}>
                {statusLabel}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </View>
        </View>

        <View style={styles.orderCardBottom}>
          <Text style={styles.orderBottomText}>
            Ordered on: {formattedDate || "-"}
          </Text>
          <Text style={styles.orderBottomText}>Qty: {qty}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRetry = () => {
    if (!studentId) {
      Alert.alert("Missing member", "Please log in again.");
      return;
    }
    fetchOrderHistory();
  };

  const handleRefresh = useCallback(async () => {
    if (!studentId || loading) return;
    setRefreshing(true);
    await fetchOrderHistory();
    setRefreshing(false);
  }, [fetchOrderHistory, loading, studentId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBackground}>
        <Ionicons
          name="fast-food-outline"
          size={64}
          color="rgba(255,255,255,0.11)"
          style={styles.patternTopLeft}
        />
        <Ionicons
          name="restaurant-outline"
          size={58}
          color="rgba(255,255,255,0.10)"
          style={styles.patternTopRight}
        />
        <Ionicons
          name="pizza-outline"
          size={52}
          color="rgba(255,255,255,0.09)"
          style={styles.patternBottomRight}
        />
      </View>

      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#0F8F88" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerPill} onPress={handleRefresh} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={14} color="#0F8F88" />
            <Text style={styles.headerPillText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Order History</Text>
        <Text style={styles.subtitle}>View your recent snack orders</Text>
      </View>

      <View style={styles.mainPanel}>
        {error ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="alert-circle-outline" size={40} color="#F59E0B" />
            </View>
            <Text style={styles.emptyTitle}>Failed to load history</Text>
            <Text style={styles.emptySubtitle}>Please try again in a moment.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : displayOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="fast-food-outline" size={38} color="#0F8F88" />
            </View>
            <Text style={styles.emptyTitle}>No snack orders yet</Text>
            <Text style={styles.emptySubtitle}>
              Your placed snack orders will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedDisplayRows}
            keyExtractor={(item) => String(item?._id)}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#0F8F88"
              />
            }
            ListHeaderComponent={
              <View style={styles.sectionHeaderCard}>
                <View>
                  <Text style={styles.sectionTitle}>Recent Orders</Text>
                  <Text style={styles.sectionSubtitle}>Track your snack purchases</Text>
                </View>
                <View style={styles.orderCountBadge}>
                  <Text style={styles.orderCountText}>
                    {displayOrders.length} Order{displayOrders.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
            }
          />
        )}
      </View>

      <FullScreenLoading visible={loading} color="#0F8F88" />
    </SafeAreaView>
  );
};

export default SnackOrderHistory;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 262,
    backgroundColor: "#0F8F88",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  patternTopLeft: {
    position: "absolute",
    top: 16,
    left: 22,
    transform: [{ rotate: "-8deg" }],
  },
  patternTopRight: {
    position: "absolute",
    top: 36,
    right: 50,
    transform: [{ rotate: "9deg" }],
  },
  patternBottomRight: {
    position: "absolute",
    top: 120,
    right: 24,
    transform: [{ rotate: "-12deg" }],
  },
  headerContent: {
    marginTop:20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B6A65",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F8F88",
  },
  title: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    color: "rgba(255,255,255,0.96)",
  },
  mainPanel: {
    flex: 1,
    marginTop: 10,
    marginBottom:-15,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionHeaderCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  orderCountBadge: {
    backgroundColor: "#E6F7F5",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  orderCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F8F88",
  },
  groupHeaderRow: {
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupHeaderText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F8F88",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  orderCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orderThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orderThumb: {
    width: "100%",
    height: "100%",
  },
  orderMainInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderSnackName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  orderCategory: {
    marginTop: 2,
    fontSize: 12,
    color: "#94A3B8",
  },
  orderRightCol: {
    alignItems: "flex-end",
    gap: 5,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F8F88",
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillBill: {
    backgroundColor: "#E0F2FE",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  statusPillTextBill: {
    color: "#075985",
  },
  orderCardBottom: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderBottomText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: "#0F8F88",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
