import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { Brand, Colors, FontSize, Spacing } from "@/constants/theme";
import { useTranslation } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n";
import { signOut, useSession } from "@/lib/auth-client";

const colors = Colors.light;

export default function ProfileScreen() {
  const { t, locale, setLocale } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user;

  const handleLogout = async () => {
    await signOut();
  };

  const selectLanguage = (code: LocaleCode) => {
    setLocale(code);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("profile.title")}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.avatarWrap, styles.avatarPlaceholderBg]}>
          <Text style={styles.avatarPlaceholder}>
            {user?.name?.charAt(0)?.toUpperCase() ??
              user?.email?.charAt(0)?.toUpperCase() ??
              "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? t("profile.user")}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
      </View>

      <View style={styles.languageSection}>
        <Text style={styles.languageLabel}>{t("profile.language")}</Text>
        <View style={styles.languageRow}>
          <TouchableOpacity
            style={[
              styles.languageOption,
              locale === "en" && styles.languageOptionActive,
            ]}
            onPress={() => selectLanguage("en")}
          >
            <Text
              style={[
                styles.languageOptionText,
                locale === "en" && styles.languageOptionTextActive,
              ]}
            >
              {t("profile.english")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.languageOption,
              locale === "my" && styles.languageOptionActive,
            ]}
            onPress={() => selectLanguage("my")}
          >
            <Text
              style={[
                styles.languageOptionText,
                locale === "my" && styles.languageOptionTextActive,
              ]}
            >
              {t("profile.myanmar")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={t("profile.logOut")}
          onPress={handleLogout}
          variant="outline"
          size="lg"
          style={styles.logoutButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatarPlaceholderBg: {
    backgroundColor: `${Brand.primary}30`,
  },
  avatarPlaceholder: {
    fontSize: 28,
    fontWeight: "600",
    color: Brand.secondary,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  languageSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  languageLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  languageRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  languageOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  languageOptionActive: {
    borderColor: Brand.primary,
    backgroundColor: `${Brand.primary}15`,
  },
  languageOptionText: {
    fontSize: FontSize.md,
    color: colors.text,
  },
  languageOptionTextActive: {
    color: Brand.primary,
    fontWeight: "600",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  logoutButton: {
    width: "100%",
  },
});
