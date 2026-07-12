import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import axios from "axios";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FullScreenLoading from "../../components/FullScreenLoading";

const PRIMARY = "#F97316";
const INPUT_BG = "#F5F5F5";

function normalizePhone(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { display: "", e164ish: "", digits: "" };

  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  const e164ish = `${hasPlus ? "+" : ""}${digits}`;
  return { display: s, e164ish, digits };
}

function isValidPhone(raw) {
  const { digits } = normalizePhone(raw);
  // Basic sanity check: typical phone numbers are 7–15 digits (E.164 max 15)
  return digits.length >= 7 && digits.length <= 15;
}

export default function MemberLoginPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isMessageModalVisible, setIsMessageModalVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [messageAction, setMessageAction] = useState(null);

  const showMessageModal = (title, body, type = "error", onClose = null) => {
    setMessageTitle(title || "");
    setMessageBody(body || "");
    setMessageType(type);
    setMessageAction(() => onClose);
    setIsMessageModalVisible(true);
  };

  const closeMessageModal = () => {
    setIsMessageModalVisible(false);
    const action = messageAction;
    setMessageAction(null);
    if (typeof action === "function") action();
  };

  const handleLogin = async () => {
    const cleanPhone = String(phone ?? "").trim();
    const cleanPassword = String(password ?? "").trim();

    if (!cleanPhone) {
      showMessageModal(
        t("alert_error"),
        t("member_login_missing_fields") || "Please enter phone and password"
      );
      return;
    }

    if (!isValidPhone(cleanPhone)) {
      showMessageModal(
        t("alert_error"),
        t("member_login_invalid_phone") ||
          "Please enter a valid phone number (7–15 digits)."
      );
      return;
    }

    if (!cleanPassword) {
      showMessageModal(
        t("alert_error"),
        t("member_login_missing_password") || "Please enter password"
      );
      return;
    }

    try {
      setLoading(true);
      const { digits } = normalizePhone(cleanPhone);

      const res = await axios.post(`${API_BASE_URL}/api/auth/member-login-phone`, {
        phone: digits || cleanPhone,
        password: cleanPassword,
      });

      await login(res.data.token, res.data.user, { remember: rememberMe });
      showMessageModal(
        t("alert_success"),
        t("login_success"),
        "success",
        () => router.replace("/Member/MemberDashboard")
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        t("member_login_failed_generic") ||
        t("login_failed_generic");
      showMessageModal(t("alert_error"), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <LinearGradient
        colors={["#FDBA74", PRIMARY, "#C2410C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ImageBackground
            source={require("../../assets/images/img4.jpg")}
            resizeMode="cover"
            style={[
              styles.topHeroBg,
              { paddingTop: Math.max(insets.top, 12) + 8 },
            ]}
          >
            <View style={styles.topHeroOverlay}>
              <View style={styles.topBrand}>
                <Image
                  source={require("../../assets/images/logo2.png")}
                  style={styles.logoCorner}
                  resizeMode="contain"
                />
                <View style={styles.brandDivider} />
                <View style={styles.topBrandText}>
                  <Text style={[styles.brandTitle, { color: "#FFFFFF" }]}>
                    DineIN
                  </Text>
                  <Text style={[styles.brandMeta, { color: "#FFFFFF" }]}>
                    Eat Smart. Live Easy.
                  </Text>
                </View>
              </View>

              <Text style={styles.heroHeadline}>
                Log in to stay on top of your meals and orders.
              </Text>

              <View style={styles.heroBottomSpacer} />
            </View>
          </ImageBackground>

          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <Text style={styles.sheetTitle}>{t("login_title")}</Text>
            <Text style={styles.sheetSubtitle}>
              Don't have an account?{" "}
              <Text
                style={styles.signUpLink}
                onPress={() => router.push("/Member/MemberSignupScreen")}
              >
                Sign Up
              </Text>
            </Text>

            <View style={styles.pillInputWrap}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                placeholder={t("phone_placeholder")}
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.pillInputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={[styles.pillInput, styles.pillInputFlex]}
                placeholder={t("password_placeholder")}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={rememberMe ? "checkbox" : "square-outline"}
                  size={22}
                  color={rememberMe ? PRIMARY : "#9CA3AF"}
                />
                <Text style={styles.rememberLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("", "Reset Password Is currently unavaliable")
                }
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <Text style={styles.forgotLink}>
                  {t("footer_forgot_link")}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>{t("login_title")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.phoneOptionRow}
              activeOpacity={0.85}
              onPress={() => router.push("/Member/MemberLoginEmailScreen")}
            >
              <Ionicons
                name="mail-outline"
                size={22}
                color={PRIMARY}
                style={styles.phoneOptionIcon}
              />
              <Text style={styles.phoneOptionText}>
                Continue With Email
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FullScreenLoading visible={loading} color={PRIMARY} />
      <Modal
        transparent
        animationType="fade"
        visible={isMessageModalVisible}
        onRequestClose={closeMessageModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{messageTitle}</Text>
            <Text style={styles.modalBody}>{messageBody}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  messageType === "success" ? styles.modalBtnSuccess : styles.modalBtnError,
                ]}
                activeOpacity={0.88}
                onPress={closeMessageModal}
              >
                <Text style={styles.modalBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topHeroBg: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 14,
    height: 280,
  },
  topHeroOverlay: {
    marginTop: -42,
    height: 280,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topBrand: {
    marginTop:20,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 16,
    gap: 12,
  },
  logoCorner: {
    width: 62,
    height: 72,
  },
  brandDivider: {
    width: 1,
    height: 45,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    opacity: 0.98,
  },
  topBrandText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  brandMeta: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 30,
    marginBottom: 12,
    maxWidth: 320,
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBottomSpacer: {
    flex: 1,
    minHeight: 72,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  signUpLink: {
    color: PRIMARY,
    fontWeight: "600",
  },
  pillInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
  },
  pillIcon: {
    marginRight: 10,
  },
  pillInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 0,
  },
  pillInputFlex: {
    marginRight: 8,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rememberLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
  },
  primaryButton: {
    height: 52,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  phoneOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 8,
  },
  phoneOptionIcon: {
    marginRight: 10,
  },
  phoneOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  modalBody: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  modalBtnSuccess: {
    backgroundColor: "#16A34A",
  },
  modalBtnError: {
    backgroundColor: PRIMARY,
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
