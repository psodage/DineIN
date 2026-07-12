import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGES = [
  require("../assets/images/img1.jpg"),
  require("../assets/images/img2.jpg"),
];

const CROSSFADE_MS = 4500;

function AnimatedImageBackground({ isDark }) {
  const topOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(topOpacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(topOpacity, {
          toValue: 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [topOpacity]);

  const overlayColors = isDark
    ? ["rgba(15,23,42,0.82)", "rgba(15,23,42,0.48)", "rgba(15,23,42,0.92)"]
    : ["rgba(67,20,7,0.55)", "rgba(30,27,23,0.42)", "rgba(15,23,42,0.62)"];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={BG_IMAGES[0]}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <Animated.Image
        source={BG_IMAGES[1]}
        style={[styles.bgImage, { opacity: topOpacity }]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={overlayColors}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function ScaleButton({
  label,
  onPress,
  primary = false,
  textOnly = false,
  iconName,
  colors,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 5,
    }).start();
  };

  const buttonStyle = [
    styles.buttonBase,
    primary ? [styles.primaryButton, { backgroundColor: colors.primary }] : null,
    !primary && !textOnly
      ? [styles.secondaryButton, { backgroundColor: colors.surface }]
      : null,
    textOnly ? styles.textOnlyButton : null,
  ];

  const textStyle = [
    styles.buttonText,
    primary ? styles.primaryText : null,
    !primary && !textOnly ? [styles.secondaryText, { color: colors.text }] : null,
    textOnly ? [styles.guestText, { color: colors.guest ?? colors.muted }] : null,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        onPress={onPress}
        style={buttonStyle}
      >
        {iconName && !textOnly ? (
          <Ionicons
            name={iconName}
            size={18}
            color={primary ? "#FFF" : colors.text}
            style={styles.buttonIcon}
          />
        ) : null}
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const colors = useMemo(
    () =>
      isDark
        ? {
            title: "#FFFFFF",
            tagline: "#FDE68A",
            description: "rgba(255, 250, 245, 0.92)",
            footer: "rgba(255, 255, 255, 0.58)",
            guest: "rgba(255, 255, 255, 0.85)",
            primary: "#F97316",
            surface: "rgba(255, 255, 255, 0.14)",
            text: "#FFFFFF",
            muted: "rgba(255, 255, 255, 0.78)",
            brandSub: "rgba(255, 237, 213, 0.95)",
            brandMeta: "rgba(255, 255, 255, 0.72)",
          }
        : {
            title: "#FFFFFF",
            tagline: "#FFEDD5",
            description: "rgba(255, 255, 255, 0.92)",
            footer: "rgba(255, 255, 255, 0.62)",
            guest: "rgba(255, 255, 255, 0.88)",
            primary: "#F97316",
            surface: "rgba(255, 255, 255, 0.22)",
            text: "#FFFFFF",
            muted: "rgba(255, 255, 255, 0.78)",
            brandSub: "rgba(255, 247, 237, 0.95)",
            brandMeta: "rgba(255, 255, 255, 0.75)",
          },
    [isDark]
  );

  return (
    <View style={styles.root}>
      <AnimatedImageBackground isDark={isDark} />
      <View
        style={[
          styles.container,
          { paddingTop: Math.max(insets.top, 12) + 8 },
        ]}
      >
        <View style={styles.topBrand}>
          <Image
            source={require("../assets/images/logo2.png")}
            style={styles.logoCorner}
            resizeMode="contain"
          />
          <View style={styles.brandDivider} />
          <View style={styles.topBrandText}>
            <Text style={[styles.brandTitle, { color: colors.title }]}>
              DineIN
            </Text>
        
            <Text style={[styles.brandMeta, { color: colors.brandMeta }]}>
            Eat Smart. Live Easy.
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.tagline, { color: colors.tagline }]}>
            Smart way to manage your daily meals
          </Text>
          <Text style={[styles.description, { color: colors.description }]}>
            Track meals, manage subscriptions, and simplify mess life effortlessly.
          </Text>
        </View>

        <View style={styles.ctaArea}>
          <ScaleButton
            label="Sign In"
            onPress={() => router.push("/Member/MemberLoginEmailScreen")}
            primary
            iconName="log-in-outline"
            colors={colors}
          />
          <ScaleButton
            label="Continue as Guest"
            onPress={() =>
              Alert.alert(
                "Unavailable",
                "Guest Option is Currently Unavailable"
              )
            }
            textOnly
            colors={colors}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.footer }]}>
            By continuing, you agree to Terms and Privacy.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    zIndex: 1,
  },
  topBrand: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 8,
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
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  brandMeta: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 0,
    lineHeight: 26,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  description: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
    paddingHorizontal: 8,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  ctaArea: {
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  buttonBase: {
    minHeight: 56,
  
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  primaryButton: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  textOnlyButton: {
    minHeight: 44,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: "#111827",
  },
  guestText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    marginTop: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});