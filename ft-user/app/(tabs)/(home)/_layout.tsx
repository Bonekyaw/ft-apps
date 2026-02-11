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
        options={{
          animation: "slide_from_right",
          // Disable swipe-back: full-screen MapView gesture handlers conflict
          // with the stack navigator's swipe gesture and corrupt the touch system.
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="set-pickup"
        options={{
          animation: "slide_from_right",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="book-taxi"
        options={{
          animation: "slide_from_right",
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
