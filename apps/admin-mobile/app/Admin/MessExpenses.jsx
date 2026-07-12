import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import api from "../../lib/api";
import { useLanguage } from "../../LanguageContext";
import {
  clampYearMonthToSelectableWindow,
  combineMinYearMonth,
  getCurrentYearMonth,
  getMaxSelectableYearMonth,
  stepNextYearMonth,
  stepPrevYearMonth,
} from "../../lib/monthNavigation";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Vegetables",
  "Milk",
  "Grocery",
  "Gas",
  "Maintenance",
  "Other",
];

const CATEGORY_CONFIG = {
  Vegetables:  { color: "#16A34A", bg: "#DCFCE7", icon: "leaf-outline",       mr: "भाज्या"   },
  Milk:        { color: "#2563EB", bg: "#DBEAFE", icon: "water-outline",       mr: "दुग्ध"    },
  Grocery:     { color: "#D97706", bg: "#FEF3C7", icon: "basket-outline",      mr: "किराणा"   },
  Gas:         { color: "#EA580C", bg: "#FFEDD5", icon: "flame-outline",       mr: "गॅस"      },
  Maintenance: { color: "#7C3AED", bg: "#EDE9FE", icon: "construct-outline",   mr: "देखभाल"   },
  Other:       { color: "#475569", bg: "#F1F5F9", icon: "ellipsis-horizontal", mr: "इतर"      },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_NAMES_MR = [
  "जानेवारी","फेब्रुवारी","मार्च","एप्रिल","मे","जून",
  "जुलै","ऑगस्ट","सप्टेंबर","ऑक्टोबर","नोव्हेंबर","डिसेंबर",
];

const SORT_OPTIONS = ["date_desc","date_asc","amount_desc","amount_asc"];
const SORT_LABELS  = {
  date_desc:   { en: "Newest First",   mr: "नवीन प्रथम"    },
  date_asc:    { en: "Oldest First",   mr: "जुने प्रथम"    },
  amount_desc: { en: "Highest Amount", mr: "सर्वाधिक रक्कम" },
  amount_asc:  { en: "Lowest Amount",  mr: "कमीत कमी रक्कम" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDisplayDate = (d, lang = "en") => {
  const date = d instanceof Date ? d : new Date(d);
  const locale = lang === "mr" ? "mr-IN" : "en-IN";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
};

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN")}`;

const getMonthLabel = (yearMonth, lang = "en") => {
  const year  = Math.floor(yearMonth / 12);
  const month = yearMonth % 12;
  const names = lang === "mr" ? MONTH_NAMES_MR : MONTH_NAMES;
  return `${names[month]} ${year}`;
};

const groupByDate = (list) => {
  const map = {};
  list.forEach((item) => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.keys(map)
    .sort((a, b) => new Date(b) - new Date(a))
    .map((key) => ({ title: key, data: map[key] }));
};

const applySort = (list, sort) => {
  const copy = [...list];
  switch (sort) {
    case "date_desc":   return copy.sort((a,b) => new Date(b.date) - new Date(a.date));
    case "date_asc":    return copy.sort((a,b) => new Date(a.date) - new Date(b.date));
    case "amount_desc": return copy.sort((a,b) => b.amount - a.amount);
    case "amount_asc":  return copy.sort((a,b) => a.amount - b.amount);
    default: return copy;
  }
};

// ─── Toast Component ─────────────────────────────────────────────────────────

function Toast({ visible, message, type }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);

  const bg = type === "error" ? "#DC2626" : "#16A34A";
  const icon = type === "error" ? "alert-circle" : "checkmark-circle";
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]} pointerEvents="none">
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Swipeable Card ──────────────────────────────────────────────────────────

function SwipeableCard({ item, language, onEdit, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  const handleSwipe = () => {
    if (!swiped) {
      Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
      setSwiped(true);
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      setSwiped(false);
    }
  };

  const resetSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    setSwiped(false);
  };

  const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Other;
  const title = language === "mr" ? item.titleMr || item.title : item.title;
  const desc  = language === "mr" ? item.descriptionMr || item.description : item.description;

  return (
    <View style={styles.swipeWrapper}>
      {/* Delete background revealed on swipe */}
      <View style={styles.swipeDeleteBg}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => { resetSwipe(); onDelete(item); }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.swipeDeleteText}>
            {language === "en" ? "Delete" : "हटवा"}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <Pressable onLongPress={handleSwipe} onPress={swiped ? resetSwipe : undefined}>
          <View style={styles.card}>
            {/* Left color accent */}
            <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

            <View style={styles.cardBody}>
              {/* Header row */}
              <View style={styles.cardHeader}>
                <View style={[styles.categoryIconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
                <Text style={[styles.cardAmount, { color: cfg.color }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>

              {/* Meta row */}
              <View style={styles.cardMeta}>
                <View style={[styles.categoryBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.categoryText, { color: cfg.color }]}>
                    {language === "mr" ? cfg.mr : item.category}
                  </Text>
                </View>
                <View style={styles.datePill}>
                  <Ionicons name="calendar-outline" size={11} color="#9CA3AF" />
                  <Text style={styles.cardDate}>{formatDisplayDate(item.date, language)}</Text>
                </View>
              </View>

              {/* Description */}
              {desc ? <Text style={styles.cardDescription} numberOfLines={2}>{desc}</Text> : null}

              {/* Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => onEdit(item)}>
                  <Ionicons name="pencil-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.editButtonText}>
                    {language === "en" ? "Edit" : "संपादन"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item)}>
                  <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>
                    {language === "en" ? "Delete" : "हटवा"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.swipeHint}>
                  {language === "en" ? "Long-press to swipe" : "स्वाइप करण्यासाठी दाबा"}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MessExpenses() {
  const router   = useRouter();
  const { language } = useLanguage();

  const [expenses,      setExpenses]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [formVisible,   setFormVisible]   = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker,     setShowDatePicker]     = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [exporting,          setExporting]          = useState(false);

  // Filter / sort
  const [searchQuery,     setSearchQuery]     = useState("");
  const [filterCategory,  setFilterCategory]  = useState(null);
  const [sortMode,        setSortMode]        = useState("date_desc");
  const [showSortPicker,  setShowSortPicker]  = useState(false);

  // Budget
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetInput,        setBudgetInput]        = useState("");
  const [monthBudgets,       setMonthBudgets]       = useState({});

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });

  const [form, setForm] = useState({
    title: "", category: "", amount: "", date: new Date(), description: "",
  });
  const [errors, setErrors] = useState({});

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2800);
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await api.get("/api/expenses");
      setExpenses(res.data);
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          (language === "en" ? "Failed to fetch expenses" : "खर्च मिळवण्यात अयशस्वी"),
        "error"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  useEffect(() => { fetchExpenses(); }, []);

  // ── Month window ─────────────────────────────────────────────────────────────
  const allExpenseMonths = expenses
    .map((e) => { const d = new Date(e.date); return d.getFullYear() * 12 + d.getMonth(); })
    .filter((ym) => !Number.isNaN(ym));
  const minExpenseMonth = combineMinYearMonth(
    allExpenseMonths.length > 0 ? Math.min(...allExpenseMonths) : getCurrentYearMonth(0)
  );

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(m, minExpenseMonth, getMaxSelectableYearMonth())
    );
  }, [minExpenseMonth, expenses.length]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const monthExpenses = expenses.filter((e) => {
    const d  = new Date(e.date);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

  const prevMonthExpenses = expenses.filter((e) => {
    const d  = new Date(e.date);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth - 1;
  });

  const totalAmount     = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal       = prevMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthDiff       = totalAmount - prevTotal;
  const currentBudget   = monthBudgets[selectedMonth] || 0;
  const budgetProgress  = currentBudget > 0 ? Math.min(totalAmount / currentBudget, 1) : 0;
  const budgetColor     = budgetProgress < 0.6 ? "#16A34A" : budgetProgress < 0.85 ? "#D97706" : "#DC2626";

  // Category breakdown
  const categoryTotals = CATEGORIES.map((cat) => ({
    cat,
    total: monthExpenses.filter((e) => e.category === cat).reduce((s,e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0);

  // Filtered + sorted list
  const filteredExpenses = applySort(
    monthExpenses.filter((e) => {
      const title = language === "mr" ? e.titleMr || e.title : e.title;
      const matchSearch = !searchQuery.trim() ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = !filterCategory || e.category === filterCategory;
      return matchSearch && matchCat;
    }),
    sortMode
  );

  const sections = groupByDate(filteredExpenses);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const openAddForm = () => {
    setEditingId(null);
    setForm({ title: "", category: "", amount: "", date: new Date(), description: "" });
    setErrors({});
    setFormVisible(true);
  };

  const openEditForm = (exp) => {
    setEditingId(exp._id);
    setForm({
      title: exp.title || exp.titleMr || "",
      category: exp.category,
      amount: String(exp.amount),
      date: new Date(exp.date),
      description: exp.description || exp.descriptionMr || "",
    });
    setErrors({});
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setShowCategoryPicker(false);
    setShowDatePicker(false);
  };

  const validate = () => {
    const e  = {};
    const en = language === "en";
    if (!form.title.trim())   e.title    = en ? "Title is required"      : "शीर्षक आवश्यक आहे";
    if (!form.category)       e.category = en ? "Category is required"   : "विभाग आवश्यक आहे";
    if (!form.amount.trim())  e.amount   = en ? "Amount is required"     : "रक्कम आवश्यक आहे";
    else if (isNaN(Number(form.amount)) || Number(form.amount) < 0)
      e.amount = en ? "Enter a valid amount" : "वैध रक्कम प्रविष्ट करा";
    if (!form.date) e.date = en ? "Date is required" : "तारीख आवश्यक आहे";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(), titleMr: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date.toISOString(),
        description: form.description.trim(), descriptionMr: form.description.trim(),
      };
      if (editingId) {
        await api.put(`/api/expenses/${editingId}`, payload);
        showToast(language === "en" ? "Expense updated successfully" : "खर्च यशस्वीरित्या अपडेट झाला");
      } else {
        await api.post("/api/expenses", payload);
        showToast(language === "en" ? "Expense added successfully" : "खर्च यशस्वीरित्या जोडला गेला");
      }
      closeForm();
      fetchExpenses();
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          (language === "en" ? "Failed to save expense" : "खर्च जतन करण्यात अयशस्वी"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (exp) => {
    const displayTitle = language === "mr" ? exp.titleMr || exp.title : exp.title;
    // Simple confirm via 2-button modal alternative using Alert API
    const { Alert } = require("react-native");
    Alert.alert(
      language === "en" ? "Delete Expense" : "खर्च हटवा",
      language === "en"
        ? `Delete "${displayTitle}"?`
        : `"${displayTitle}" हटवायचे आहे का?`,
      [
        { text: language === "en" ? "Cancel" : "रद्द करा", style: "cancel" },
        {
          text: language === "en" ? "Delete" : "हटवा",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/expenses/${exp._id}`);
              showToast(language === "en" ? "Expense deleted" : "खर्च हटवला");
              fetchExpenses();
            } catch (err) {
              showToast(
                err.response?.data?.message ||
                  (language === "en" ? "Failed to delete" : "हटवण्यात अयशस्वी"),
                "error"
              );
            }
          },
        },
      ]
    );
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setExporting(true);
      const monthLabel = getMonthLabel(selectedMonth, "en");
      const rows = monthExpenses
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(
          (e, i) => `
          <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
            <td>${formatDisplayDate(e.date, "en")}</td>
            <td>${e.title}</td>
            <td>${e.category}</td>
            <td style="text-align:right;font-weight:600">₹${Number(e.amount).toLocaleString("en-IN")}</td>
            <td>${e.description || "-"}</td>
          </tr>`
        )
        .join("");

      const html = `
        <html><head><style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1   { font-size: 22px; margin-bottom: 4px; }
          p    { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th   { background: #111827; color: #fff; padding: 10px 12px; text-align: left; }
          td   { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; }
          .total { margin-top: 16px; text-align: right; font-size: 16px; font-weight: bold; }
        </style></head><body>
          <h1>Mess Expenses — ${monthLabel}</h1>
          <p>Generated on ${new Date().toLocaleDateString("en-IN")}</p>
          <table>
            <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Notes</th></tr>
            ${rows}
          </table>
          <p class="total">Total: ₹${totalAmount.toLocaleString("en-IN")}</p>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Expenses - ${monthLabel}` });
      }
    } catch {
      showToast(language === "en" ? "Export failed" : "निर्यात अयशस्वी", "error");
    } finally {
      setExporting(false);
    }
  };

  // ── Date picker ──────────────────────────────────────────────────────────────
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) setForm((f) => ({ ...f, date: selectedDate }));
  };

  // ── Section header ────────────────────────────────────────────────────────────
  const renderSectionHeader = ({ section: { title } }) => {
    const d = new Date(title);
    const label = d.toLocaleDateString(language === "mr" ? "mr-IN" : "en-IN", {
      weekday: "short", day: "numeric", month: "long",
    });
    const dayTotal = filteredExpenses
      .filter((e) => {
        const ed = new Date(e.date);
        return (
          ed.getFullYear() === d.getFullYear() &&
          ed.getMonth() === d.getMonth() &&
          ed.getDate() === d.getDate()
        );
      })
      .reduce((s, e) => s + Number(e.amount), 0);

    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{label}</Text>
        <Text style={styles.sectionHeaderTotal}>{formatCurrency(dayTotal)}</Text>
      </View>
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="wallet-outline" size={52} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {language === "en" ? "No Expenses Yet" : "कोणताही खर्च नाही"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || filterCategory
          ? language === "en" ? "Try adjusting your filters" : "फिल्टर बदलून पहा"
          : language === "en"
          ? "Record your first expense for this month"
          : "या महिन्याचा पहिला खर्च नोंदवा"}
      </Text>
      {!searchQuery && !filterCategory && (
        <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddForm}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyAddBtnText}>
            {language === "en" ? "Add First Expense" : "खर्च जोडा"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>
          {language === "en" ? "Mess Expenses" : "मेस खर्च"}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleExport}
            disabled={exporting || monthExpenses.length === 0}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#111827" />
              : <Ionicons name="share-outline" size={20} color={monthExpenses.length === 0 ? "#D1D5DB" : "#111827"} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setBudgetModalVisible(true)}>
            <Ionicons name="flag-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Top section ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]}
        nestedScrollEnabled
        style={{ flex: 1 }}
      >
        <View style={styles.topSection}>

          {/* Total + comparison card */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardTop}>
              <View>
                <Text style={styles.totalLabel}>
                  {language === "en" ? "Total Expenses" : "एकूण खर्च"}
                </Text>
                <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              </View>
              <View style={[styles.monthDiffBadge,
                { backgroundColor: monthDiff > 0 ? "#FEF2F2" : monthDiff < 0 ? "#F0FDF4" : "#F3F4F6" }]}>
                {prevTotal > 0 && (
                  <>
                    <Ionicons
                      name={monthDiff > 0 ? "trending-up" : monthDiff < 0 ? "trending-down" : "remove"}
                      size={14}
                      color={monthDiff > 0 ? "#DC2626" : monthDiff < 0 ? "#16A34A" : "#9CA3AF"}
                    />
                    <Text style={[styles.monthDiffText,
                      { color: monthDiff > 0 ? "#DC2626" : monthDiff < 0 ? "#16A34A" : "#9CA3AF" }]}>
                      {monthDiff > 0 ? "+" : ""}{formatCurrency(Math.abs(monthDiff))} vs last
                    </Text>
                  </>
                )}
                {prevTotal === 0 && (
                  <Text style={styles.monthDiffText}>
                    {language === "en" ? "First month" : "पहिला महिना"}
                  </Text>
                )}
              </View>
            </View>

            {/* Budget progress */}
            {currentBudget > 0 && (
              <View style={styles.budgetSection}>
                <View style={styles.budgetLabelRow}>
                  <Text style={styles.budgetLabel}>
                    {language === "en" ? "Budget" : "बजेट"}: {formatCurrency(currentBudget)}
                  </Text>
                  <Text style={[styles.budgetPct, { color: budgetColor }]}>
                    {Math.round(budgetProgress * 100)}%
                  </Text>
                </View>
                <View style={styles.budgetBarBg}>
                  <View style={[styles.budgetBarFill, {
                    width: `${Math.round(budgetProgress * 100)}%`,
                    backgroundColor: budgetColor,
                  }]} />
                </View>
              </View>
            )}
          </View>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.monthNavButton}
              onPress={() => setSelectedMonth((m) => stepPrevYearMonth(m, minExpenseMonth))}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{getMonthLabel(selectedMonth, language)}</Text>
            <TouchableOpacity style={styles.monthNavButton}
              onPress={() => setSelectedMonth((m) => stepNextYearMonth(m))}>
              <Ionicons name="chevron-forward" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Category breakdown chips */}
          {categoryTotals.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breakdownScroll}>
              {categoryTotals.map(({ cat, total }) => {
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;
                const isActive = filterCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.breakdownChip,
                      { backgroundColor: isActive ? cfg.color : cfg.bg,
                        borderColor: cfg.color }]}
                    onPress={() => setFilterCategory(isActive ? null : cat)}
                  >
                    <Ionicons name={cfg.icon} size={13} color={isActive ? "#fff" : cfg.color} />
                    <Text style={[styles.breakdownChipLabel, { color: isActive ? "#fff" : cfg.color }]}>
                      {language === "mr" ? cfg.mr : cat}
                    </Text>
                    <Text style={[styles.breakdownChipAmount, { color: isActive ? "#fff" : cfg.color }]}>
                      {formatCurrency(total)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Search + Sort + Add row */}
          <View style={styles.toolbarRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={language === "en" ? "Search expenses…" : "खर्च शोधा…"}
                placeholderTextColor="#9CA3AF"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortPicker(true)}>
              <Ionicons name="funnel-outline" size={16} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Add expense button */}
          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>
              {language === "en" ? "Add Expense" : "खर्च जोडा"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Expense List ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#111827" />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <SwipeableCard
                item={item}
                language={language}
                onEdit={openEditForm}
                onDelete={handleDelete}
              />
            )}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            ListEmptyComponent={<EmptyState />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchExpenses(true)}
                tintColor="#111827"
              />
            }
          />
        )}
      </ScrollView>

      {/* ── Add / Edit Modal ── */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId
                  ? language === "en" ? "Edit Expense"  : "खर्च संपादित करा"
                  : language === "en" ? "Add Expense"   : "खर्च जोडा"}
              </Text>
              <TouchableOpacity onPress={closeForm} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={styles.label}>
                {language === "en" ? "Expense Title *" : "खर्चाचे शीर्षक *"}
              </Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={form.title}
                onChangeText={(t) => { setForm((f) => ({ ...f, title: t })); setErrors((e) => ({ ...e, title: null })); }}
                placeholder={language === "en" ? "e.g. Monthly vegetables" : "उदा. मासिक भाज्या"}
                placeholderTextColor="#9CA3AF"
              />
              {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

              {/* Category */}
              <Text style={styles.label}>{language === "en" ? "Category *" : "विभाग *"}</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerInput, errors.category && styles.inputError]}
                onPress={() => setShowCategoryPicker(true)}
              >
                {form.category ? (
                  <View style={styles.pickerSelectedRow}>
                    <View style={[styles.pickerCatDot,
                      { backgroundColor: CATEGORY_CONFIG[form.category]?.color || "#475569" }]} />
                    <Text style={styles.pickerText}>
                      {language === "mr"
                        ? CATEGORY_CONFIG[form.category]?.mr || form.category
                        : form.category}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.placeholderText}>
                    {language === "en" ? "Select category" : "विभाग निवडा"}
                  </Text>
                )}
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

              {showCategoryPicker && (
                <View style={styles.categoryOptions}>
                  {CATEGORIES.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const isSelected = form.category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryOption, isSelected && { backgroundColor: cfg.bg }]}
                        onPress={() => {
                          setForm((f) => ({ ...f, category: cat }));
                          setShowCategoryPicker(false);
                          setErrors((e) => ({ ...e, category: null }));
                        }}
                      >
                        <View style={[styles.catOptIcon, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                        </View>
                        <Text style={[styles.categoryOptionText, isSelected && { color: cfg.color, fontWeight: "700" }]}>
                          {language === "mr" ? cfg.mr : cat}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color={cfg.color} style={{ marginLeft: "auto" }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Amount with ₹ prefix */}
              <Text style={styles.label}>{language === "en" ? "Amount *" : "रक्कम *"}</Text>
              <View style={[styles.amountRow, errors.amount && styles.inputError]}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={form.amount}
                  onChangeText={(t) => {
                    setForm((f) => ({ ...f, amount: t }));
                    setErrors((e) => ({ ...e, amount: null }));
                  }}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

              {/* Date */}
              <Text style={styles.label}>{language === "en" ? "Date *" : "तारीख *"}</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerInput, errors.date && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.pickerText}>{formatDisplayDate(form.date, language)}</Text>
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={form.date}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                  maximumDate={new Date()}
                />
              )}
              {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}

              {/* Description */}
              <Text style={styles.label}>
                {language === "en" ? "Notes (optional)" : "टीपा (पर्यायी)"}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                placeholder={language === "en" ? "Add notes…" : "टीपा जोडा…"}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingId
                      ? language === "en" ? "Update Expense" : "अपडेट करा"
                      : language === "en" ? "Save Expense"   : "जतन करा"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sort Picker Modal ── */}
      <Modal visible={showSortPicker} transparent animationType="fade" onRequestClose={() => setShowSortPicker(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setShowSortPicker(false)}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>
              {language === "en" ? "Sort by" : "क्रमवारी लावा"}
            </Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortOption, sortMode === opt && styles.sortOptionActive]}
                onPress={() => { setSortMode(opt); setShowSortPicker(false); }}
              >
                <Text style={[styles.sortOptionText, sortMode === opt && styles.sortOptionTextActive]}>
                  {SORT_LABELS[opt][language === "mr" ? "mr" : "en"]}
                </Text>
                {sortMode === opt && <Ionicons name="checkmark" size={18} color="#111827" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Budget Modal ── */}
      <Modal visible={budgetModalVisible} transparent animationType="fade" onRequestClose={() => setBudgetModalVisible(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setBudgetModalVisible(false)}>
          <Pressable style={styles.budgetModal} onPress={() => {}}>
            <Text style={styles.sortModalTitle}>
              {language === "en"
                ? `Set Budget — ${getMonthLabel(selectedMonth, "en")}`
                : `बजेट सेट करा — ${getMonthLabel(selectedMonth, "mr")}`}
            </Text>
            <View style={[styles.amountRow, { marginHorizontal: 0, marginTop: 12 }]}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={budgetInput}
                onChangeText={setBudgetInput}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.saveButton, { marginHorizontal: 0, marginTop: 16 }]}
              onPress={() => {
                const val = Number(budgetInput);
                if (!isNaN(val) && val >= 0) {
                  setMonthBudgets((prev) => ({ ...prev, [selectedMonth]: val }));
                  setBudgetModalVisible(false);
                  setBudgetInput("");
                  showToast(language === "en" ? "Budget saved" : "बजेट जतन झाले");
                }
              }}
            >
              <Text style={styles.saveButtonText}>
                {language === "en" ? "Set Budget" : "बजेट सेट करा"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Toast ── */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backButton: { padding: 8, marginRight: 4 },
  pageTitle: { fontSize: 20, fontWeight: "700", color: "#111827", flex: 1 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerIconBtn: { padding: 8, borderRadius: 10, backgroundColor: "#F3F4F6" },

  // Top section
  topSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  // Total card
  totalCard: {
    backgroundColor: "#111827", borderRadius: 18, padding: 20, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  totalCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  totalLabel: { fontSize: 13, fontWeight: "500", color: "#9CA3AF", marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 },
  monthDiffBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  monthDiffText: { fontSize: 12, fontWeight: "600" },

  // Budget progress
  budgetSection: { marginTop: 16 },
  budgetLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  budgetLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  budgetPct: { fontSize: 12, fontWeight: "700" },
  budgetBarBg: { height: 6, backgroundColor: "#374151", borderRadius: 3 },
  budgetBarFill: { height: 6, borderRadius: 3 },

  // Month nav
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 12, gap: 12,
  },
  monthNavButton: { padding: 8, backgroundColor: "#fff", borderRadius: 10, elevation: 1 },
  monthLabel: { fontSize: 16, fontWeight: "700", color: "#111827", minWidth: 130, textAlign: "center" },

  // Breakdown chips
  breakdownScroll: { marginBottom: 12 },
  breakdownChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, marginRight: 8, borderWidth: 1,
  },
  breakdownChipLabel: { fontSize: 12, fontWeight: "600" },
  breakdownChipAmount: { fontSize: 12, fontWeight: "700" },

  // Toolbar
  toolbarRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  searchWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  sortBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
  },

  // Add button
  addButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 48, borderRadius: 12, backgroundColor: "#111827", marginBottom: 8,
  },
  addButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  // Loading
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // Section header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 4, marginTop: 4,
  },
  sectionHeaderText: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4 },
  sectionHeaderTotal: { fontSize: 13, fontWeight: "700", color: "#374151" },

  // Swipeable
  swipeWrapper: { position: "relative", marginBottom: 10 },
  swipeDeleteBg: {
    position: "absolute", right: 0, top: 0, bottom: 0,
    width: 80, borderRadius: 14,
    backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center",
  },
  swipeDeleteBtn: { alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 10 },
  swipeDeleteText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Card
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  categoryIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  cardAmount: { fontSize: 16, fontWeight: "800" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  categoryBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  categoryText: { fontSize: 11, fontWeight: "700" },
  datePill: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardDate: { fontSize: 11, color: "#9CA3AF" },
  cardDescription: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 10 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  editButton: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#111827",
  },
  editButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  deleteButton: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FEF2F2",
  },
  deleteButtonText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  swipeHint: { fontSize: 10, color: "#D1D5DB", marginLeft: "auto" },

  // Empty state
  emptyContainer: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#111827", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyAddBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginTop: 12 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalCloseBtn: { padding: 4 },

  // Form inputs
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 16, marginHorizontal: 20 },
  input: {
    backgroundColor: "#F9FAFB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: "#111827",
    marginHorizontal: 20, borderWidth: 1, borderColor: "#E5E7EB",
  },
  inputError: { borderColor: "#DC2626" },
  pickerInput: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerSelectedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerCatDot: { width: 10, height: 10, borderRadius: 5 },
  pickerText: { fontSize: 15, color: "#111827" },
  placeholderText: { fontSize: 15, color: "#9CA3AF" },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  // Amount with ₹ prefix
  amountRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 12,
    marginHorizontal: 20, borderWidth: 1, borderColor: "#E5E7EB",
    paddingLeft: 14,
  },
  currencyPrefix: { fontSize: 18, fontWeight: "700", color: "#111827", marginRight: 4 },
  amountInput: { flex: 1, fontSize: 15, color: "#111827", paddingVertical: 13, paddingRight: 14 },

  // Category dropdown
  categoryOptions: {
    marginHorizontal: 20, marginTop: 6,
    backgroundColor: "#FFFFFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden",
  },
  categoryOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 13, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  catOptIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  categoryOptionText: { fontSize: 15, color: "#111827", fontWeight: "500" },

  errorText: { fontSize: 12, color: "#DC2626", marginTop: 4, marginHorizontal: 20 },

  // Save button
  saveButton: {
    height: 50, borderRadius: 12, backgroundColor: "#111827",
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 20, marginTop: 24, marginBottom: 36,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  // Sort modal
  sortOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  sortModal: { backgroundColor: "#fff", borderRadius: 18, padding: 20, width: "84%", gap: 4 },
  sortModalTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  sortOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
  },
  sortOptionActive: { backgroundColor: "#F3F4F6" },
  sortOptionText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  sortOptionTextActive: { color: "#111827", fontWeight: "700" },

  // Budget modal
  budgetModal: { backgroundColor: "#fff", borderRadius: 18, padding: 20, width: "84%" },

  // Toast
  toast: {
    position: "absolute", bottom: 32, left: 24, right: 24,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", flex: 1 },
});
