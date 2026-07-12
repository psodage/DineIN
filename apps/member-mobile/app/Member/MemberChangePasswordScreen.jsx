import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FullScreenLoading from "../../components/FullScreenLoading";
import api from "../../lib/api";

const COLORS = {
  bgPremium: "#F5F7FA",
  card: "#FFFFFF",
  textNavy: "#101828",
  mutedText: "#6B7280",
  border: "#E7ECF1",
  primaryTeal: "#0F8F88",
  inputBg: "#F8FAFC",
};

export default function MemberChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [isMessageModalVisible, setIsMessageModalVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [onMessageClose, setOnMessageClose] = useState(null);

  const openMessageModal = useCallback(
    ({ title, body, type = "success", onClose = null }) => {
      setMessageTitle(title);
      setMessageBody(body);
      setMessageType(type);
      setOnMessageClose(() => onClose);
      setIsMessageModalVisible(true);
    },
    []
  );

  const closeMessageModal = useCallback(() => {
    setIsMessageModalVisible(false);
    if (typeof onMessageClose === "function") {
      onMessageClose();
    }
  }, [onMessageClose]);

  const handleSavePassword = async () => {
    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmNewPassword.trim();

    if (!trimmedCurrentPassword) {
      Alert.alert("Validation", "Current password is required.");
      return;
    }
    if (!trimmedNewPassword) {
      Alert.alert("Validation", "New password is required.");
      return;
    }
    if (!trimmedConfirmPassword) {
      Alert.alert("Validation", "Please re-enter new password.");
      return;
    }
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      Alert.alert("Validation", "New password and re-entered password do not match.");
      return;
    }
    if (trimmedCurrentPassword === trimmedNewPassword) {
      Alert.alert("Validation", "New password must be different from current password.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/api/auth/member-change-password", {
        currentPassword: trimmedCurrentPassword,
        newPassword: trimmedNewPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      openMessageModal({
        title: "Success",
        body: "Password updated successfully.",
        type: "success",
        onClose: () => router.back(),
      });
    } catch (err) {
      openMessageModal({
        title: "Update failed",
        body: err?.response?.data?.message || "Failed to update password.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsMessageModalVisible(false);
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primaryTeal}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Secure your account</Text>
          <Text style={styles.heroSubtitle}>
            Use your existing password and set a strong new password.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Label text="Existing Password" />
          <PasswordInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter existing password"
            secureTextEntry={!showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((prev) => !prev)}
            visible={showCurrentPassword}
          />

          <Label text="New Password" />
          <PasswordInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            secureTextEntry={!showNewPassword}
            onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
            visible={showNewPassword}
          />

          <Label text="Re-enter New Password" />
          <PasswordInput
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Re-enter new password"
            secureTextEntry={!showConfirmNewPassword}
            onToggleVisibility={() => setShowConfirmNewPassword((prev) => !prev)}
            visible={showConfirmNewPassword}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          activeOpacity={0.9}
          onPress={handleSavePassword}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>Update Password</Text>
        </TouchableOpacity>
      </View>

      <FullScreenLoading visible={saving} color="#111827" />
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
                  messageType === "success"
                    ? styles.modalBtnSuccess
                    : styles.modalBtnError,
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
    </SafeAreaView>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onToggleVisibility,
  visible,
}) {
  return (
    <View style={styles.passwordInputWrap}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={styles.eyeButton}
        onPress={onToggleVisibility}
        activeOpacity={0.8}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color="#64748B"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textNavy,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: COLORS.primaryTeal,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#DFF8F6",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.mutedText,
    marginBottom: 8,
    marginTop: 10,
  },
  passwordInputWrap: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    color: COLORS.textNavy,
    fontSize: 15,
    fontWeight: "600",
  },
  eyeButton: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: COLORS.bgPremium,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
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
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  modalBody: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  modalBtnSuccess: {
    backgroundColor: COLORS.primaryTeal,
  },
  modalBtnError: {
    backgroundColor: COLORS.primaryTeal,
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
