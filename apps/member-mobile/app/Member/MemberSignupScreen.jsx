import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../config";
import { useLanguage } from "../../LanguageContext";
import FullScreenLoading from "../../components/FullScreenLoading";

const PRIMARY = "#F97316";
const INPUT_BG = "#F5F5F5";
const MEAL_PLANS = ["Lunch", "Dinner", "Both"];

function clean(v) {
  return String(v ?? "").trim();
}

export default function MemberSignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [roomOwnerName, setRoomOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mealPlan, setMealPlan] = useState("Lunch");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const strings = useMemo(
    () => ({
      title: t("Sign Up") || "Create your account",
      haveAccount: t("Already have account?") || "Already have an account?",
      signIn: t("login_title") || "Sign In",
      fullNameLabel: t("Member Name") || "Full name",
      fullNamePlaceholder: t("Full Name") || "Enter your full name",
      roomOwnerLabel: t("Room owner Name") || "Room owner name",
      roomOwnerPlaceholder:
        t("Room owner name") || "Enter room owner name",
      phoneLabel: t("phone_label") || "Phone number",
      phonePlaceholder: t("phone_placeholder") || "Enter phone number",
      emailLabel: t("email_label") || "Email",
      emailPlaceholder: t("email_placeholder") || "Enter email address",
      passwordLabel: t("password_label") || "Password",
      passwordPlaceholder: t("password_placeholder") || "Create a password",
      confirmLabel: t("Re-enter your password") || "Confirm password",
      confirmPlaceholder:
        t("Re-enter your password") || "Re-enter your password",
      mealPlanLabel: t("Meal Plan") || "Meal plan",
      mealPlanLunch: t("Lunch") || "Lunch",
      mealPlanDinner: t("Dinner") || "Dinner",
      mealPlanBoth: t("Both") || "Both",
      cta: t("Sign Up") || "Create account",
    }),
    [t]
  );

  const handleSignup = async () => {
    const payload = {
      name: clean(name),
      roomOwnerName: clean(roomOwnerName),
      phone: clean(phone),
      email: clean(email).toLowerCase(),
      password: clean(password),
      mealPlan,
    };

    const phoneDigits = payload.phone.replace(/\D/g, "");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);

    if (
      !payload.name ||
      !payload.roomOwnerName ||
      !payload.phone ||
      !payload.email ||
      !payload.password
    ) {
      Alert.alert(
        t("alert_error") || "Error",
        t("member_signup_missing_fields") ||
          "Please fill all required fields."
      );
      return;
    }

    if (!emailOk) {
      Alert.alert(
        t("alert_error") || "Error",
        t("invalid_email") || "Please enter a valid email address."
      );
      return;
    }

    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 15) {
      Alert.alert(
        t("alert_error") || "Error",
        t("invalid_phone") || "Please enter a valid phone number."
      );
      return;
    }

    if (payload.password.length < 4) {
      Alert.alert(
        t("alert_error") || "Error",
        t("password_too_short") || "Password is too short."
      );
      return;
    }

    if (clean(confirmPassword) && payload.password !== clean(confirmPassword)) {
      Alert.alert(
        t("alert_error") || "Error",
        t("passwords_do_not_match") || "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      await axios.post(`${API_BASE_URL}/api/pending-registrations`, payload);

      Alert.alert(
        t("alert_success") || "Success",
        t("Your registration has been submitted for approval. You can sign in once it is approved.") ||
          "Your registration has been submitted for approval. You can sign in once it is approved."
      );
      setTimeout(() => router.replace("/Member/MemberLoginEmailScreen"), 0);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        t("member_signup_failed_generic") ||
        "Sign up failed. Please try again.";
      Alert.alert(t("alert_error") || "Error", msg);
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

             

              <View style={styles.heroBottomSpacer} />
            </View>
          </ImageBackground>

          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <Text style={styles.sheetTitle}>{strings.title}</Text>
            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>{strings.haveAccount} </Text>
              <Text
                style={styles.bottomLink}
                onPress={() => router.replace("/Member/MemberLoginEmailScreen")}
              >
                {strings.signIn}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>{strings.fullNameLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                accessibilityLabel={strings.fullNameLabel}
                placeholder={strings.fullNamePlaceholder}
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>{strings.roomOwnerLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="home-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                accessibilityLabel={strings.roomOwnerLabel}
                placeholder={strings.roomOwnerPlaceholder}
                placeholderTextColor="#9CA3AF"
                value={roomOwnerName}
                onChangeText={setRoomOwnerName}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>{strings.phoneLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                accessibilityLabel={strings.phoneLabel}
                placeholder={strings.phonePlaceholder}
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>{strings.emailLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                accessibilityLabel={strings.emailLabel}
                placeholder={strings.emailPlaceholder}
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>{strings.mealPlanLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="restaurant-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <View
                style={styles.segmentWrap}
                accessibilityRole="radiogroup"
                accessibilityLabel={strings.mealPlanLabel}
              >
                {MEAL_PLANS.map((plan) => {
                  const selected = mealPlan === plan;
                  const label =
                    plan === "Lunch"
                      ? strings.mealPlanLunch
                      : plan === "Dinner"
                        ? strings.mealPlanDinner
                        : strings.mealPlanBoth;

                  return (
                    <TouchableOpacity
                      key={plan}
                      style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                      onPress={() => setMealPlan(plan)}
                      activeOpacity={0.9}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={label}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          selected && styles.segmentTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text style={styles.fieldLabel}>{strings.passwordLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={[styles.pillInput, styles.pillInputFlex]}
                accessibilityLabel={strings.passwordLabel}
                placeholder={strings.passwordPlaceholder}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
                textContentType="newPassword"
                returnKeyType="next"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? t("hide_password") || "Hide password"
                    : t("show_password") || "Show password"
                }
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>{strings.confirmLabel}</Text>
            <View style={styles.pillInputWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#6B7280"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                accessibilityLabel={strings.confirmLabel}
                placeholder={strings.confirmPlaceholder}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoComplete="password"
                textContentType="newPassword"
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSignup}
              activeOpacity={0.9}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={strings.cta}
            >
              <Text style={styles.primaryButtonText}>{strings.cta}</Text>
            </TouchableOpacity>

           
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FullScreenLoading visible={loading} color={PRIMARY} />
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
    paddingBottom: 10,
    height: 140,
  },
  topHeroOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    marginHorizontal: -20,
    marginTop: -42,
    paddingHorizontal: 20,
    paddingBottom: 8,
    height: 140,
   
  },
  topBrand: {
    
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 16,
    gap: 12,
    marginTop: 30,
  },
  logoCorner: {
    width: 52,
    height: 60,
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
    maxWidth: 340,
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBottomSpacer: {
    height: 8,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 2,
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
  segmentWrap: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  segmentBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    height: 52,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  bottomText: {
    fontSize: 14,
    color: "#6B7280",
  },
  bottomLink: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
});

