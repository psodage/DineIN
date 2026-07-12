import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading";

const SnackOrderPage = ({ embedded = false }) => {
  const router = useRouter();

  const [studentId, setStudentId] = useState(null);
  const [memberName, setMemberName] = useState("");
  const [snacks, setSnacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const placingOrderRef = useRef(false);
  const [quantities, setQuantities] = useState({});

  const getSnackKey = (snack) => String(snack?._id || snack?.id || "");

  const getSnackStock = (snack) => {
    // Prefer product quantity; fall back to common stock aliases seen in legacy payloads.
    const rawStock =
      snack?.quantity ??
      snack?.availableQuantity ??
      snack?.stock ??
      snack?.inStock;
    const stock = Number(rawStock);
    if (!Number.isFinite(stock)) return Number.POSITIVE_INFINITY;
    if (snack?.availability === false) return 0;
    return Math.max(0, Math.floor(stock));
  };

  const getSnackAvailableLabel = (snack, selectedQty = 0) => {
    const availability = snack?.availability !== false;
    if (!availability) return "0";
    const stock = getSnackStock(snack);
    if (!Number.isFinite(stock)) return "Unlimited";
    const remaining = Math.max(0, stock - Math.max(0, Number(selectedQty) || 0));
    return String(remaining);
  };

  const loadStudentContext = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const id = parsed?._id || parsed?.id || parsed?.memberId;
        setStudentId(id ? String(id) : null);
        const name =
          parsed?.name ||
          parsed?.fullName ||
          parsed?.studentName ||
          parsed?.email;
        setMemberName(name ? String(name) : "");
      } else {
        setStudentId(null);
        setMemberName("");
      }
    } catch (error) {
      console.error("Failed to load studentId from storage:", error);
    }
  }, []);

  useEffect(() => {
    loadStudentContext();
  }, [loadStudentContext]);

  const fetchSnacks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await api.get("/api/snack-products", {
        params: { available: "true" },
      });

      let items = Array.isArray(res.data) ? res.data : [];
      items = items.filter(
        (s) => s.availability !== false && getSnackStock(s) >= 1
      );

      setSnacks(items);
    } catch (error) {
      console.error("Failed to load snack products:", error);
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to load snacks."
      );
      setSnacks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSnacks();
  }, [fetchSnacks]);

  const refreshPage = useCallback(async () => {
    setRefreshing(true);
    try {
      // Full-page refresh should reload session-bound member context
      // and latest snack inventory, then reset transient cart UI state.
      await loadStudentContext();
      await fetchSnacks(true);
      setQuantities({});
    } finally {
      setRefreshing(false);
    }
  }, [loadStudentContext, fetchSnacks]);

  const getQuantity = (id) => {
    const key = String(id);
    const raw = quantities[key];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 0;
    // Quantity is always an integer in the UI (increment/decrement by 1),
    // but we still guard against any unexpected stored values.
    return Math.floor(n);
  };

  const updateQuantity = (id, delta) => {
    const key = String(id);
    setQuantities((prev) => {
      const current = prev[key] || 0;
      const next = current + delta;
      const clamped = next < 0 ? 0 : Math.floor(next);
      return { ...prev, [key]: clamped };
    });
  };

  const visibleSnacks = snacks.filter(
    (s) => s.availability !== false && getSnackStock(s) >= 1
  );
  const cartItems = visibleSnacks.filter((s) => getQuantity(getSnackKey(s)) > 0);
  const totalItems = cartItems.reduce(
    (sum, s) => sum + getQuantity(getSnackKey(s)),
    0
  );
  const cartTotal = cartItems.reduce(
    (sum, s) => sum + Number(s.price || 0) * getQuantity(getSnackKey(s)),
    0
  );

  const handleBulkOrder = async () => {
    if (placingOrderRef.current) return;

    if (!studentId) {
      Alert.alert(
        "Missing Member",
        "Unable to find your member account. Please log in again."
      );
      return;
    }

    const orderPayload = snacks
      .map((s) => {
        const snackKey = getSnackKey(s);
        const quantity = getQuantity(snackKey);
        const stock = getSnackStock(s);
        return {
          snackId: snackKey,
          quantity,
          _stock: stock,
        };
      })
      .filter((x) => x.quantity >= 1);

    if (orderPayload.length === 0) {
      Alert.alert("Validation", "Please select at least one snack.");
      return;
    }

    // Prevent ordering more than available stock.
    const invalidStock = orderPayload.find((x) => x.quantity > x._stock);
    if (invalidStock) {
      const snack = snacks.find(
        (s) => String(s._id) === String(invalidStock.snackId)
      );
      const name = snack?.name || "Snack";
      const available = invalidStock._stock;
      Alert.alert(
        "Stock Limit",
        `${name} only has ${Number(available) || 0} available. Please reduce quantity.`
      );
      return;
    }

    try {
      placingOrderRef.current = true;
      setIsPlacingOrder(true);

      const orderTotal = cartTotal;
      const orderDate = new Date().toISOString();

      const res = await api.post("/api/snack-orders/bulk-order", {
        studentId,
        orders: orderPayload.map((x) => ({
          snackId: x.snackId,
          quantity: x.quantity,
        })),
        date: orderDate,
      });

      const { orders, totalAmount } = res?.data || {};
      const rawOrders = Array.isArray(orders) ? orders : [];
      const orderIds = rawOrders
        .map((o) => String(o?.referenceId || o?._id || "").trim())
        .filter(Boolean);
      const finalOrderTotal = totalAmount || orderTotal;
      const useBulk = orderIds.length !== 1;

      let snackName = "Multiple Snacks";
      if (orderPayload.length === 1) {
        snackName = snacks.find((s) => s._id === orderPayload[0].snackId)?.name || snackName;
      }

      // Comma-separated IDs survive URL/query serialization better than JSON.stringify.
      const orderIdsParam = orderIds.join(",");

      router.push({
        pathname: "/Member/SnackPurchaseSuccess",
        params: {
          snackName,
          quantity: String(totalItems),
          totalPrice: String(finalOrderTotal),
          orderId: useBulk ? "bulk" : orderIds[0],
          orderIds: orderIdsParam,
          orderDate,
          memberName: memberName || "",
        },
      });

      setQuantities({});
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      console.error("Failed to place snack order:", backendMessage || error);
      Alert.alert(
        "Error",
        backendMessage || "Failed to place snack order."
      );
    } finally {
      placingOrderRef.current = false;
      setIsPlacingOrder(false);
    }
  };

  const renderSnackCard = ({ item }) => {
    const snackKey = getSnackKey(item);
    const quantity = getQuantity(snackKey);
    const price = Number(item.price || 0);
    const maxStock = getSnackStock(item);
    const canIncrease =
      item?.availability !== false && maxStock > 0 && quantity < maxStock;

    return (
      <View style={styles.snackCard}>
        <View style={styles.snackTopRow}>
          <View style={styles.thumbnailWrap}>
            <Ionicons name="fast-food-outline" size={34} color="#0F8F88" />
            <View style={styles.availableBadge}>
              <Text style={styles.availableBadgeText}>
                Qty: {getSnackAvailableLabel(item, quantity)}
              </Text>
            </View>
          </View>

          <View style={styles.detailsCol}>
            <Text style={styles.snackName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.categoryRow}>
              <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
              <Text style={styles.snackCategory}>
                Category: {item.category || "Food"}
              </Text>
            </View>

            <View style={styles.priceQtyRow}>
              <Text style={styles.snackPrice}>₹{price.toLocaleString("en-IN")}</Text>
              <View style={styles.qtyPill}>
                <TouchableOpacity
                  style={styles.qtyCircleButton}
                  onPress={() => updateQuantity(snackKey, -1)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="remove" size={16} color="#475569" />
                </TouchableOpacity>
                <View
                  style={[
                    styles.qtyValueWrap,
                    quantity > 0 && styles.qtyValueWrapActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.qtyValue,
                      quantity > 0 && styles.qtyValueActive,
                    ]}
                  >
                    {quantity}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.qtyCircleButton,
                    !canIncrease && styles.qtyCircleButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!canIncrease) return;
                    updateQuantity(snackKey, 1);
                  }}
                  activeOpacity={0.75}
                  disabled={!canIncrease}
                >
                  <Ionicons name="add" size={16} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.itemTotalRow}>
          <Text style={styles.itemTotalLabel}>Item Total</Text>
          <Text style={styles.itemTotalAmount}>
            ₹{(price * quantity).toLocaleString("en-IN")}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={embedded ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}
    >
      <View style={styles.headerBackground}>
        <Ionicons
          name="fast-food-outline"
          size={58}
          color="rgba(255,255,255,0.09)"
          style={styles.patternTopLeft}
        />
        <Ionicons
          name="wine-outline"
          size={48}
          color="rgba(255,255,255,0.09)"
          style={styles.patternTopRight}
        />
        <Ionicons
          name="restaurant-outline"
          size={52}
          color="rgba(255,255,255,0.09)"
          style={styles.patternBottomRight}
        />
      </View>

      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          {!embedded ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#0F8F88" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}

          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => router.push("/Member/SnackOrderHistory")}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={16} color="#0F8F88" />
            <Text style={styles.historyLinkText}>Order History</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Extra Snacks</Text>
        <Text style={styles.subtitle}>
          Choose your favorite snacks{"\n"}and place your order 
        </Text>
      </View>

      <View style={styles.mainPanel}>
        <FlatList
          data={visibleSnacks}
          keyExtractor={(item) => getSnackKey(item) || String(Math.random())}
          renderItem={renderSnackCard}
          extraData={quantities}
          contentContainerStyle={[
            styles.listContent,
            totalItems > 0 && { paddingBottom: 220 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshPage}
              tintColor="#0F8F88"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>No snacks available right now.</Text>
            </View>
          }
        />
      </View>

      <FullScreenLoading visible={loading && !refreshing} color="#0F8F88" />

      {totalItems > 0 && (
        <View style={[styles.floatingCart, embedded && styles.floatingCartEmbedded]}>
          <View style={styles.cartLeft}>
            <Text style={styles.totalAmountLabel}>Total Amount</Text>
            <Text style={styles.cartTotalText}>₹{cartTotal.toLocaleString("en-IN")}</Text>
            <Text style={styles.cartItemsText}>
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.placeOrderButton}
            onPress={handleBulkOrder}
            disabled={isPlacingOrder}
            activeOpacity={0.85}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#0F8F88" />
            ) : (
              <View style={styles.placeOrderButtonContent}>
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                <Ionicons name="chevron-forward" size={17} color="#0F8F88" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SnackOrderPage;

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
    height: 280,
    backgroundColor: "#0F8F88",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  patternTopLeft: {
    position: "absolute",
    top: 16,
    left: 22,
  },
  patternTopRight: {
    position: "absolute",
    top: 30,
    right: 56,
  },
  patternBottomRight: {
    position: "absolute",
    top: 102,
    right: 24,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B6A65",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
    color: "rgba(255,255,255,0.96)",
  },
  mainPanel: {
    flex: 1,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    marginBottom:-15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 106,
  },
  snackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  snackTopRow: {
    flexDirection: "row",
    gap: 9,
  },
  thumbnailWrap: {
    width: 86,
    height: 82,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  availableBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#BBF7D0",
    alignItems: "center",
  },
  availableBadgeText: {
    color: "#166534",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },
  detailsCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  snackName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  snackCategory: {
    fontSize: 11,
    lineHeight: 14,
    color: "#6B7280",
  },
  priceQtyRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  snackPrice: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#0F8F88",
  },
  qtyPill: {
    height: 42,
    minWidth: 132,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyCircleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qtyCircleButtonDisabled: {
    opacity: 0.4,
  },
  qtyValueWrap: {
    minWidth: 46,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValueWrapActive: {
    backgroundColor: "#0F8F88",
    borderRadius: 999,
  },
  qtyValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  qtyValueActive: {
    color: "#FFFFFF",
  },
  itemTotalRow: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTotalLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  itemTotalAmount: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "800",
    color: "#0F8F88",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  infoCard: {
    marginTop: 2,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: "#DFF5EF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoCardText: {
    flex: 1,
    color: "#0E7490",
    fontSize: 13,
    fontWeight: "500",
  },
  floatingCart: {
    position: "absolute",
    bottom: 18,
    left: 16,
    right: 16,
    backgroundColor: "#0F8F88",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
  },
  floatingCartEmbedded: {
    bottom: 78,
    marginBottom: 12,
  },
  cartLeft: {
    flex: 1,
    paddingRight: 8,
  },
  totalAmountLabel: {
    color: "#E6FFFB",
    fontSize: 12,
    fontWeight: "600",
  },
  cartTotalText: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  cartItemsText: {
    color: "#D7F4EF",
    fontSize: 12,
    marginTop: 1,
    fontWeight: "600",
  },
  placeOrderButton: {
    backgroundColor: "#FFFFFF",
    minWidth: 124,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    justifyContent: "center",
  },
  placeOrderButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  placeOrderButtonText: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },

  splitBillLink: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  splitBillLinkText: {
    color: "#0F8F88",
    fontSize: 11,
    fontWeight: "700",
  },

  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-end",
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F8F88",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  memberSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "#F9FAFB",
    height: 44,
    marginBottom: 10,
  },
  memberSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
  },
  memberSuggestionsBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    maxHeight: 180,
  },
  memberSuggestionEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#6B7280",
  },
  memberSuggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memberSuggestionName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  memberSuggestionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },
  selectedMembersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 14,
  },
  selectedMembersScroll: {
    maxHeight: 130,
    marginBottom: 4,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ECFDF5",
    borderColor: "#DCFCE7",
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: "100%",
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
    maxWidth: 160,
  },
  noSelectedText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryModalButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryModalButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  primaryModalButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryModalButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

