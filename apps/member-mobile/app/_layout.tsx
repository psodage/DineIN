import React from "react";
import { Stack } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../LanguageContext";
import { AuthProvider } from "../lib/AuthContext";
import AppSecurityWrapper from "../components/AppSecurityWrapper";

const DEFAULT_FONT = "Gilroy-Regular";

const textDefaultProps = Text.defaultProps || {};
Text.defaultProps = {
  ...textDefaultProps,
  style: [{ fontFamily: DEFAULT_FONT }, textDefaultProps.style],
};

const textInputDefaultProps = TextInput.defaultProps || {};
TextInput.defaultProps = {
  ...textInputDefaultProps,
  style: [{ fontFamily: DEFAULT_FONT }, textInputDefaultProps.style],
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppSecurityWrapper>
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              />
            </View>
          </AppSecurityWrapper>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
