import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../LanguageContext";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);
const STATUSBAR_HEIGHT =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

const NAV_ITEMS = [
  {
    id: "students",
    icon: "people-outline",
    iconActive: "people",
    label: "Manage Members",
    labelMr: "सदस्य व्यवस्थापन",
  },
  {
    id: "snacks",
    icon: "fast-food-outline",
    iconActive: "fast-food",
    label: "Extra Snacks",
    labelMr: "अतिरिक्त स्नॅक्स",
  },
  {
    id: "expenses",
    icon: "wallet-outline",
    iconActive: "wallet",
    label: "Mess Expenses",
    labelMr: "मेस खर्च",
  },
  {
    id: "payments",
    icon: "card-outline",
    iconActive: "card",
    label: "Payments",
    labelMr: "पेमेंट",
  },
  {
    id: "reports",
    icon: "document-text-outline",
    iconActive: "document-text",
    label: "Reports",
    labelMr: "रिपोर्ट",
  },
  {
    id: "backups",
    icon: "cloud-outline",
    iconActive: "cloud",
    label: "Backup & Restore",
    labelMr: "बॅकअप",
  },
];



function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitials(adminName, adminEmail) {
  if (adminName) {
    const parts = adminName.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return adminName.substring(0, 2).toUpperCase();
  }
  if (adminEmail) return adminEmail.substring(0, 2).toUpperCase();
  return "AD";
}

const DashboardSidebar = ({
  isOpen,
  onClose,
  onNavigate,
  onLogout,
  adminName,
  adminEmail,
  adminCreatedAt,
  activeScreen,
  totalMembers,
  pendingLeaves,
}) => {
  const { language } = useLanguage();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, overlayAnim]);

  const initials = getInitials(adminName, adminEmail);
  const joinedDate = formatDate(adminCreatedAt);
  const accountAgeDays = adminCreatedAt
    ? Math.floor((Date.now() - new Date(adminCreatedAt).getTime()) / 86400000)
    : null;

  if (!isOpen && slideAnim._value === -SIDEBAR_WIDTH) return null;

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={isOpen ? "auto" : "none"}
    >
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar panel */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          bounces={false}
        >
          {/* ── Profile Header ─────────────────────────────── */}
          <View style={[styles.profileHeader, { paddingTop: STATUSBAR_HEIGHT + 16 }]}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>

            <Text style={styles.profileName} numberOfLines={1}>
              {adminName || "Administrator"}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {adminEmail || "—"}
            </Text>

            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.roleBadgeText}>Super Admin</Text>
            </View>
          </View>

          {/* ── Quick Stats ───────────────────────────────── */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {totalMembers !== null && totalMembers !== undefined ? totalMembers : "—"}
              </Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statValue, pendingLeaves > 0 && { color: "#EF4444" }]}>
                {pendingLeaves !== null && pendingLeaves !== undefined ? pendingLeaves : "—"}
              </Text>
              <Text style={styles.statLabel}>Pending Leaves</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {accountAgeDays !== null ? accountAgeDays : "—"}
              </Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
          </View>

          {/* ── Profile Details ───────────────────────────── */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>ACCOUNT</Text>
          </View>

          <View style={styles.detailsCard}>
            <DetailRow icon="mail-outline" label="Email" value={adminEmail || "—"} />
            <View style={styles.itemDivider} />
            <DetailRow icon="shield-checkmark-outline" label="Role" value="Administrator" />
            <View style={styles.itemDivider} />
            <DetailRow icon="calendar-outline" label="Member Since" value={joinedDate} />
            <View style={styles.itemDivider} />
            <DetailRow
              icon="checkmark-circle-outline"
              label="Status"
              value="Active"
              valueColor="#22C55E"
            />
          </View>

          {/* ── Navigation ───────────────────────────────── */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>NAVIGATION</Text>
          </View>

          <View style={styles.navCard}>
            {NAV_ITEMS.map((item, index) => {
              const isActive = activeScreen === item.id;
              const label = language === "mr" ? item.labelMr : item.label;
              return (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.navIconBox, isActive && styles.navIconBoxActive]}>
                      <Ionicons
                        name={isActive ? item.iconActive : item.icon}
                        size={16}
                        color={isActive ? "#6366F1" : "#64748B"}
                      />
                    </View>
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                      {label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={isActive ? "#6366F1" : "#CBD5E1"}
                    />
                  </TouchableOpacity>
                  {index < NAV_ITEMS.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Logout ─────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={17} color="#EF4444" />
            <Text style={styles.logoutLabel}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const DetailRow = ({ icon, label, value, valueColor }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={15} color="#94A3B8" />
    <View style={styles.detailTextBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

export default DashboardSidebar;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F172A",
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 16,
  },

  // ── Profile header ─────────────────────────────────────────
  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3,
  },
  profileEmail: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },

  // ── Stats row ──────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    textAlign: "center",
  },

  // ── Section label ──────────────────────────────────────────
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },

  // ── Details card ───────────────────────────────────────────
  detailsCard: {
    marginHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 12,
  },
  detailTextBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 14,
  },

  // ── Nav card ───────────────────────────────────────────────
  navCard: {
    marginHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: "transparent",
  },
  navItemActive: {
    backgroundColor: "rgba(99,102,241,0.06)",
  },
  navIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  navIconBoxActive: {
    backgroundColor: "rgba(99,102,241,0.08)",
    borderColor: "rgba(99,102,241,0.2)",
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#475569",
  },
  navLabelActive: {
    color: "#6366F1",
    fontWeight: "600",
  },

  // ── Logout ─────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7D7",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 10,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    flex: 1,
  },
});
