import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useTranslation } from "@/lib/i18n";
import { authClient, emailOtp } from "@/lib/auth-client";
import { validateDriverLogin, getErrorMessage } from "@/lib/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

const OTP_LENGTH = 6;

export default function VerifyOTPScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste of full OTP
    if (value.length > 1) {
      const pastedOtp = value.slice(0, OTP_LENGTH).split("");
      pastedOtp.forEach((digit, i) => {
        if (i < OTP_LENGTH) {
          newOtp[i] = digit;
        }
      });
      setOtp(newOtp);
      // Focus last filled input or last input
      const lastIndex = Math.min(pastedOtp.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== OTP_LENGTH) {
      Alert.alert(
        t("auth.errors.invalidOtp"),
        t("auth.errors.invalidOtpMessage"),
      );
      return;
    }

    if (!email) {
      Alert.alert(t("auth.errors.error"), t("auth.errors.emailNotFound"));
      router.replace("/(auth)/sign-in");
      return;
    }

    setLoading(true);
    try {
      // Use signIn.emailOtp to authenticate (not just verify email)
      const result = await authClient.signIn.emailOtp({
        email,
        otp: otpString,
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.verificationFailed"),
          result.error.message || t("auth.errors.verificationFailedMessage"),
        );
        setOtp(new Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
      // On success, session is established — the root layout's useSession()
      // will detect the session change and navigate to the (tabs) group
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;

    setResendLoading(true);

    try {
      // Re-validate eligibility before resending OTP
      await validateDriverLogin(email);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      Alert.alert(t("auth.errors.failedToResend"), message);
      setResendLoading(false);
      return;
    }

    try {
      const result = await emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.failedToResend"),
          result.error.message || t("auth.errors.failedToResendMessage"),
        );
      } else {
        Alert.alert(
          t("auth.errors.otpSent"),
          t("auth.errors.otpSentMessage"),
        );
        setCountdown(60);
        setCanResend(false);
        setOtp(new Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${Brand.primary}15` },
            ]}
          >
            <Ionicons name="mail-open" size={48} color={Brand.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("auth.verifyOtp.title")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("auth.verifyOtp.subtitle")}
          </Text>
          <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
        </View>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: digit ? Brand.primary : colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        {/* Verify Button */}
        <Button
          title={t("auth.verifyOtp.verify")}
          onPress={handleVerify}
          loading={loading}
          disabled={otp.join("").length !== OTP_LENGTH}
          size="lg"
          style={styles.verifyButton}
        />

        {/* Resend OTP */}
        <View style={styles.resendContainer}>
          <Text style={[styles.resendText, { color: colors.textSecondary }]}>
            {t("auth.verifyOtp.resendPrompt")}{" "}
          </Text>
          {canResend ? (
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={resendLoading}
            >
              <Text style={[styles.resendLink, { color: Brand.primary }]}>
                {resendLoading ? t("auth.verifyOtp.sending") : t("auth.verifyOtp.resend")}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.countdown, { color: colors.textMuted }]}>
              {t("auth.verifyOtp.resendIn", { count: countdown })}
            </Text>
          )}
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            {t("auth.verifyOtp.helpText")}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  header: {
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    textAlign: "center",
    fontSize: FontSize.xl,
    fontWeight: "600",
  },
  verifyButton: {
    marginBottom: Spacing.lg,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  resendText: {
    fontSize: FontSize.md,
  },
  resendLink: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  countdown: {
    fontSize: FontSize.md,
  },
  helpContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  helpText: {
    fontSize: FontSize.sm,
  },
});
