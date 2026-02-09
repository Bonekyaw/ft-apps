import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { Brand, Colors, FontSize, Spacing } from "@/constants/theme";
import { signOut, useSession } from "@/lib/auth-client";

const colors = Colors.light;

export default function ProfileScreen() {
  const { data: session } = useSession();
  const user = session?.user;

  const handleLogout = async () => {
    await signOut();
    //router.replace("/(auth)/sign-in");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.avatarWrap, styles.avatarPlaceholderBg]}>
          <Text style={styles.avatarPlaceholder}>
            {user?.name?.charAt(0)?.toUpperCase() ??
              user?.email?.charAt(0)?.toUpperCase() ??
              "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "User"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
      </View>

      <View style={styles.footer}>
        <Button
          title="Log out"
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
