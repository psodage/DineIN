import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import LanguageToggle from "../../components/LanguageToggle";
import { getMonthLabel } from "../../lib/monthLabels";
import { fetchMemberDirectory } from "../../lib/memberDirectory";
import {
  clampYearMonthToSelectableWindow,
  combineMinYearMonth,
  getCurrentYearMonth,
  getMaxSelectableYearMonth,
  stepNextYearMonth,
  stepPrevYearMonth,
} from "../../lib/monthNavigation";

const formatDisplayDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCardDate = (d, lang) => {
  const date = d instanceof Date ? d : new Date(d);
  if (lang === "mr") {
    return date.toLocaleDateString("mr-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return formatDisplayDate(d);
};

const formatCurrency = (amount) =>
  `\u20b9${Number(amount).toLocaleString("en-IN")}`;

const resolveDisplayTotal = (order) => {
  const charged = Number(order?.chargedAmount);
  if (Number.isFinite(charged) && charged >= 0) return charged;
  const qty = Number(order?.quantity || 0);
  const price = Number(order?.pricePerItem || 0);
  return qty * price;
};

const INITIAL_FORM = {
  customerName: "",
  customerType: "outside",
  studentId: "",
  snackItem: "",
  snackItemId: "",
  quantity: 1,
  pricePerItem: "",
  orderDate: new Date(),
};

const INITIAL_CART_ITEM = {
  snackItem: "",
  snackItemId: "",
  quantity: 1,
  pricePerItem: "",
};

const FILTER_OPTIONS = ["all", "members", "outside", "split"];

export default function ExtraSnacks() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  const [snacks, setSnacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [snackCatalog, setSnackCatalog] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [showSnackPicker, setShowSnackPicker] = useState(false);
  const [snackSearch, setSnackSearch] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const toastTimeout = useRef(null);

  const showToast = useCallback(
    (message, type = "success") => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      setToastMessage(message);
      setToastType(type);
      Animated.spring(toastAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
      toastTimeout.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, 3000);
    },
    [toastAnim]
  );

  const fetchSnacks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/snacks");
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalized = raw.map((s) => ({
        ...s,
        studentName:
          s?.studentName || s?.memberName || s?.customerName || s?.studentId?.name || "",
        studentNameMr:
          s?.studentNameMr ||
          s?.memberNameMr ||
          s?.customerNameMr ||
          s?.studentId?.nameMr ||
          "",
      }));
      setSnacks(normalized);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err.response?.data?.message || t("extra_snacks_alert_fetch_orders_failed")
      );
      setSnacks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const rows = await fetchMemberDirectory(api);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message || t("extra_snacks_alert_fetch_members_failed")
      );
      setMembers([]);
    }
  };

  const fetchSnackCatalog = async () => {
    try {
      const res = await api.get("/api/snack-products");
      setSnackCatalog(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSnackCatalog([]);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) {
      fetchSnacks();
      fetchMembers();
      fetchSnackCatalog();
    }
  }, [authLoading, isAuthenticated]);

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const search = memberSearch.trim().toLowerCase();
    const name = (language === "mr" ? m.nameMr || m.name : m.name) || "";
    const nameLower = String(name).toLowerCase();
    const roll = (m.rollNumber || "").toLowerCase();
    const room = (m.roomNumber || m.roomOwnerName || "").toLowerCase();
    const owner =
      (language === "mr" ? m.roomOwnerNameMr || m.roomOwnerName : m.roomOwnerName) || "";
    const ownerLower = String(owner).toLowerCase();
    return (
      nameLower.includes(search) ||
      roll.includes(search) ||
      room.includes(search) ||
      ownerLower.includes(search)
    );
  });

  const filteredSnackCatalog = snackCatalog.filter((s) => {
    if (!snackSearch.trim()) return true;
    const search = snackSearch.trim().toLowerCase();
    const name = (language === "mr" ? s.nameMr || s.name : s.name) || "";
    return String(name).toLowerCase().includes(search);
  });

  const snackMonths = snacks
    .map((s) => {
      const d = new Date(s.date);
      return d.getFullYear() * 12 + d.getMonth();
    })
    .filter((ym) => !Number.isNaN(ym));

  const minSnackMonth = combineMinYearMonth(
    snackMonths.length > 0 ? Math.min(...snackMonths) : getCurrentYearMonth(0)
  );

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(m, minSnackMonth, getMaxSelectableYearMonth())
    );
  }, [minSnackMonth, snacks.length]);

  const monthSnacks = snacks.filter((s) => {
    const d = new Date(s.date);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

  const displaySnacks = useMemo(() => {
    const memberDisplay = (o) =>
      language === "mr" ? o?.studentNameMr || o?.studentName : o?.studentName;
    const snackDisplay = (o) =>
      language === "mr" ? o?.snackItemMr || o?.snackItem : o?.snackItem;

    const normal = [];
    const splitGroupsById = new Map();

    for (const o of monthSnacks || []) {
      const billSplitRequestId = o?.billSplitRequestId;
      const isSplit = !!billSplitRequestId;
      if (!isSplit) {
        normal.push(o);
        continue;
      }
      const splitId = String(billSplitRequestId);
      const existing = splitGroupsById.get(splitId);
      const displayMemberName = memberDisplay(o) || "Member";
      const displaySnackName = snackDisplay(o) || "Snack";
      const orderId = String(o?._id || "");
      if (!existing) {
        splitGroupsById.set(splitId, {
          _id: `split-${splitId}`,
          isSplitGroup: true,
          billSplitRequestId: splitId,
          orderIds: orderId ? [orderId] : [],
          items: [o],
          memberNames: [displayMemberName],
          snackNames: [displaySnackName],
          quantityTotal: Number(o?.quantity || 0),
          totalPrice: resolveDisplayTotal(o),
          date: o?.date ? new Date(o.date) : null,
        });
      } else {
        existing.items.push(o);
        if (orderId) existing.orderIds.push(orderId);
        existing.quantityTotal += Number(o?.quantity || 0);
        existing.totalPrice += resolveDisplayTotal(o);
        existing.memberNames.push(displayMemberName);
        existing.snackNames.push(displaySnackName);
        if (o?.date) {
          const d = new Date(o.date);
          if (!Number.isNaN(d.getTime()) && (!existing.date || d > existing.date)) {
            existing.date = d;
          }
        }
      }
    }

    const splitGroups = Array.from(splitGroupsById.values()).map((g) => {
      const uniqMembers = Array.from(new Set(g.memberNames.filter(Boolean)));
      const uniqSnackNames = Array.from(new Set(g.snackNames.filter(Boolean)));
      const memberPreview = uniqMembers.slice(0, 3).join(", ");
      const memberOverflow = Math.max(0, uniqMembers.length - 3);
      const snackPreview = uniqSnackNames.slice(0, 2).join(" + ");
      const snackOverflow = Math.max(0, uniqSnackNames.length - 2);
      return {
        ...g,
        memberNames: uniqMembers,
        snackNames: uniqSnackNames,
        memberPreview,
        memberOverflow,
        snackPreview,
        snackOverflow,
        date: g.date || new Date(),
      };
    });

    const normalizedNormal = (normal || []).map((o) => ({
      ...o,
      _sortDate: o?.date ? new Date(o.date) : new Date(0),
    }));
    const normalizedSplit = splitGroups.map((g) => ({
      ...g,
      _sortDate: g.date ? new Date(g.date) : new Date(0),
    }));

    let merged = [...normalizedNormal, ...normalizedSplit].sort((a, b) => {
      const ad = a?._sortDate?.getTime?.() || 0;
      const bd = b?._sortDate?.getTime?.() || 0;
      return bd - ad;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      merged = merged.filter((item) => {
        if (item.isSplitGroup) {
          return (
            (item.memberNames || []).some((n) => n.toLowerCase().includes(q)) ||
            (item.snackNames || []).some((n) => n.toLowerCase().includes(q))
          );
        }
        return (
          (item.studentName || "").toLowerCase().includes(q) ||
          (item.studentNameMr || "").toLowerCase().includes(q) ||
          (item.snackItem || "").toLowerCase().includes(q)
        );
      });
    }

    if (activeFilter === "members") {
      merged = merged.filter((item) => !item.isSplitGroup && !item.isOutsideCustomer);
    } else if (activeFilter === "outside") {
      merged = merged.filter((item) => !item.isSplitGroup && item.isOutsideCustomer);
    } else if (activeFilter === "split") {
      merged = merged.filter((item) => item.isSplitGroup);
    }

    return merged.map(({ _sortDate, ...rest }) => rest);
  }, [monthSnacks, language, searchQuery, activeFilter]);

  const totalMonthRevenue = monthSnacks.reduce(
    (sum, s) => sum + resolveDisplayTotal(s),
    0
  );
  const totalMonthOrders = monthSnacks.length;
  const memberRevenue = monthSnacks
    .filter((s) => !s.isOutsideCustomer)
    .reduce((sum, s) => sum + resolveDisplayTotal(s), 0);
  const outsideRevenue = monthSnacks
    .filter((s) => s.isOutsideCustomer)
    .reduce((sum, s) => sum + resolveDisplayTotal(s), 0);

  const totalPrice = (() => {
    const q = Number(form.quantity);
    const p = Number(form.pricePerItem);
    if (!Number.isFinite(q) || !Number.isFinite(p) || q < 0 || p < 0) return 0;
    return q * p;
  })();

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0
  );

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...INITIAL_FORM, orderDate: new Date() });
    setCartItems([]);
    setErrors({});
    setShowMemberPicker(false);
    setShowSnackPicker(false);
    setMemberSearch("");
    setSnackSearch("");
    setFormVisible(true);
  };

  const openEditForm = (snack) => {
    setEditingId(snack._id);
    setForm({
      customerName: snack.isOutsideCustomer
        ? language === "mr"
          ? (snack.studentNameMr || snack.studentName || "").trim()
          : (snack.studentName || snack.studentNameMr || "").trim()
        : snack.studentName || snack.studentNameMr || "",
      customerType: snack.isOutsideCustomer ? "outside" : "member",
      studentId: snack.studentId || "",
      snackItem: snack.snackItem || "",
      snackItemId: snack.snackItemId || "",
      quantity: Number(snack.quantity || 1),
      pricePerItem: String(snack.pricePerItem ?? ""),
      orderDate: snack.date ? new Date(snack.date) : new Date(),
    });
    setErrors({});
    setShowMemberPicker(false);
    setShowSnackPicker(false);
    setMemberSearch("");
    setSnackSearch("");
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setCartItems([]);
    setShowMemberPicker(false);
    setShowSnackPicker(false);
    setShowDatePicker(false);
  };

  const validate = (mode = "save") => {
    const e = {};
    if (form.customerType === "outside") {
      if (!form.customerName?.trim()) {
        e.customerName =
          language === "en" ? "Customer name is required" : "\u0917\u094d\u0930\u093e\u0939\u0915\u093e\u091a\u0947 \u0928\u093e\u0935 \u0906\u0935\u0936\u094d\u092f\u0915 \u0906\u0939\u0947";
      }
    } else if (!form.studentId) {
      e.studentId = language === "en" ? "Member is required" : "\u0938\u0926\u0938\u094d\u092f \u0906\u0935\u0936\u094d\u092f\u0915 \u0906\u0939\u0947";
    }
    const shouldValidateCurrentSnackFields =
      mode !== "finalize" || editingId || cartItems.length === 0;
    if (shouldValidateCurrentSnackFields) {
      if (!form.snackItem?.trim())
        e.snackItem = language === "en" ? "Snack item is required" : "\u0938\u094d\u0928\u0945\u0915 \u0906\u092f\u091f\u092e \u0906\u0935\u0936\u094d\u092f\u0915 \u0906\u0939\u0947";
      const q = Number(form.quantity);
      if (!Number.isFinite(q) || !Number.isInteger(q) || q < 1) {
        e.quantity = language === "en" ? "Enter a valid quantity (min 1)" : "\u0935\u0948\u0927 \u092a\u094d\u0930\u092e\u093e\u0923 \u091f\u093e\u0915\u093e (\u0915\u093f\u092e\u093e\u0928 1)";
      }
      if (!String(form.pricePerItem).trim())
        e.pricePerItem = language === "en" ? "Price is required" : "\u0915\u093f\u0902\u092e\u0924 \u0906\u0935\u0936\u094d\u092f\u0915 \u0906\u0939\u0947";
      else {
        const p = Number(form.pricePerItem);
        if (!Number.isFinite(p) || p < 0) {
          e.pricePerItem = language === "en" ? "Enter a valid price (0 or more)" : "\u0935\u0948\u0927 \u0915\u093f\u0902\u092e\u0924 \u091f\u093e\u0915\u093e (0 \u0915\u093f\u0902\u0935\u093e \u0905\u0927\u093f\u0915)";
        }
      }
    }
    if (mode === "finalize" && !editingId && cartItems.length === 0) {
      e.cart = language === "en"
        ? "Add at least one snack item to cart"
        : "\u0915\u093e\u0930\u094d\u091f\u092e\u0927\u094d\u092f\u0947 \u0915\u093f\u092e\u093e\u0928 \u090f\u0915 \u0938\u094d\u0928\u0945\u0915 \u0906\u092f\u091f\u092e \u091c\u094b\u0921\u093e";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetCartItemFields = () => {
    setForm((f) => ({ ...f, snackItem: "", snackItemId: "", quantity: 1, pricePerItem: "" }));
    setSnackSearch("");
  };

  const handleAddToCart = () => {
    if (!validate("cart")) return;
    const quantity = Number(form.quantity);
    const pricePerItem = Number(form.pricePerItem);
    setCartItems((items) => [
      ...items,
      {
        id: `${form.snackItem}-${Date.now()}-${items.length}`,
        snackItem: form.snackItem.trim(),
        snackItemMr: form.snackItem.trim(),
        quantity,
        pricePerItem,
        totalPrice: quantity * pricePerItem,
      },
    ]);
    setErrors((e) => ({ ...e, snackItem: null, quantity: null, pricePerItem: null, cart: null }));
    resetCartItemFields();
  };

  const handleRemoveCartItem = (id) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (editingId) {
      if (!validate("save")) return;
    } else if (!validate("finalize")) {
      return;
    }
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isOutsideCustomer = form.customerType !== "member";
      if (editingId) {
        const payload = {
          isOutsideCustomer,
          studentId: isOutsideCustomer ? undefined : form.studentId,
          customerName: isOutsideCustomer ? form.customerName.trim() : undefined,
          snackItem: form.snackItem.trim(),
          quantity: Number(form.quantity),
          pricePerItem: Number(form.pricePerItem),
          totalPrice: totalPrice,
          date: form.orderDate.toISOString(),
        };
        await api.put(`/api/snacks/${editingId}`, payload);
        showToast(language === "en" ? "Order updated successfully!" : "\u0911\u0930\u094d\u0921\u0930 \u0905\u092a\u0921\u0947\u091f \u0915\u0947\u0932\u0940!");
      } else {
        const payload = {
          isOutsideCustomer,
          studentId: isOutsideCustomer ? undefined : form.studentId,
          customerName: isOutsideCustomer ? form.customerName.trim() : undefined,
          date: form.orderDate.toISOString(),
          orders: cartItems.map((item) => ({
            snackItem: item.snackItem,
            quantity: Number(item.quantity),
            pricePerItem: Number(item.pricePerItem),
            totalPrice: Number(item.totalPrice),
          })),
        };
        await api.post("/api/snacks/bulk", payload);
        showToast(language === "en" ? "Order added successfully!" : "\u0911\u0930\u094d\u0921\u0930 \u092f\u0936\u0938\u094d\u0935\u0940\u0930\u093f\u0924\u094d\u092f\u093e \u091c\u094b\u0921\u0932\u0940!");
      }
      closeForm();
      fetchSnacks();
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("extra_snacks_alert_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (snack) => {
    const isSplitGroup = !!snack?.isSplitGroup;
    const displayName = isSplitGroup
      ? snack?.memberPreview || "Split"
      : language === "mr" ? snack.studentNameMr || snack.studentName : snack.studentName;

    Alert.alert(
      t("extra_snacks_alert_delete_title"),
      isSplitGroup
        ? language === "mr"
          ? `\u0935\u093f\u092d\u093e\u091c\u093f\u0924 \u0911\u0930\u094d\u0921\u0930 \u0939\u091f\u0935\u093e\u092f\u091a\u093e \u0906\u0939\u0947 \u0915\u093e? (${displayName})`
          : `Delete this split snack order? (${displayName})`
        : t("extra_snacks_alert_delete_body").replace("{{name}}", displayName),
      [
        { text: t("button_cancel"), style: "cancel" },
        {
          text: t("manage_members_delete"),
          style: "destructive",
          onPress: async () => {
            const prevSnacks = snacks;
            if (isSplitGroup) {
              const idsToRemove = new Set(snack?.orderIds || []);
              setSnacks((s) => s.filter((o) => !idsToRemove.has(String(o._id))));
            } else {
              setSnacks((s) => s.filter((o) => String(o._id) !== String(snack._id)));
            }
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (isSplitGroup) {
                for (const id of (Array.isArray(snack?.orderIds) ? snack.orderIds : [])) {
                  await api.delete(`/api/snacks/${id}`);
                }
              } else {
                await api.delete(`/api/snacks/${snack._id}`);
              }
              showToast(language === "en" ? "Order deleted!" : "\u0911\u0930\u094d\u0921\u0930 \u0939\u091f\u0935\u0932\u0940!");
            } catch (err) {
              setSnacks(prevSnacks);
              Alert.alert(t("alert_error"), err.response?.data?.message || t("extra_snacks_alert_delete_failed"));
            }
          },
        },
      ]
    );
  };

  const renderSnackCard = useCallback(
    ({ item }) => {
      const isSplitGroup = !!item?.isSplitGroup;
      if (isSplitGroup) {
        const title = language === "mr"
          ? `\u0935\u093f\u092d\u093e\u091c\u093f\u0924 \u0938\u094d\u0928\u0945\u0915\u094d\u0938 (${item.memberNames?.length || 0} \u0938\u0926\u0938\u094d\u092f)`
          : `Split Snacks (${item.memberNames?.length || 0} members)`;
        const snackLine = item.snackOverflow > 0 || item.snackNames?.length > 1
          ? language === "mr"
            ? `\u090f\u0915\u093e\u0927\u093f\u0915 \u0938\u094d\u0928\u0945\u0915\u094d\u0938 (${item.snackNames?.length || 0})`
            : `Multiple snacks (${item.snackNames?.length || 0})`
          : item.snackNames?.[0] || "Snack";
        return (
          <View style={styles.card}>
            <View style={[styles.typeBadge, styles.badgeSplit]}>
              <Ionicons name="git-branch-outline" size={10} color="#7C3AED" />
              <Text style={[styles.typeBadgeText, { color: "#7C3AED" }]}>
                {language === "en" ? "Split" : "\u0935\u093f\u092d\u093e\u091c\u093f\u0924"}
              </Text>
            </View>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardTotal}>{formatCurrency(item.totalPrice || 0)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="people-outline" size={16} color="#6B7280" />
              <Text style={styles.cardLabel}>{language === "mr" ? "\u0938\u0926\u0938\u094d\u092f:" : "Members:"}</Text>
              <Text style={styles.cardValue}>
                {item.memberPreview}
                {item.memberOverflow > 0 ? (language === "mr" ? ` +${item.memberOverflow} \u0905\u0927\u093f\u0915` : ` +${item.memberOverflow} more`) : ""}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="fast-food-outline" size={16} color="#6B7280" />
              <Text style={styles.cardLabel}>{t("qr_scanner_label_snack")}:</Text>
              <Text style={styles.cardValue}>{snackLine}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="list-outline" size={16} color="#6B7280" />
              <Text style={styles.cardLabel}>{t("qr_scanner_label_quantity")}:</Text>
              <Text style={styles.cardValue}>{item.quantityTotal}</Text>
              <Text style={styles.cardLabel}>{language === "mr" ? " (\u0935\u093f\u092d\u093e\u091c\u093f\u0924)" : " (split)"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.cardDate}>{formatCardDate(item.date, language)}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>{language === "en" ? "Delete" : "\u0939\u091f\u0935\u093e"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      const isOutside = !!item.isOutsideCustomer;
      return (
        <View style={styles.card}>
          <View style={[styles.typeBadge, isOutside ? styles.badgeOutside : styles.badgeMember]}>
            <Ionicons name={isOutside ? "walk-outline" : "person-outline"} size={10} color={isOutside ? "#B45309" : "#047857"} />
            <Text style={[styles.typeBadgeText, { color: isOutside ? "#B45309" : "#047857" }]}>
              {isOutside
                ? (language === "en" ? "Outside" : "\u092c\u093e\u0939\u0947\u0930\u0940\u0932")
                : (language === "en" ? "Member" : "\u0938\u0926\u0938\u094d\u092f")}
            </Text>
          </View>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {language === "mr" ? item.studentNameMr || item.studentName : item.studentName}
            </Text>
            <Text style={styles.cardTotal}>{formatCurrency(resolveDisplayTotal(item))}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="fast-food-outline" size={16} color="#6B7280" />
            <Text style={styles.cardLabel}>{t("qr_scanner_label_snack")}:</Text>
            <Text style={styles.cardValue}>{language === "mr" ? item.snackItemMr || item.snackItem : item.snackItem}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="list-outline" size={16} color="#6B7280" />
            <Text style={styles.cardLabel}>{t("qr_scanner_label_quantity")}:</Text>
            <Text style={styles.cardValue}>{item.quantity}</Text>
            <Text style={styles.cardLabel}>
              {" "}&times; \u20b9{item.pricePerItem}
              {item?.billSplitRequestId ? (language === "mr" ? " (\u0935\u093f\u092d\u093e\u091c\u093f\u0924 \u0930\u0915\u094d\u0915\u092e \u0932\u093e\u0917\u0942)" : " (split charged)") : ""}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.cardDate}>{formatCardDate(item.date, language)}</Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => openEditForm(item)} activeOpacity={0.7}>
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>{language === "en" ? "Edit" : "\u0938\u0902\u092a\u093e\u0926\u093f\u0924 \u0915\u0930\u093e"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>{language === "en" ? "Delete" : "\u0939\u091f\u0935\u093e"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [language, t]
  );

  if (authLoading || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </View>
    );
  }

  const filterLabel = (key) => {
    const labels = {
      en: { all: "All", members: "Members", outside: "Outside", split: "Split" },
      mr: { all: "\u0938\u0930\u094d\u0935", members: "\u0938\u0926\u0938\u094d\u092f", outside: "\u092c\u093e\u0939\u0947\u0930\u0940\u0932", split: "\u0935\u093f\u092d\u093e\u091c\u093f\u0924" },
    };
    return labels[language]?.[key] ?? key;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{language === "en" ? "Extra Snacks" : "\u0905\u0924\u093f\u0930\u093f\u0915\u094d\u0924 \u0938\u094d\u0928\u0945\u0915\u094d\u0938"}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.topSection}>
        <LinearGradient colors={["#1E3A5F", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>
            {language === "en" ? "Total Snacks Revenue" : "\u090f\u0915\u0942\u0923 \u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0909\u0924\u094d\u092a\u0928\u094d\u0928"}{" "}({getMonthLabel(selectedMonth, language)})
          </Text>
          <Text style={styles.revenueAmount}>{formatCurrency(totalMonthRevenue)}</Text>
          <Text style={styles.revenueSubtext}>
            {totalMonthOrders}{" "}{language === "en" ? "orders this month" : "\u0911\u0930\u094d\u0921\u0930 \u092f\u093e \u092e\u0939\u093f\u0928\u094d\u092f\u093e\u0924"}
          </Text>
        </LinearGradient>

        <View style={styles.analyticsStrip}>
          <View style={styles.analyticsTile}>
            <Ionicons name="receipt-outline" size={18} color="#2563EB" />
            <Text style={styles.analyticsTileValue}>{totalMonthOrders}</Text>
            <Text style={styles.analyticsTileLabel}>{language === "en" ? "Orders" : "\u0911\u0930\u094d\u0921\u0930"}</Text>
          </View>
          <View style={styles.analyticsDivider} />
          <View style={styles.analyticsTile}>
            <Ionicons name="person-outline" size={18} color="#047857" />
            <Text style={[styles.analyticsTileValue, { color: "#047857" }]}>{formatCurrency(memberRevenue)}</Text>
            <Text style={styles.analyticsTileLabel}>{language === "en" ? "Members" : "\u0938\u0926\u0938\u094d\u092f"}</Text>
          </View>
          <View style={styles.analyticsDivider} />
          <View style={styles.analyticsTile}>
            <Ionicons name="walk-outline" size={18} color="#B45309" />
            <Text style={[styles.analyticsTileValue, { color: "#B45309" }]}>{formatCurrency(outsideRevenue)}</Text>
            <Text style={styles.analyticsTileLabel}>{language === "en" ? "Outside" : "\u092c\u093e\u0939\u0947\u0930\u0940\u0932"}</Text>
          </View>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => setSelectedMonth((m) => stepPrevYearMonth(m, minSnackMonth))}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {getMonthLabel(selectedMonth, language)}{" "}
            <Text style={styles.monthOrderCount}>({totalMonthOrders})</Text>
          </Text>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => setSelectedMonth((m) => stepNextYearMonth(m))}>
            <Ionicons name="chevron-forward" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={language === "en" ? "Search by name or snack..." : "\u0928\u093e\u0935 \u0915\u093f\u0902\u0935\u093e \u0938\u094d\u0928\u0945\u0915\u0928\u0947 \u0936\u094b\u0927\u093e..."}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          {FILTER_OPTIONS.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, activeFilter === key && styles.filterChipActive]}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, activeFilter === key && styles.filterChipTextActive]}>
                {filterLabel(key)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.addButton} onPress={openAddForm} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>{language === "en" ? "Add Snack Order" : "\u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0911\u0930\u094d\u0921\u0930 \u091c\u094b\u0921\u093e"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={displaySnacks}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderSnackCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchSnacks}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={72} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{language === "en" ? "No orders found" : "\u0915\u094b\u0923\u0924\u094d\u092f\u093e \u0911\u0930\u094d\u0921\u0930 \u0928\u093e\u0939\u0940\u0924"}</Text>
              <Text style={styles.emptyText}>
                {searchQuery || activeFilter !== "all"
                  ? (language === "en" ? "Try adjusting your search or filters." : "\u0924\u0941\u092e\u091a\u093e \u0936\u094b\u0927 \u0915\u093f\u0902\u0935\u093e \u092b\u093f\u0932\u094d\u091f\u0930 \u092c\u0926\u0932\u093e.")
                  : (language === "en"
                    ? `No snack orders for ${getMonthLabel(selectedMonth, language)}.`
                    : `${getMonthLabel(selectedMonth, language)} \u0938\u093e\u0920\u0940 \u0915\u094b\u0923\u0924\u094d\u092f\u093e\u0939\u0940 \u0911\u0930\u094d\u0921\u0930 \u0928\u093e\u0939\u0940\u0924.`)}
              </Text>
              {!searchQuery && activeFilter === "all" && (
                <TouchableOpacity style={styles.emptyAddButton} onPress={openAddForm} activeOpacity={0.8}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyAddButtonText}>{language === "en" ? "Add First Order" : "\u092a\u0939\u093f\u0932\u0940 \u0911\u0930\u094d\u0921\u0930 \u091c\u094b\u0921\u093e"}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId
                  ? (language === "en" ? "Edit Snack Order" : "\u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0911\u0930\u094d\u0921\u0930 \u0938\u0902\u092a\u093e\u0926\u093f\u0924 \u0915\u0930\u093e")
                  : (language === "en" ? "Add Snack Order" : "\u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0911\u0930\u094d\u0921\u0930 \u091c\u094b\u0921\u093e")}
              </Text>
              <TouchableOpacity onPress={closeForm} style={styles.modalClose}>
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.customerTypeToggle}>
                <TouchableOpacity
                  style={[styles.customerTypeOption, form.customerType === "outside" && styles.customerTypeOptionActive]}
                  onPress={() => { setForm((f) => ({ ...f, customerType: "outside", studentId: "", customerName: "" })); setShowMemberPicker(false); }}
                >
                  <Ionicons name={form.customerType === "outside" ? "radio-button-on" : "radio-button-off"} size={20} color={form.customerType === "outside" ? "#2563EB" : "#9CA3AF"} />
                  <Text style={[styles.customerTypeLabel, form.customerType === "outside" && styles.customerTypeLabelActive]}>
                    {language === "en" ? "Outside customer" : "\u092c\u093e\u0939\u0947\u0930\u0940\u0932 \u0917\u094d\u0930\u093e\u0939\u0915"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.customerTypeOption, form.customerType === "member" && styles.customerTypeOptionActive]}
                  onPress={() => { setForm((f) => ({ ...f, customerType: "member" })); }}
                >
                  <Ionicons name={form.customerType === "member" ? "radio-button-on" : "radio-button-off"} size={20} color={form.customerType === "member" ? "#2563EB" : "#9CA3AF"} />
                  <Text style={[styles.customerTypeLabel, form.customerType === "member" && styles.customerTypeLabelActive]}>
                    {language === "en" ? "Existing member" : "\u0935\u093f\u0926\u094d\u092f\u092e\u093e\u0928 \u0938\u0926\u0938\u094d\u092f"}
                  </Text>
                </TouchableOpacity>
              </View>

              {form.customerType === "outside" ? (
                <>
                  <Text style={styles.formLabel}>{language === "en" ? "Customer name *" : "\u0917\u094d\u0930\u093e\u0939\u0915\u093e\u091a\u0947 \u0928\u093e\u0935 *"}</Text>
                  <TextInput
                    style={[styles.input, errors.customerName && styles.inputError]}
                    value={form.customerName}
                    onChangeText={(v) => { setForm((f) => ({ ...f, customerName: v })); setErrors((e) => ({ ...e, customerName: null })); }}
                    placeholder={language === "en" ? "e.g. Walk-in customer" : "\u0909\u0926\u093e. \u0930\u093e\u091c\u0947\u0936 \u092a\u093e\u091f\u0940\u0932"}
                    placeholderTextColor="#9CA3AF"
                  />
                  {errors.customerName ? <Text style={styles.errorText}>{errors.customerName}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.formLabel}>{language === "en" ? "Member *" : "\u0938\u0926\u0938\u094d\u092f *"}</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.pickerInput, errors.studentId && styles.inputError]}
                    onPress={() => setShowMemberPicker((v) => !v)}
                  >
                    <Text style={form.studentId ? styles.pickerText : styles.placeholderText}>
                      {form.studentId ? form.customerName : (language === "en" ? "Select member" : "\u0938\u0926\u0938\u094d\u092f \u0928\u093f\u0935\u0921\u093e")}
                    </Text>
                    <Ionicons name={showMemberPicker ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                  </TouchableOpacity>
                  {showMemberPicker && (
                    <View style={styles.dropdownOptions}>
                      <TextInput
                        style={styles.dropdownSearchInput}
                        value={memberSearch}
                        onChangeText={setMemberSearch}
                        placeholder={language === "en" ? "Search by name, roll or room" : "\u0928\u093e\u0935, \u0930\u094b\u0932 \u0915\u093f\u0902\u0935\u093e \u0930\u0942\u092e\u0928\u0947 \u0936\u094b\u0927\u093e"}
                        placeholderTextColor="#9CA3AF"
                      />
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        {filteredMembers.map((m) => (
                          <TouchableOpacity key={m._id} style={styles.dropdownOption}
                            onPress={() => {
                              setForm((f) => ({ ...f, studentId: m._id, customerName: m.name || "" }));
                              setErrors((e) => ({ ...e, studentId: null }));
                              setShowMemberPicker(false);
                            }}>
                            <Text style={styles.dropdownOptionText}>
                              {language === "mr" ? m.nameMr || m.name : m.name}{" "}
                              {m.rollNumber || m.roomNumber ? `(${m.rollNumber || m.roomNumber})` : ""}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {filteredMembers.length === 0 ? (
                          <Text style={styles.emptyDropdownText}>
                            {language === "en" ? "No members match your search" : "\u0924\u0941\u092e\u091a\u094d\u092f\u093e \u0936\u094b\u0927\u093e\u0936\u0940 \u091c\u0941\u0933\u0923\u093e\u0930\u093e \u0938\u0926\u0938\u094d\u092f \u0928\u093e\u0939\u0940"}
                          </Text>
                        ) : null}
                      </ScrollView>
                    </View>
                  )}
                  {errors.studentId ? <Text style={styles.errorText}>{errors.studentId}</Text> : null}
                </>
              )}

              <Text style={styles.formLabel}>{language === "en" ? "Order Date" : "\u0911\u0930\u094d\u0921\u0930\u091a\u0940 \u0924\u093e\u0930\u0940\u0916"}</Text>
              <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowDatePicker(true)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.pickerText}>{formatDisplayDate(form.orderDate)}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={form.orderDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) setForm((f) => ({ ...f, orderDate: date }));
                  }}
                />
              )}

              <Text style={styles.formLabel}>{language === "en" ? "Snack Item *" : "\u0938\u094d\u0928\u0945\u0915 \u0906\u092f\u091f\u092e *"}</Text>
              {snackCatalog.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={[styles.input, styles.pickerInput, errors.snackItem && styles.inputError]}
                    onPress={() => setShowSnackPicker((v) => !v)}
                  >
                    <Text style={form.snackItem ? styles.pickerText : styles.placeholderText}>
                      {form.snackItem || (language === "en" ? "Select from catalog" : "\u0938\u0942\u091a\u0940\u092e\u0927\u0942\u0928 \u0928\u093f\u0935\u0921\u093e")}
                    </Text>
                    <Ionicons name={showSnackPicker ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                  </TouchableOpacity>
                  {showSnackPicker && (
                    <View style={styles.dropdownOptions}>
                      <TextInput
                        style={styles.dropdownSearchInput}
                        value={snackSearch}
                        onChangeText={setSnackSearch}
                        placeholder={language === "en" ? "Search snacks..." : "\u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0936\u094b\u0927\u093e..."}
                        placeholderTextColor="#9CA3AF"
                      />
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        {filteredSnackCatalog.map((s) => (
                          <TouchableOpacity key={s._id} style={styles.dropdownOption}
                            onPress={() => {
                              const name = language === "mr" ? s.nameMr || s.name : s.name;
                              setForm((f) => ({ ...f, snackItem: name || s.name, snackItemId: s._id, pricePerItem: String(s.price ?? "") }));
                              setErrors((e) => ({ ...e, snackItem: null, pricePerItem: null }));
                              setShowSnackPicker(false);
                              setSnackSearch("");
                            }}>
                            <View style={styles.catalogOptionRow}>
                              <Text style={styles.dropdownOptionText}>{language === "mr" ? s.nameMr || s.name : s.name}</Text>
                              <Text style={styles.catalogOptionPrice}>\u20b9{s.price}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                        {filteredSnackCatalog.length === 0 && (
                          <Text style={styles.emptyDropdownText}>{language === "en" ? "No snacks found" : "\u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0938\u093e\u092a\u0921\u0932\u093e \u0928\u093e\u0939\u0940"}</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <TextInput
                    style={[styles.input, { marginTop: 8 }, errors.snackItem && styles.inputError]}
                    value={form.snackItem}
                    onChangeText={(v) => { setForm((f) => ({ ...f, snackItem: v, snackItemId: "" })); setErrors((e) => ({ ...e, snackItem: null })); }}
                    placeholder={language === "en" ? "Or type custom snack name" : "\u0915\u093f\u0902\u0935\u093e \u0928\u093e\u0935 \u091f\u093e\u0915\u093e"}
                    placeholderTextColor="#9CA3AF"
                  />
                </>
              ) : (
                <TextInput
                  style={[styles.input, errors.snackItem && styles.inputError]}
                  value={form.snackItem}
                  onChangeText={(v) => { setForm((f) => ({ ...f, snackItem: v })); setErrors((e) => ({ ...e, snackItem: null })); }}
                  placeholder={language === "en" ? "Enter snack item" : "\u0938\u094d\u0928\u0945\u0915 \u0906\u092f\u091f\u092e \u091f\u093e\u0915\u093e"}
                  placeholderTextColor="#9CA3AF"
                />
              )}
              {errors.snackItem ? <Text style={styles.errorText}>{errors.snackItem}</Text> : null}

              <Text style={styles.formLabel}>{language === "en" ? "Price Per Item (\u20b9) *" : "\u092a\u094d\u0930\u0924\u093f \u0906\u092f\u091f\u092e \u0915\u093f\u0902\u092e\u0924 (\u20b9) *"}</Text>
              <TextInput
                style={[styles.input, errors.pricePerItem && styles.inputError]}
                value={form.pricePerItem}
                onChangeText={(v) => { setForm((f) => ({ ...f, pricePerItem: v })); setErrors((e) => ({ ...e, pricePerItem: null })); }}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              {errors.pricePerItem ? <Text style={styles.errorText}>{errors.pricePerItem}</Text> : null}

              <Text style={styles.formLabel}>{language === "en" ? "Quantity *" : "\u092a\u094d\u0930\u092e\u093e\u0923 *"}</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setForm((f) => ({ ...f, quantity: Math.max(1, Number(f.quantity) - 1) }))} activeOpacity={0.7}>
                  <Ionicons name="remove" size={20} color="#111827" />
                </TouchableOpacity>
                <TextInput
                  style={styles.stepperInput}
                  value={String(form.quantity)}
                  onChangeText={(v) => { const n = parseInt(v, 10); setForm((f) => ({ ...f, quantity: Number.isNaN(n) ? 1 : n })); setErrors((e) => ({ ...e, quantity: null })); }}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setForm((f) => ({ ...f, quantity: Number(f.quantity) + 1 }))} activeOpacity={0.7}>
                  <Ionicons name="add" size={20} color="#111827" />
                </TouchableOpacity>
              </View>
              {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}

              <Text style={styles.formLabel}>{language === "en" ? "Item Total" : "\u0906\u092f\u091f\u092e \u090f\u0915\u0942\u0923"}</Text>
              <View style={styles.totalDisplay}>
                <Text style={styles.totalDisplayText}>{formatCurrency(totalPrice)}</Text>
                <Text style={styles.totalHint}>{language === "en" ? "Auto calculated" : "\u0938\u094d\u0935\u092f\u0902\u091a\u0932\u093f\u0924"}</Text>
              </View>

              {!editingId ? (
                <>
                  <TouchableOpacity style={[styles.secondaryButton, saving && styles.saveButtonDisabled]} onPress={handleAddToCart} disabled={saving} activeOpacity={0.8}>
                    <Ionicons name="cart-outline" size={20} color="#111827" />
                    <Text style={styles.secondaryButtonText}>{language === "en" ? "Add To Cart" : "\u0915\u093e\u0930\u094d\u091f\u092e\u0927\u094d\u092f\u0947 \u091c\u094b\u0921\u093e"}</Text>
                  </TouchableOpacity>
                  <View style={styles.cartSection}>
                    <View style={styles.cartHeader}>
                      <Text style={styles.cartTitle}>{language === "en" ? "Cart Items" : "\u0915\u093e\u0930\u094d\u091f \u0906\u092f\u091f\u092e\u094d\u0938"}</Text>
                      <View style={styles.cartCountBadge}>
                        <Text style={styles.cartCount}>{cartItems.length}</Text>
                      </View>
                    </View>
                    {cartItems.length === 0 ? (
                      <Text style={styles.emptyCartText}>
                        {language === "en" ? "Select snacks and add them to cart before finalizing." : "\u0911\u0930\u094d\u0921\u0930 \u0905\u0902\u0924\u093f\u092e \u0915\u0930\u0923\u094d\u092f\u093e\u092a\u0942\u0930\u094d\u0935\u0940 \u0938\u094d\u0928\u0945\u0915\u094d\u0938 \u0928\u093f\u0935\u0921\u093e \u0906\u0923\u093f \u0915\u093e\u0930\u094d\u091f\u092e\u0927\u094d\u092f\u0947 \u091c\u094b\u0921\u093e."}
                      </Text>
                    ) : (
                      cartItems.map((item) => (
                        <View key={item.id} style={styles.cartItemCard}>
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemTitle}>{language === "mr" ? item.snackItemMr || item.snackItem : item.snackItem}</Text>
                            <Text style={styles.cartItemMeta}>{item.quantity} x {formatCurrency(item.pricePerItem)} = {formatCurrency(item.totalPrice)}</Text>
                          </View>
                          <TouchableOpacity style={styles.cartRemoveButton} onPress={() => handleRemoveCartItem(item.id)} activeOpacity={0.7}>
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                    <View style={styles.cartFooter}>
                      <Text style={styles.cartTotalLabel}>{language === "en" ? "Order Total" : "\u0911\u0930\u094d\u0921\u0930 \u090f\u0915\u0942\u0923"}</Text>
                      <Text style={styles.cartTotalValue}>{formatCurrency(cartTotal)}</Text>
                    </View>
                    {errors.cart ? <Text style={styles.errorText}>{errors.cart}</Text> : null}
                  </View>
                </>
              ) : null}

              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={editingId ? "checkmark-circle-outline" : "checkmark-done-outline"} size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>
                      {editingId
                        ? (language === "en" ? "Update Order" : "\u0911\u0930\u094d\u0921\u0930 \u0905\u092a\u0921\u0947\u091f \u0915\u0930\u093e")
                        : (language === "en" ? "Finalize Order" : "\u0911\u0930\u094d\u0921\u0930 \u0905\u0902\u0924\u093f\u092e \u0915\u0930\u093e")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Animated.View
        style={[
          styles.toast,
          toastType === "error" && styles.toastError,
          {
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name={toastType === "error" ? "alert-circle-outline" : "checkmark-circle-outline"} size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  headerRight: { width: 40 },
  topSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  revenueCard: { borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  revenueLabel: { fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  revenueAmount: { fontSize: 30, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  revenueSubtext: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  analyticsStrip: { flexDirection: "row", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  analyticsTile: { flex: 1, alignItems: "center", gap: 4 },
  analyticsTileValue: { fontSize: 14, fontWeight: "700", color: "#2563EB" },
  analyticsTileLabel: { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  analyticsDivider: { width: 1, backgroundColor: "#E5E7EB", marginHorizontal: 4 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, gap: 8 },
  monthNavButton: { padding: 8, borderRadius: 10, backgroundColor: "#F3F4F6" },
  monthLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  monthOrderCount: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  filterRow: { marginBottom: 10 },
  filterRowContent: { gap: 8, paddingRight: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  filterChipActive: { backgroundColor: "#1E3A5F", borderColor: "#1E3A5F" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterChipTextActive: { color: "#FFFFFF" },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12, backgroundColor: "#1E3A5F", marginBottom: 4 },
  addButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  typeBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4, marginBottom: 8 },
  badgeMember: { backgroundColor: "#D1FAE5" },
  badgeOutside: { backgroundColor: "#FEF3C7" },
  badgeSplit: { backgroundColor: "#EDE9FE" },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  cardTotal: { fontSize: 15, fontWeight: "800", color: "#1E3A5F" },
  cardRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  cardLabel: { fontSize: 13, color: "#6B7280", marginLeft: 6 },
  cardValue: { fontSize: 13, color: "#111827", fontWeight: "600", marginLeft: 4, flex: 1 },
  cardDate: { fontSize: 13, color: "#6B7280", marginLeft: 6 },
  cardActions: { flexDirection: "row", marginTop: 12, gap: 8 },
  editButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "#1E3A5F" },
  deleteButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "#DC2626" },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  emptyText: { fontSize: 14, color: "#9CA3AF", marginTop: 8, textAlign: "center", lineHeight: 20 },
  emptyAddButton: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1E3A5F" },
  emptyAddButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  modalClose: { padding: 4 },
  formScroll: { paddingHorizontal: 20, paddingBottom: 80 },
  customerTypeToggle: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 4 },
  customerTypeOption: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "#E5E7EB", gap: 6 },
  customerTypeOptionActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  customerTypeLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500", flexShrink: 1 },
  customerTypeLabelActive: { color: "#2563EB", fontWeight: "700" },
  formLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", borderWidth: 1.5, borderColor: "transparent" },
  inputError: { borderColor: "#DC2626", backgroundColor: "#FFF5F5" },
  pickerInput: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { fontSize: 15, color: "#111827", fontWeight: "500" },
  placeholderText: { fontSize: 15, color: "#9CA3AF" },
  dropdownOptions: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", marginTop: 8, maxHeight: 220, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  dropdownOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  dropdownOptionText: { fontSize: 15, color: "#111827", fontWeight: "500" },
  emptyDropdownText: { fontSize: 14, color: "#9CA3AF", padding: 14, textAlign: "center" },
  dropdownSearchInput: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", fontSize: 14, color: "#111827" },
  catalogOptionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catalogOptionPrice: { fontSize: 14, fontWeight: "700", color: "#2563EB" },
  stepperRow: { flexDirection: "row", alignItems: "center" },
  stepperBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#E5E7EB" },
  stepperInput: { flex: 1, height: 48, backgroundColor: "#F9FAFB", fontSize: 18, fontWeight: "700", color: "#111827", borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: "#E5E7EB" },
  totalDisplay: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#BFDBFE" },
  totalDisplayText: { fontSize: 20, fontWeight: "800", color: "#1E3A5F" },
  totalHint: { fontSize: 12, color: "#6B7280" },
  errorText: { fontSize: 12, color: "#DC2626", marginTop: 4, fontWeight: "500" },
  saveButton: { marginTop: 24, marginBottom: 20, height: 52, borderRadius: 14, backgroundColor: "#1E3A5F", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: { marginTop: 20, height: 48, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1.5, borderColor: "#D1D5DB" },
  secondaryButtonText: { color: "#111827", fontSize: 15, fontWeight: "700" },
  cartSection: { marginTop: 16, backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  cartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cartTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cartCountBadge: { backgroundColor: "#1E3A5F", borderRadius: 20, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  cartCount: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },
  emptyCartText: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  cartItemCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#F3F4F6" },
  cartItemInfo: { flex: 1, paddingRight: 12 },
  cartItemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cartItemMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  cartRemoveButton: { padding: 6 },
  cartFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  cartTotalLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  cartTotalValue: { fontSize: 18, fontWeight: "800", color: "#1E3A5F" },
  toast: { position: "absolute", bottom: 32, left: 20, right: 20, backgroundColor: "#1E3A5F", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },
  toastError: { backgroundColor: "#DC2626" },
  toastText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
