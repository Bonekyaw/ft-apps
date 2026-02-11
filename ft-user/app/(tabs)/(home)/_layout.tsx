import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="destination-search"
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="pin-on-map"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="set-pickup"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="book-taxi"
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
  );
}
