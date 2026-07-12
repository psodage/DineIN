import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../LanguageContext";

const STATUSBAR_HEIGHT =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

const DashboardHeader = ({ onMenuPress, adminName, adminEmail, notificationCount = 0 }) => {
  const getInitials = () => {
    if (adminName) {
      const parts = adminName.trim().split(" ");
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return adminName.substring(0, 2).toUpperCase();
    }
    if (adminEmail) return adminEmail.substring(0, 2).toUpperCase();
    return "AD";
  };

  return (
    <View style={[styles.wrapper, { paddingTop: STATUSBAR_HEIGHT }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />
      <View style={styles.container}>
        {/* Left — Logo + Brand */}
        <View style={styles.brandBlock}>
          <View style={styles.logoMark}>
            <Ionicons name="restaurant" size={14} color="#6366F1" />
          </View>
          <Text style={styles.brandName}>DineIN</Text>
          <View style={styles.brandSeparator} />
          <Text style={styles.brandSub}>Admin</Text>
        </View>

        {/* Right — Language · Notifications · Avatar */}
        <View style={styles.rightBlock}>
          <LanguageToggleInline />

          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#64748B" />
            {notificationCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={onMenuPress}
            activeOpacity={0.8}
            accessibilityLabel="Open profile menu"
          >
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const LanguageToggleInline = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <TouchableOpacity
      style={styles.langToggle}
      onPress={toggleLanguage}
      activeOpacity={0.8}
      accessibilityLabel={`Switch language. Current: ${language}`}
    >
      <Text style={[styles.langOption, language === "en" && styles.langOptionActive]}>
        EN
      </Text>
      <Text style={styles.langDivider}>·</Text>
      <Text style={[styles.langOption, language === "mr" && styles.langOptionActive]}>
        मर
      </Text>
    </TouchableOpacity>
  );
};

export default DashboardHeader;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    zIndex: 100,
  },
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },

  // ── Brand ─────────────────────────────────────────────────────────────
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  brandSeparator: {
    width: 1,
    height: 14,
    backgroundColor: "#E2E8F0",
  },
  brandSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
  },

  // ── Right controls ─────────────────────────────────────────────────────
  rightBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  langOption: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  langOptionActive: {
    color: "#6366F1",
  },
  langDivider: {
    fontSize: 11,
    color: "#CBD5E1",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notifBadgeText: {
    display: "none",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
