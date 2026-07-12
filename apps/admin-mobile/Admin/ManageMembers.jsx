import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SectionList,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import { displayStatusMr, displayMealPlanMr } from "../../lib/memberLabelsMr";
import { fetchMemberDirectory } from "../../lib/memberDirectory";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MEAL_COLORS = {
  Lunch: { bg: "#FEF3C7", text: "#92400E", icon: "sunny-outline" },
  Dinner: { bg: "#EDE9FE", text: "#5B21B6", icon: "moon-outline" },
  Both: { bg: "#DBEAFE", text: "#1E40AF", icon: "restaurant-outline" },
};

const AVATAR_COLORS = [
  "#F97316", "#8B5CF6", "#06B6D4", "#10B981",
  "#EF4444", "#3B82F6", "#EC4899", "#14B8A6",
];

const getAvatarColor = (name = "") => {
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getSectionKey = (name = "") => {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};

const buildSections = (members) => {
  const map = {};
  for (const m of members) {
    const key = getSectionKey(m.name);
    if (!map[key]) map[key] = [];
    map[key].push(m);
  }
  return Object.keys(map)
    .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map((title) => ({ title, data: map[title] }));
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────

const SkeletonCard = () => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonLines}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineNarrow} />
      </View>
      <View style={styles.skeletonBadge} />
    </Animated.View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ManageMembers = () => {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  // ── Data ──
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Search / Filter / Sort ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");   // All | Active | Inactive
  const [filterMeal, setFilterMeal] = useState("All");       // All | Lunch | Dinner | Both
  const [sortBy, setSortBy] = useState("name-az");           // name-az | name-za | date-new | date-old
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── Add Member Form ──
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [showJoiningDatePicker, setShowJoiningDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [newMember, setNewMember] = useState({
    name: "",
    roomOwnerName: "",
    phone: "",
    email: "",
    password: "",
    mealPlan: "Lunch",
    status: "Active",
    joiningDate: new Date(),
  });

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchMemberDirectory(api);
      setStudents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message || t("manage_members_alert_generic_error")
      );
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await api.get("/api/pending-registrations");
      const rows = Array.isArray(res.data) ? res.data : [];
      setPendingApprovalCount(rows.length);
      if (rows.length > 0) setBannerDismissed(false);
    } catch (_) {
      setPendingApprovalCount(0);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace("/"); return; }
    if (isAuthenticated) fetchStudents();
  }, [authLoading, isAuthenticated, fetchStudents]);

  useEffect(() => {
    if (isAuthenticated) fetchPendingApprovals();
  }, [isAuthenticated, fetchPendingApprovals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStudents(), fetchPendingApprovals()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStudents, fetchPendingApprovals]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const filtered = (() => {
    const q = (searchQuery || "").toLowerCase().trim();
    return students
      .filter((s) => {
        const name = language === "mr" ? s.nameMr || s.name : s.name;
        const room = language === "mr"
          ? s.roomOwnerNameMr || s.roomOwnerName
          : s.roomOwnerName;
        const matchSearch = !q ||
          (name || "").toLowerCase().includes(q) ||
          (room || "").toLowerCase().includes(q) ||
          (s.rollNumber || "").toLowerCase().includes(q);
        const matchStatus = filterStatus === "All" || s.status === filterStatus;
        const matchMeal = filterMeal === "All" || s.mealPlan === filterMeal;
        return matchSearch && matchStatus && matchMeal;
      })
      .sort((a, b) => {
        if (sortBy === "name-az") return (a.name || "").localeCompare(b.name || "");
        if (sortBy === "name-za") return (b.name || "").localeCompare(a.name || "");
        if (sortBy === "date-new") return new Date(b.joiningDate || 0) - new Date(a.joiningDate || 0);
        if (sortBy === "date-old") return new Date(a.joiningDate || 0) - new Date(b.joiningDate || 0);
        return 0;
      });
  })();

  const totalCount = students.length;
  const activeCount = students.filter((s) => s.status === "Active").length;
  const inactiveCount = students.filter((s) => s.status === "Inactive").length;

  const sections = buildSections(filtered);

  // ─── Add Member ───────────────────────────────────────────────────────────

  const updateNewMember = (key, value) => {
    setNewMember((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: null }));
  };

  const resetNewMemberForm = () => {
    setNewMember({
      name: "", roomOwnerName: "", phone: "", email: "",
      password: "", mealPlan: "Lunch", status: "Active", joiningDate: new Date(),
    });
    setFormErrors({});
    setShowJoiningDatePicker(false);
    setShowPassword(false);
  };

  const validateForm = () => {
    const errors = {};
    if (!newMember.name.trim()) errors.name = language === "en" ? "Name is required" : "नाव आवश्यक आहे";
    if (!newMember.roomOwnerName.trim()) errors.roomOwnerName = language === "en" ? "Room owner is required" : "रूम मालक आवश्यक आहे";
    if (!newMember.phone.trim()) errors.phone = language === "en" ? "Phone is required" : "फोन आवश्यक आहे";
    else if (!/^\d{10}$/.test(newMember.phone.trim())) errors.phone = language === "en" ? "Enter a valid 10-digit number" : "१० अंकी फोन नंबर टाका";
    if (!newMember.password.trim()) errors.password = language === "en" ? "Password is required" : "पासवर्ड आवश्यक आहे";
    else if (newMember.password.trim().length < 6) errors.password = language === "en" ? "Minimum 6 characters" : "किमान ६ अक्षरे";
    if (newMember.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMember.email.trim()))
      errors.email = language === "en" ? "Invalid email address" : "अवैध ईमेल पत्ता";
    return errors;
  };

  const createMember = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    const payload = {
      name: newMember.name.trim(),
      roomOwnerName: newMember.roomOwnerName.trim(),
      phone: newMember.phone.trim(),
      email: newMember.email.trim(),
      password: newMember.password.trim(),
      mealPlan: ["Lunch", "Dinner", "Both"].includes(newMember.mealPlan) ? newMember.mealPlan : "Lunch",
      status: newMember.status === "Inactive" ? "Inactive" : "Active",
      joiningDate: newMember.joiningDate instanceof Date && !Number.isNaN(newMember.joiningDate.getTime())
        ? newMember.joiningDate.toISOString()
        : new Date().toISOString(),
    };

    try {
      setCreatingMember(true);
      await api.post("/api/members", payload);
      await Promise.all([fetchStudents(), fetchPendingApprovals()]);
      resetNewMemberForm();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowAddMemberForm(false);
      Alert.alert(
        language === "en" ? "✓ Member Added" : "✓ सदस्य जोडला",
        language === "en" ? "Member has been added successfully." : "सदस्य यशस्वीरित्या जोडला गेला."
      );
    } catch (err) {
      Alert.alert(
        language === "en" ? "Error" : "त्रुटी",
        err?.response?.data?.message || (language === "en" ? "Failed to add member." : "सदस्य जोडता आला नाही.")
      );
    } finally {
      setCreatingMember(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const openMemberDetails = (member) => {
    router.push({ pathname: "/Admin/MemberDetails", params: { memberId: String(member._id) } });
  };

  const sortLabels = {
    "name-az": language === "en" ? "Name A→Z" : "नाव A→Z",
    "name-za": language === "en" ? "Name Z→A" : "नाव Z→A",
    "date-new": language === "en" ? "Newest First" : "नवीन प्रथम",
    "date-old": language === "en" ? "Oldest First" : "जुने प्रथम",
  };

  const renderMemberCard = ({ item }) => {
    const name = language === "mr" ? item.nameMr || item.name : item.name;
    const room = language === "mr"
      ? item.roomOwnerNameMr || item.roomOwnerName
      : item.roomOwnerName;
    const avatarColor = getAvatarColor(item.name);
    const meal = item.mealPlan || "Lunch";
    const mealStyle = MEAL_COLORS[meal] || MEAL_COLORS.Lunch;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => openMemberDetails(item)}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{name || "—"}</Text>
          <View style={styles.cardMeta}>
            {!!room && (
              <View style={styles.cardMetaItem}>
                <Ionicons name="home-outline" size={11} color="#6B7280" />
                <Text style={styles.cardMetaText} numberOfLines={1}>{room}</Text>
              </View>
            )}
            {!!item.rollNumber && (
              <View style={styles.cardMetaItem}>
                <Ionicons name="card-outline" size={11} color="#6B7280" />
                <Text style={styles.cardMetaText}>{item.rollNumber}</Text>
              </View>
            )}
          </View>
          {/* Badges row */}
          <View style={styles.cardBadges}>
            <View style={[styles.mealBadge, { backgroundColor: mealStyle.bg }]}>
              <Ionicons name={mealStyle.icon} size={10} color={mealStyle.text} />
              <Text style={[styles.mealBadgeText, { color: mealStyle.text }]}>
                {displayMealPlanMr(language, meal, item.mealPlanMr)}
              </Text>
            </View>
            <View style={[styles.statusBadge, item.status === "Active" ? styles.statusActive : styles.statusInactive]}>
              <View style={[styles.statusDot, { backgroundColor: item.status === "Active" ? "#16A34A" : "#DC2626" }]} />
              <Text style={[styles.statusText, item.status === "Active" ? styles.statusTextActive : styles.statusTextInactive]}>
                {displayStatusMr(language, item.status || "Active", item.statusMr)}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  // ─── Loading State ────────────────────────────────────────────────────────

  if (authLoading || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {language === "en" ? "Manage Members" : "सदस्य व्यवस्थापन"}
        </Text>
        <TouchableOpacity
          style={styles.headerApprovalButton}
          onPress={() => router.push("/Admin/MembersApproval")}
          activeOpacity={0.7}
        >
          <Image
            source={require("../../assets/images/user.png")}
            style={styles.headerApprovalIconImage}
            resizeMode="contain"
          />
          {pendingApprovalCount > 0 ? (
            <View style={styles.headerApprovalBadge}>
              <Text style={styles.headerApprovalBadgeText}>
                {pendingApprovalCount > 9 ? "9+" : String(pendingApprovalCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* ── Pending Approvals Banner ── */}
      {pendingApprovalCount > 0 && !bannerDismissed && (
        <TouchableOpacity
          style={styles.approvalBanner}
          activeOpacity={0.85}
          onPress={() => router.push("/Admin/MembersApproval")}
        >
          <View style={styles.approvalBannerLeft}>
            <Ionicons name="time-outline" size={18} color="#92400E" />
            <Text style={styles.approvalBannerText}>
              {pendingApprovalCount}{" "}
              {language === "en"
                ? `member${pendingApprovalCount > 1 ? "s" : ""} awaiting approval`
                : "सदस्य मंजुरीच्या प्रतीक्षेत"}
            </Text>
          </View>
          <View style={styles.approvalBannerRight}>
            <Text style={styles.approvalBannerAction}>
              {language === "en" ? "Review" : "पहा"}
            </Text>
            <TouchableOpacity onPress={() => setBannerDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#92400E" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Stats Bar ── */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>{language === "en" ? "Total" : "एकूण"}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: "#16A34A" }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>{language === "en" ? "Active" : "सक्रिय"}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: "#DC2626" }]}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>{language === "en" ? "Inactive" : "निष्क्रिय"}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{filtered.length}</Text>
          <Text style={styles.statLabel}>{language === "en" ? "Showing" : "दाखवत"}</Text>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === "en" ? "Search name, ID, room owner…" : "नाव, आयडी, रूम मालक…"}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Filter & Sort Row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {/* Status filter */}
        {["All", "Active", "Inactive"].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
            onPress={() => setFilterStatus(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>
              {language === "en" ? s : s === "All" ? "सर्व" : s === "Active" ? "सक्रिय" : "निष्क्रिय"}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterSeparator} />

        {/* Meal Plan filter */}
        {["All", "Lunch", "Dinner", "Both"].map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.filterChip, filterMeal === m && styles.filterChipMealActive]}
            onPress={() => setFilterMeal(m)}
            activeOpacity={0.75}
          >
            {m !== "All" && (
              <Ionicons
                name={MEAL_COLORS[m]?.icon || "restaurant-outline"}
                size={12}
                color={filterMeal === m ? "#1E40AF" : "#6B7280"}
              />
            )}
            <Text style={[styles.filterChipText, filterMeal === m && styles.filterChipMealActiveText]}>
              {language === "en"
                ? m
                : m === "All" ? "सर्व जेवण" : m === "Lunch" ? "दुपार" : m === "Dinner" ? "रात्र" : "दोन्ही"}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterSeparator} />

        {/* Sort button */}
        <TouchableOpacity
          style={[styles.filterChip, styles.sortChip, showSortMenu && styles.filterChipActive]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowSortMenu((p) => !p);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="swap-vertical-outline" size={13} color={showSortMenu ? "#111827" : "#6B7280"} />
          <Text style={[styles.filterChipText, showSortMenu && styles.filterChipTextActive]}>
            {sortLabels[sortBy]}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sort Menu Dropdown */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {Object.entries(sortLabels).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.sortMenuItem, sortBy === key && styles.sortMenuItemActive]}
              onPress={() => {
                setSortBy(key);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortMenuText, sortBy === key && styles.sortMenuTextActive]}>{label}</Text>
              {sortBy === key && <Ionicons name="checkmark" size={16} color="#111827" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Add Member Toggle ── */}
      <View style={styles.addMemberSection}>
        <TouchableOpacity
          style={[styles.addMemberToggle, showAddMemberForm && styles.addMemberToggleOpen]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAddMemberForm((prev) => !prev);
          }}
          activeOpacity={0.8}
          disabled={creatingMember}
        >
          <Ionicons
            name={showAddMemberForm ? "remove-circle-outline" : "add-circle-outline"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.addMemberToggleText}>
            {showAddMemberForm
              ? language === "en" ? "Close Form" : "फॉर्म बंद करा"
              : language === "en" ? "Add New Member" : "नवीन सदस्य जोडा"}
          </Text>
        </TouchableOpacity>

        {/* ── Add Member Form ── */}
        {showAddMemberForm && (
          <View style={styles.addMemberForm}>
            {/* Name */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                {language === "en" ? "Member Name" : "सदस्य नाव"} <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.formInputWrap, formErrors.name && styles.formInputError]}>
                <Ionicons name="person-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder={language === "en" ? "Enter full name" : "पूर्ण नाव टाका"}
                  placeholderTextColor="#9CA3AF"
                  value={newMember.name}
                  onChangeText={(v) => updateNewMember("name", v)}
                />
              </View>
              {!!formErrors.name && <Text style={styles.fieldError}>{formErrors.name}</Text>}
            </View>

            {/* Room Owner */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                {language === "en" ? "Room Owner" : "रूम मालक"} <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.formInputWrap, formErrors.roomOwnerName && styles.formInputError]}>
                <Ionicons name="home-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder={language === "en" ? "Enter room owner name" : "रूम मालकाचे नाव"}
                  placeholderTextColor="#9CA3AF"
                  value={newMember.roomOwnerName}
                  onChangeText={(v) => updateNewMember("roomOwnerName", v)}
                />
              </View>
              {!!formErrors.roomOwnerName && <Text style={styles.fieldError}>{formErrors.roomOwnerName}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                {language === "en" ? "Phone" : "फोन"} <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.formInputWrap, formErrors.phone && styles.formInputError]}>
                <Ionicons name="call-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder="10-digit number"
                  placeholderTextColor="#9CA3AF"
                  value={newMember.phone}
                  onChangeText={(v) => updateNewMember("phone", v)}
                  keyboardType="phone-pad"
                />
              </View>
              {!!formErrors.phone && <Text style={styles.fieldError}>{formErrors.phone}</Text>}
            </View>

            {/* Email */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                {language === "en" ? "Email" : "ईमेल"}{" "}
                <Text style={styles.optional}>({language === "en" ? "optional" : "ऐच्छिक"})</Text>
              </Text>
              <View style={[styles.formInputWrap, formErrors.email && styles.formInputError]}>
                <Ionicons name="mail-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder="email@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={newMember.email}
                  onChangeText={(v) => updateNewMember("email", v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {!!formErrors.email && <Text style={styles.fieldError}>{formErrors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                {language === "en" ? "Password" : "पासवर्ड"} <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.formInputWrap, formErrors.password && styles.formInputError]}>
                <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder={language === "en" ? "Min. 6 characters" : "किमान ६ अक्षरे"}
                  placeholderTextColor="#9CA3AF"
                  value={newMember.password}
                  onChangeText={(v) => updateNewMember("password", v)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {!!formErrors.password && <Text style={styles.fieldError}>{formErrors.password}</Text>}
            </View>

            {/* Joining Date */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{language === "en" ? "Joining Date" : "जॉईनिंग तारीख"}</Text>
              <TouchableOpacity
                style={[styles.formInputWrap, styles.dateInputWrap]}
                onPress={() => setShowJoiningDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" style={styles.formInputIcon} />
                <Text style={styles.dateText}>
                  {new Date(newMember.joiningDate || new Date()).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            {showJoiningDatePicker && (
              <DateTimePicker
                value={newMember?.joiningDate instanceof Date && !Number.isNaN(newMember.joiningDate.getTime())
                  ? newMember.joiningDate : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== "ios") setShowJoiningDatePicker(false);
                  if (selectedDate) updateNewMember("joiningDate", selectedDate);
                }}
              />
            )}

            {/* Meal Plan */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{language === "en" ? "Meal Plan" : "जेवण योजना"}</Text>
              <View style={styles.pillRow}>
                {["Lunch", "Dinner", "Both"].map((plan) => {
                  const mc = MEAL_COLORS[plan];
                  const selected = newMember.mealPlan === plan;
                  return (
                    <TouchableOpacity
                      key={plan}
                      style={[styles.pill, selected && { backgroundColor: mc.bg, borderColor: mc.text }]}
                      onPress={() => updateNewMember("mealPlan", plan)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={mc.icon} size={13} color={selected ? mc.text : "#6B7280"} />
                      <Text style={[styles.pillText, selected && { color: mc.text, fontWeight: "700" }]}>
                        {plan}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Status */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>{language === "en" ? "Status" : "स्थिती"}</Text>
              <View style={styles.pillRow}>
                {["Active", "Inactive"].map((state) => {
                  const selected = newMember.status === state;
                  const color = state === "Active" ? "#16A34A" : "#DC2626";
                  const bgColor = state === "Active" ? "#D1FAE5" : "#FEE2E2";
                  return (
                    <TouchableOpacity
                      key={state}
                      style={[styles.pill, selected && { backgroundColor: bgColor, borderColor: color }]}
                      onPress={() => updateNewMember("status", state)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.statusDot, { backgroundColor: selected ? color : "#D1D5DB" }]} />
                      <Text style={[styles.pillText, selected && { color, fontWeight: "700" }]}>
                        {language === "en" ? state : state === "Active" ? "सक्रिय" : "निष्क्रिय"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelButton]}
                onPress={() => { resetNewMemberForm(); setShowAddMemberForm(false); }}
                disabled={creatingMember}
              >
                <Text style={styles.cancelButtonText}>{language === "en" ? "Cancel" : "रद्द करा"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, creatingMember && styles.submitButtonDisabled]}
                onPress={createMember}
                disabled={creatingMember}
              >
                {creatingMember ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                    <Text style={styles.submitButtonText}>
                      {language === "en" ? "Save Member" : "सदस्य सेव्ह करा"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Member List ── */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={renderMemberCard}
          renderSectionHeader={renderSectionHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />}
          contentContainerStyle={[styles.listContent, sections.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={72} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>
                {searchQuery || filterStatus !== "All" || filterMeal !== "All"
                  ? language === "en" ? "No Results Found" : "निकाल आढळले नाहीत"
                  : language === "en" ? "No Members Yet" : "अद्याप सदस्य नाहीत"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || filterStatus !== "All" || filterMeal !== "All"
                  ? language === "en" ? "Try adjusting your search or filters" : "शोध किंवा फिल्टर बदलून पहा"
                  : language === "en" ? "Add your first member using the button above" : "वर बटण वापरून पहिला सदस्य जोडा"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ManageMembers;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  // Loading
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { padding: 8 },
  title: { fontSize: 19, fontWeight: "700", color: "#111827" },
  headerApprovalButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  headerApprovalIconImage: { width: 34, height: 34 },
  headerApprovalBadge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center",
  },
  headerApprovalBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },

  // Pending Approvals Banner
  approvalBanner: {
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  approvalBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  approvalBannerText: { fontSize: 13, fontWeight: "600", color: "#92400E", flex: 1 },
  approvalBannerRight: { flexDirection: "row", alignItems: "center" },
  approvalBannerAction: { fontSize: 13, fontWeight: "700", color: "#92400E", textDecorationLine: "underline" },

  // Stats Bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 2, fontWeight: "500" },
  statDivider: { width: 1, backgroundColor: "#F3F4F6", marginVertical: 4 },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: "#111827" },
  clearSearch: { padding: 4 },

  // Filter Row
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterChipMealActive: { backgroundColor: "#DBEAFE", borderColor: "#93C5FD" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  filterChipTextActive: { color: "#FFFFFF" },
  filterChipMealActiveText: { color: "#1E40AF" },
  filterSeparator: { width: 1, height: 20, backgroundColor: "#E5E7EB", marginHorizontal: 2 },
  sortChip: { flexDirection: "row", gap: 4 },

  // Sort Menu
  sortMenu: {
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sortMenuItemActive: { backgroundColor: "#F9FAFB" },
  sortMenuText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  sortMenuTextActive: { color: "#111827", fontWeight: "700" },

  // Add Member
  addMemberSection: { marginHorizontal: 16, marginTop: 6, marginBottom: 6 },
  addMemberToggle: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addMemberToggleOpen: { backgroundColor: "#374151" },
  addMemberToggleText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  addMemberForm: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    gap: 6,
  },

  // Form Fields
  formField: { gap: 4 },
  formLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  required: { color: "#EF4444" },
  optional: { color: "#9CA3AF", fontWeight: "400" },
  formInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
  },
  formInputError: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  formInputIcon: { marginRight: 8 },
  formInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: "#111827" },
  fieldError: { fontSize: 11, color: "#EF4444", marginTop: 2 },
  eyeBtn: { padding: 6 },
  dateInputWrap: { paddingVertical: 11 },
  dateText: { fontSize: 14, color: "#111827", fontWeight: "500" },

  // Pills
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingVertical: 9,
    backgroundColor: "#F9FAFB",
  },
  pillText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },

  // Form Actions
  formActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  cancelButtonText: { color: "#374151", fontSize: 14, fontWeight: "600" },
  submitButton: {
    flex: 2,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // Section List
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  listContentEmpty: { flex: 1 },

  sectionHeader: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // Member Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardMeta: { flexDirection: "row", gap: 10 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardMetaText: { fontSize: 12, color: "#6B7280", maxWidth: 130 },
  cardBadges: { flexDirection: "row", gap: 6, marginTop: 2 },
  mealBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  mealBadgeText: { fontSize: 11, fontWeight: "600" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusActive: { backgroundColor: "#D1FAE5" },
  statusInactive: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 11, fontWeight: "600" },
  statusTextActive: { color: "#065F46" },
  statusTextInactive: { color: "#991B1B" },

  // Skeleton
  skeletonContainer: { paddingHorizontal: 16, paddingTop: 8 },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  skeletonAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#E5E7EB", marginRight: 12 },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLineWide: { height: 14, backgroundColor: "#E5E7EB", borderRadius: 8, width: "70%" },
  skeletonLineNarrow: { height: 11, backgroundColor: "#F3F4F6", borderRadius: 8, width: "45%" },
  skeletonBadge: { width: 52, height: 22, backgroundColor: "#E5E7EB", borderRadius: 999, marginLeft: 8 },

  // Empty State
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151", marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center", paddingHorizontal: 32 },
});
