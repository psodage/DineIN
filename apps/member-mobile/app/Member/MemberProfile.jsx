import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import api from "../../lib/api";
import { displayMealPlanMr, displayStatusMr } from "../../lib/memberLabelsMr";
import MemberBill from "./MemberBill";
import FullScreenLoading from "../../components/FullScreenLoading";

const MemberProfile = ({ embedded = false, mode = "profile" }) => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { language } = useLanguage();
  const [member, setMember] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/");
    }
  }, [loading, isAuthenticated]);

  const fetchMemberProfile = useCallback(async () => {
    if (!user?.id && !user?.email) {
      setProfileLoading(false);
      return;
    }

    try {
      setProfileLoading(true);
      setError(null);

      if (!user?.id) {
        setMember(null);
        return;
      }

      const res = await api.get(`/api/members/${user.id}`);
      setMember(res?.data || null);
    } catch (err) {
      console.error("Fetch member profile error:", err);
      setError(
        err?.response?.data?.message || "Failed to load member profile"
      );
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      fetchMemberProfile();
    }
  }, [loading, isAuthenticated, fetchMemberProfile]);

  if (loading || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <FullScreenLoading visible color="#111827" />
      </View>
    );
  }

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <FullScreenLoading visible color="#111827" />
      </SafeAreaView>
    );
  }

  const memberName = member?.name || user?.name || "Rahul Patil";
  const roomOwnerName = member?.roomOwnerName || user?.roomOwnerName || "N/A";
  const phone = member?.phone || "N/A";
  const email = member?.email || user?.email || "N/A";
  const joiningDate = member?.joiningDate
    ? new Date(member.joiningDate).toLocaleDateString()
    : "N/A";
  const statusEn = member?.status || "N/A";
  const mealPlanEn = member?.mealPlan || "N/A";
  const status = displayStatusMr(language, statusEn, member?.statusMr);
  const mealPlan = displayMealPlanMr(language, mealPlanEn, member?.mealPlanMr);
  const normalizedMealPlan = String(mealPlanEn).trim();
  // Fee is based on meal plan selection:
  // - Both => 3000
  // - Lunch or Dinner => 1500
  const totalMessFeeNumber = (() => {
    if (normalizedMealPlan === "Both") return 3000;
    if (
      normalizedMealPlan === "Lunch" ||
      normalizedMealPlan === "Dinner"
    )
      return 1500;
    if (typeof member?.totalMessFee === "number") return member.totalMessFee;
    return null;
  })();

  const totalMessFee =
    typeof totalMessFeeNumber === "number" ? `₹${totalMessFeeNumber}` : "N/A";

  const dueAmountNumber =
    typeof member?.dueAmount === "number" ? member.dueAmount : null;
  const dueAmount =
    typeof dueAmountNumber === "number" ? `₹${dueAmountNumber}` : "N/A";
  const monthlyDueBills = Array.isArray(member?.monthlyDueBills)
    ? member.monthlyDueBills
    : [];
  const combinedDueMonthsTotalBill = monthlyDueBills.reduce(
    (sum, b) => sum + Number(b?.totalBill || 0),
    0
  );

  const isMembershipActive = String(statusEn).trim() === "Active";
  const membershipBadgeVariant = isMembershipActive ? "active" : "due";

  const mealPlanPillLabel =
    language === "mr"
      ? mealPlan
      : normalizedMealPlan === "Both"
        ? "Lunch & Dinner"
        : mealPlan;

  const dueStatus = (() => {
    if (typeof dueAmountNumber !== "number") return null;
    if (dueAmountNumber > 0) {
      return {
        variant: "due",
        label: language === "mr" ? "बाकी" : "Due",
      };
    }
    return {
      variant: "active",
      label: language === "mr" ? "भुगतान झाले" : "Paid",
    };
  })();

  const paymentProgressRatio = (() => {
    if (typeof totalMessFeeNumber !== "number") return 0;
    if (typeof dueAmountNumber !== "number") return 0;
    const paid = Math.max(0, totalMessFeeNumber - dueAmountNumber);
    const ratio = totalMessFeeNumber > 0 ? paid / totalMessFeeNumber : 0;
    return Math.min(1, Math.max(0, ratio));
  })();

  const percentPaid = Math.round(paymentProgressRatio * 100);
  const effectiveMode =
    embedded ? mode : String(params?.mode || mode || "profile").toLowerCase();
  const billingOnly = effectiveMode === "bill";

  const settingsItems = [
    { key: "edit", title: "Edit Profile", icon: "person-outline" },
    { key: "password", title: "Change Password", icon: "lock-closed-outline" },
    
  ];

  const navItems = [
    { key: "snacks", label: "Extra Snacks", icon: "fast-food-outline" },
    { key: "leaves", label: "Leaves", icon: "calendar-outline" },
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "bill", label: "Bill", icon: "receipt-outline" },
    { key: "profile", label: "Profile", icon: "person-outline" },
  ];

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/");
        },
      },
    ]);
  };

  const handleTabPress = (tabKey) => {
    if (tabKey === "profile") {
      router.push("/Member/MemberProfile");
      return;
    }
    if (tabKey === "bill") {
      router.push("/Member/MemberBill");
      return;
    }
    if (tabKey === "home") {
      router.push("/Member/MemberDashboard");
      return;
    }
    if (tabKey === "snacks") {
      router.push("/Member/SnackOrderPage");
      return;
    }
    if (tabKey === "leaves") {
      router.push("/Member/MemberLeave");
    }
  };

  const handleSettingPress = (key) => {
    if (key === "edit") {
      router.push("/Member/MemberEditProfile");
      return;
    }
    if (key === "password") {
      router.push("/Member/MemberChangePasswordScreen");
    }
  };

  const content = (
    <ScrollView
      style={styles.profileScreen}
      contentContainerStyle={[
        styles.profileScrollContent,
        !embedded && styles.profileScrollContentStandalone,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            try {
              setRefreshing(true);
              await fetchMemberProfile();
            } finally {
              setRefreshing(false);
            }
          }}
          tintColor={COLORS.primaryTeal}
        />
      }
    >
      {!billingOnly && (
        <View style={styles.heroCard}>
          <View style={styles.heroPatternOne}>
            <Ionicons name="ice-cream-outline" size={34} color={COLORS.headerPattern} />
          </View>
          <View style={styles.heroPatternTwo}>
            <Ionicons name="nutrition-outline" size={34} color={COLORS.headerPattern} />
          </View>
          <View style={styles.heroPatternThree}>
            <Ionicons name="fast-food-outline" size={34} color={COLORS.headerPattern} />
          </View>
          <View style={styles.heroPatternFour}>
            <Ionicons name="cafe-outline" size={30} color={COLORS.headerPattern} />
          </View>

          

          <View style={styles.heroProfileRow}>
            <View style={styles.heroAvatarShell}>
              <AvatarGradient size={88} />
            </View>
            <View style={styles.heroContent}>
              
              <Text style={styles.heroMemberName}>{memberName}</Text>
              <View style={styles.heroStatusPill}>
                <View style={styles.heroStatusDot} />
                <Text style={styles.heroStatusText}>
                  {status || (isMembershipActive ? "Active" : "Inactive")}
                </Text>
              </View>
              <View style={styles.heroMetaRow}>
                <Ionicons name="home-outline" size={14} color="#FFFFFF" />
                <Text style={styles.heroMetaText}>
                  {roomOwnerName !== "N/A" ? `Room Owner: ${roomOwnerName}` : "Room Owner: N/A"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.profileCardsWrap}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.premiumProfileCard}>
          <SectionHeaderBlock
            iconName="person-outline"
            iconColor={COLORS.primaryTeal}
            iconBg="#E8F8F5"
            title="Personal Information"
            subtitle="Your personal details and contact info"
          />
          <PremiumInfoRow icon="person-outline" label="Name" value={memberName} />
          <PremiumInfoRow icon="call-outline" label="Phone" value={phone} />
          <PremiumInfoRow icon="mail-outline" label="Email" value={email} last />
        </View>

        <View style={styles.premiumProfileCard}>
          <SectionHeaderBlock
            iconName="restaurant-outline"
            iconColor={COLORS.primaryTeal}
            iconBg="#E8F8F5"
            title="Membership Information"
            subtitle="Your membership and meal plan details"
          />
          <PremiumInfoRow
            icon="calendar-outline"
            label="Joining Date"
            value={joiningDate}
          />
          <PremiumInfoRow
            icon="sparkles-outline"
            label="Membership Status"
            value={
              <StatusBadge
                variant={membershipBadgeVariant}
                label={status || (isMembershipActive ? "Active" : "Inactive")}
              />
            }
          />
          <PremiumInfoRow
            icon="restaurant-outline"
            label="Meal Plan"
            value={<PillBadge label={mealPlanPillLabel} />}
            last
          />
        </View>

        <View style={[styles.premiumProfileCard, styles.accountSettingsCard]}>
          <SectionHeaderBlock
            iconName="settings-outline"
            iconColor={COLORS.primaryTeal}
            iconBg="#E8F8F5"
            title="Account & Settings"
            subtitle="Manage your account and preferences"
          />
          <View style={styles.settingsGrid}>
            {settingsItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.settingMiniCard}
                activeOpacity={0.85}
                onPress={() => handleSettingPress(item.key)}
              >
                <View style={styles.settingMiniTopRow}>
                  <View style={styles.settingMiniIconBox}>
                    <Ionicons name={item.icon} size={20} color={COLORS.primaryTeal} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#A6AFB8" />
                </View>
                <Text style={styles.settingMiniTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      

        
      </View>
    </ScrollView>
  );

  const standaloneBottomNav = !embedded && !billingOnly ? (
    <View style={styles.bottomBarWrap}>
      <View style={styles.bottomBar}>
        {navItems.map((tab) => {
          const isActive = tab.key === "profile";
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.bottomTab}
              activeOpacity={0.85}
              onPress={() => handleTabPress(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={isActive ? 24 : 21}
                color={isActive ? COLORS.primaryTeal : "#9AA5B1"}
              />
              <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      {billingOnly ? <MemberBill /> : content}
      {standaloneBottomNav}
    </SafeAreaView>
  );
};

export default MemberProfile;

const COLORS = {
  bg: "#F8FAFC", // light neutral background
  card: "#FFFFFF",
  // Brand / accents (multi-color theme)
  indigo: "#4F46E5",
  indigoSoft: "#EEF2FF",
  teal: "#0F766E",
  tealSoft: "#CCFBF1",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  primaryText: "#0F172A",
  label: "#6B7280",
  divider: "#E5E7EB",
  softAccentBg: "#F3F4F6", // neutral grey for pills / icon circles
  softAccentBgAlt: "#E5E7EB",
  dueRed: "#DC2626",
  dueBg: "#FEE2E2",
  activeAccent: "#166534",
  activeBg: "#DCFCE7",
  shadow: "#000000",

  // Section accents
  sectionPersonal: "#4F46E5",
  sectionMembership: "#0F766E",
  sectionBilling: "#D97706",
  sectionMonthly: "#7C3AED",
  primaryTeal: "#0F8F88",
  bgPremium: "#F5F7FA",
  textNavy: "#101828",
  mutedText: "#6B7280",
  orangeAccent: "#F59E0B",
  purpleAccent: "#8B5CF6",
  redAccent: "#E11D48",
  greenAccent: "#16A34A",
  headerPattern: "rgba(255,255,255,0.14)",
};

function Divider() {
  return <View style={styles.divider} />;
}

function StatusBadge({ variant, label, small }) {
  const isActive = variant === "active";
  const isDue = variant === "due";

  return (
    <View
      style={[
        styles.badgeBase,
        small ? styles.badgeSmall : styles.badgeLarge,
        isActive ? styles.badgeActive : styles.badgeDue,
      ]}
    >
      <Text
        style={[
          isActive ? styles.badgeTextActive : styles.badgeTextDue,
          small ? styles.badgeTextSmall : styles.badgeText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PillBadge({ label }) {
  return (
    <View style={styles.pillBadge}>
      <Text style={styles.pillBadgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Card({ children }) {
  return (
    <View style={styles.card}>
      {children}
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconCircle}>{icon}</View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SectionHeaderBlock({
  iconName,
  iconColor,
  iconBg,
  title,
  subtitle,
  actionLabel,
}) {
  return (
    <View style={styles.sectionBlockHeader}>
      <View style={styles.sectionBlockLeft}>
        <View style={[styles.sectionBlockIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={17} color={iconColor} />
        </View>
        <View>
          <Text style={styles.sectionBlockTitle}>{title}</Text>
          <Text style={styles.sectionBlockSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {actionLabel ? <Text style={styles.sectionActionText}>{actionLabel}</Text> : null}
    </View>
  );
}

function PremiumInfoRow({ icon, label, value, last = false }) {
  const isTextValue = typeof value === "string" || typeof value === "number";

  return (
    <View style={[styles.premiumInfoRow, last && styles.premiumInfoRowLast]}>
      <View style={styles.premiumInfoLeft}>
        <View style={styles.premiumInfoIconBox}>
          <Ionicons name={icon} size={18} color={COLORS.primaryTeal} />
        </View>
        <Text style={styles.premiumInfoLabel}>{label}</Text>
      </View>
      {isTextValue ? (
        <Text style={styles.premiumInfoValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <View
          style={[
            styles.premiumInfoCustomValue,
            label === "Meal Plan" && styles.premiumInfoCustomValueMealPlan,
          ]}
        >
          {value}
        </View>
      )}
    </View>
  );
}

function StatusWithValue({ badge, value }) {
  return (
    <View style={styles.statusWithValue}>
      <StatusBadge variant={badge.variant} label={badge.label} small />
      <Text style={styles.statusWithValueText}>{value}</Text>
    </View>
  );
}

function FieldRow({ icon, label, value }) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLeft}>
        <View style={styles.iconCircleSoft}>
          <Ionicons name={icon} size={16} color={COLORS.label} />
        </View>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function AvatarGradient({ size = 76 }) {
  const r = size / 2;
  return (
    <View
      style={[
        styles.avatarWrapper,
        { width: size, height: size, borderRadius: r, overflow: "hidden" },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={r} cy={r} r={r} fill="#FFFFFF" />
      </Svg>
      <View style={styles.avatarInner}>
        <Ionicons name="person" size={30} color={COLORS.primaryTeal} />
      </View>
    </View>
  );
}

function ProgressBar({ ratio }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trackWidth) return;
    const toValue = trackWidth * Math.min(1, Math.max(0, ratio));
    Animated.timing(animatedWidth, {
      toValue,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [ratio, trackWidth, animatedWidth]);

  return (
    <View
      style={styles.progressTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.progressFill, { width: animatedWidth }]}
      />
    </View>
  );
}

function MonthlyBreakdownItem({
  monthLabel,
  totalBill,
  remaining,
  badge,
  language,
}) {
  return (
    <View style={styles.monthItem}>
      <View style={styles.monthTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Text style={styles.monthSub}>
            ₹{totalBill.toLocaleString("en-IN")}
            {remaining > 0
              ? language === "mr"
                ? ` • बाकी: ₹${remaining.toLocaleString("en-IN")}`
                : ` • remaining: ₹${remaining.toLocaleString("en-IN")}`
              : ` • Paid`}
          </Text>
        </View>
        <StatusBadge variant={badge.variant} label={badge.label} />
      </View>
    </View>
  );
}

function EmptyState({ language }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={20} color={COLORS.label} />
      <Text style={styles.emptyStateText}>
        {language === "mr" ? "देय महिने उपलब्ध नाहीत." : "No due months available."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
    marginTop: -35,
    
  },

  profileScreen: {

    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },

  profileScrollContent: {
    paddingBottom: 28,
  },

  profileScrollContentStandalone: {
    paddingBottom: 120,
  },

  heroCard: {
    
    backgroundColor: COLORS.primaryTeal,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 120,
    overflow: "hidden",
  },

  heroPatternOne: {
    position: "absolute",
    top: 10,
    left: 18,
  },

  heroPatternTwo: {
    position: "absolute",
    top: 18,
    left: "42%",
  },

  heroPatternThree: {
    position: "absolute",
    top: 14,
    right: 22,
  },

  heroPatternFour: {
    position: "absolute",
    top: 96,
    right: 70,
  },

  heroTopActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  heroTopSpacer: {
    width: 44,
    height: 44,
  },

  heroActionGroup: {
    flexDirection: "row",
    gap: 12,
  },

  heroActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },

  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  heroAvatarShell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },

  heroContent: {
    flex: 1,
    marginLeft: 16,
    marginTop:20,
  },

  heroWelcomeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },

  heroMemberName: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroStatusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#E7F8EE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.greenAccent,
    marginRight: 8,
  },

  heroStatusText: {
    color: "#198754",
    fontSize: 13,
    fontWeight: "800",
  },

  heroMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  heroMetaText: {
    marginLeft: 8,
    color: "#E8FFFD",
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },

  profileCardsWrap: {
    paddingHorizontal: 14,
    paddingTop: 12, 
    marginTop:-100,
  },

  premiumProfileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  accountSettingsCard: {
    paddingBottom:40,
  },

  premiumInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F6",
  },

  premiumInfoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  premiumInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  premiumInfoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F1FBFA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  premiumInfoLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7A8594",
  },

  premiumInfoValue: {
    maxWidth: "58%",
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textNavy,
    textAlign: "right",
  },

  premiumInfoCustomValue: {
    alignItems: "flex-end",
    maxWidth: "58%",
  },
  premiumInfoCustomValueMealPlan: {
    maxWidth: "72%",
  },

  settingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  settingMiniCard: {
    width: "48.3%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  settingMiniTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  settingMiniIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1FBFA",
    alignItems: "center",
    justifyContent: "center",
  },

  settingMiniTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.textNavy,
  },

  logoutActionCard: {
    backgroundColor: "#FFF1F0",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },

  logoutActionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoutActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoutActionText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#D65A4C",
  },

  profileSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },

  summaryInlineRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryInlineLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7A8594",
  },

  summaryInlineValue: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textNavy,
  },

  statusWithValue: {
    alignItems: "flex-end",
    gap: 6,
  },

  statusWithValueText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textNavy,
  },

  bottomBarWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
  },

  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },

  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomTabLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#9AA5B1",
  },

  bottomTabLabelActive: {
    color: COLORS.primaryTeal,
    fontWeight: "800",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primaryText,
  },

  headerRightSpacer: {
    width: 40,
    height: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  avatarStack: {
    position: "relative",
  },

  profileHeaderTextWrapper: {
    flex: 1,
    marginLeft: 16,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  memberName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primaryText,
    marginRight: 10,
  },

  memberMeta: {
    fontSize: 13,
    color: COLORS.label,
    marginTop: 6,
  },

  avatarWrapper: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },

  avatarInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },

  avatarEditHint: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  sectionSpacer: {
    height: 16,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.softAccentBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.primaryText,
  },

  sectionBody: {
    paddingTop: 2,
  },

  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  fieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  iconCircleSoft: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.softAccentBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.label,
  },

  fieldValue: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primaryText,
    maxWidth: 160,
  },

  pillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 8,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 14,
  },

  pillBadge: {
    backgroundColor: "#F4F6FB",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: "100%",
  },

  pillBadgeText: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "900",
  },

  badgeBase: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  badgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  badgeActive: {
    backgroundColor: "#E8F8EE",
  },

  badgeDue: {
    backgroundColor: "#FFF0F0",
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  badgeTextSmall: {
    fontSize: 11,
    fontWeight: "900",
  },

  badgeTextActive: {
    color: "#198754",
  },

  badgeTextDue: {
    color: "#D65A4C",
  },

  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },

  dueRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  dueRowRight: {
    alignItems: "flex-end",
  },

  dueValue: {
    fontSize: 16,
    fontWeight: "950",
    color: COLORS.primaryText,
    marginTop: 4,
  },

  progressBlock: {
    marginTop: 16,
    marginBottom: 4,
  },

  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  progressLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A8594",
  },

  progressPercent: {
    fontSize: 13,
    fontWeight: "950",
    color: COLORS.primaryTeal,
  },

  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#E7EEF3",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primaryTeal,
  },

  totalValue: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primaryText,
    maxWidth: 140,
  },

  monthItem: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    opacity: 1,
  },

  monthTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  monthLabel: {
    fontSize: 14,
    fontWeight: "950",
    color: COLORS.primaryText,
  },

  monthSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.label,
  },

  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  errorText: {
    color: COLORS.dueRed,
    fontSize: 13,
    fontWeight: "800",
  },

  emptyState: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyStateText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.label,
    textAlign: "center",
  },

  billScreen: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  billScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  billHeroHeader: {
    backgroundColor: COLORS.primaryTeal,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 92,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  billPatternWrap: {
    position: "absolute",
    right: 12,
    top: 8,
    flexDirection: "row",
    gap: 10,
  },
  billHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billRoundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyPillButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyPillText: {
    color: "#0F4E49",
    fontWeight: "700",
    fontSize: 12,
  },
  billHeroTitle: {
    marginTop: 18,
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  billHeroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#E6FFFC",
    fontWeight: "500",
  },
  floatingSummaryCard: {
    backgroundColor: "#FFFFFF",
    marginTop: -72,
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  summaryCol: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  summaryColWide: {
    flex: 1.4,
    paddingLeft: 0,
  },
  summaryColDivider: {
    width: 1,
    backgroundColor: "#EDF0F3",
  },
  summaryMonth: {
    color: COLORS.textNavy,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 2,
  },
  summaryLabel: {
    color: "#7C8793",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryPrimaryAmount: {
    color: COLORS.primaryTeal,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryTealAmount: {
    color: COLORS.primaryTeal,
    fontSize: 29,
    fontWeight: "800",
    marginTop: 8,
  },
  summaryRedAmount: {
    color: COLORS.redAccent,
    fontSize: 29,
    fontWeight: "800",
    marginTop: 8,
  },
  partialBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FFE9EC",
  },
  partialBadgeText: {
    color: COLORS.redAccent,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryProgressTrack: {
    marginTop: 14,
    height: 8,
    backgroundColor: "#E8EDF1",
    borderRadius: 999,
    overflow: "hidden",
  },
  summaryProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primaryTeal,
  },
  summaryProgressMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryProgressPaid: {
    fontSize: 12,
    color: COLORS.primaryTeal,
    fontWeight: "700",
  },
  summaryProgressDue: {
    fontSize: 12,
    color: "#7C8793",
    fontWeight: "700",
  },
  premiumCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionBlockLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionBlockIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionBlockTitle: {
    fontSize: 22,
    color: COLORS.textNavy,
    fontWeight: "800",
  },
  sectionBlockSubtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 3,
    fontWeight: "500",
  },
  sectionActionText: {
    color: COLORS.primaryTeal,
    fontWeight: "700",
    fontSize: 13,
  },
  chargesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  chargeMiniCard: {
    width: "48.6%",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFF2F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  chargeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  chargeTitle: {
    color: "#566273",
    fontSize: 12,
    fontWeight: "600",
  },
  chargeAmount: {
    color: COLORS.textNavy,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 3,
  },
  chargeAmountNegative: {
    color: COLORS.redAccent,
  },
  chargePercent: {
    marginTop: 2,
    fontSize: 13,
    color: "#5F7285",
    fontWeight: "700",
  },
  finalTotalStrip: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryTeal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  finalTotalLabel: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "800",
  },
  finalTotalValue: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#EBEFF3",
    marginVertical: 12,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentDate: {
    fontSize: 15,
    color: COLORS.textNavy,
    fontWeight: "800",
  },
  paymentMethod: {
    marginTop: 5,
    color: "#687687",
    fontSize: 12,
    fontWeight: "500",
  },
  paymentRightBlock: {
    alignItems: "flex-end",
  },
  paymentAmount: {
    color: COLORS.primaryTeal,
    fontSize: 24,
    fontWeight: "800",
  },
  paidBadgeRow: {
    marginTop: 6,
    backgroundColor: "#E6F8EF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  paidBadgeText: {
    color: COLORS.greenAccent,
    fontSize: 12,
    fontWeight: "700",
  },
  paidDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.greenAccent,
    marginLeft: 6,
  },
  previousRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previousMonth: {
    color: COLORS.textNavy,
    fontSize: 15,
    fontWeight: "700",
  },
  previousRightBlock: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  previousAmount: {
    color: COLORS.textNavy,
    fontSize: 16,
    fontWeight: "700",
  },
  downloadButton: {
    backgroundColor: COLORS.primaryTeal,
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  downloadButtonText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
