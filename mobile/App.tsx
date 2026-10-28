import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { ClientHomeScreen } from "./src/screens/ClientHomeScreen";
import { SalonDetailScreen } from "./src/screens/SalonDetailScreen";
import { BookingWizardScreen } from "./src/screens/BookingWizardScreen";
import { MyBookingsScreen } from "./src/screens/MyBookingsScreen";
import { OwnerLoginScreen } from "./src/screens/OwnerLoginScreen";
import { OwnerTodayScreen } from "./src/screens/OwnerTodayScreen";
import { parseDeepLink } from "./src/linking/deep-links";
import { registerForPushNotificationsAsync } from "./src/notifications/push";
import { Storage } from "./src/api/storage";
import { CONFIG } from "./src/config/env";
import { api } from "./src/api/client";

type Screen =
  | { name: "client_home" }
  | { name: "salon_detail"; slug: string }
  | { name: "booking_wizard"; slug: string; serviceId?: string; staffId?: string }
  | { name: "my_bookings"; phone: string }
  | { name: "owner_login" }
  | { name: "owner_today" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "client_home" });

  useEffect(() => {
    // 1. Check existing owner session
    Storage.getItem(CONFIG.tokenStorageKeys.accessToken).then((token) => {
      if (token) {
        api.getMe().then((res) => {
          if (res.success) {
            setScreen({ name: "owner_today" });
          }
        });
      }
    });

    // 2. Register for push notifications
    registerForPushNotificationsAsync();

    // 3. Setup Deep link listener
    let linkingModule: typeof import("expo-linking") | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      linkingModule = require("expo-linking");
    } catch {
      linkingModule = null;
    }

    if (linkingModule) {
      linkingModule.getInitialURL().then((url) => {
        handleUrl(url);
      });

      const subscription = linkingModule.addEventListener("url", (event) => {
        handleUrl(event.url);
      });

      return () => {
        subscription.remove();
      };
    }
  }, []);

  const handleUrl = (url: string | null) => {
    const parsed = parseDeepLink(url);
    if (!parsed) return;

    if (parsed.type === "salon") {
      setScreen({ name: "salon_detail", slug: parsed.slug });
    } else if (parsed.type === "owner_today") {
      setScreen({ name: "owner_today" });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {screen.name === "client_home" && (
          <ClientHomeScreen
            onSelectSalon={(slug) => setScreen({ name: "salon_detail", slug })}
            onViewMyBookings={(phone) => setScreen({ name: "my_bookings", phone })}
            onSwitchToOwner={() => setScreen({ name: "owner_login" })}
          />
        )}

        {screen.name === "salon_detail" && (
          <SalonDetailScreen
            slug={screen.slug}
            onBack={() => setScreen({ name: "client_home" })}
            onStartBooking={(serviceId, staffId) =>
              setScreen({
                name: "booking_wizard",
                slug: screen.slug,
                serviceId,
                staffId,
              })
            }
          />
        )}

        {screen.name === "booking_wizard" && (
          <BookingWizardScreen
            slug={screen.slug}
            initialServiceId={screen.serviceId}
            initialStaffId={screen.staffId}
            onCancel={() => setScreen({ name: "salon_detail", slug: screen.slug })}
            onSuccess={(_id, _token) => {
              Storage.getItem(CONFIG.tokenStorageKeys.clientPhone).then((ph) => {
                if (ph) {
                  setScreen({ name: "my_bookings", phone: ph });
                } else {
                  setScreen({ name: "client_home" });
                }
              });
            }}
          />
        )}

        {screen.name === "my_bookings" && (
          <MyBookingsScreen
            phone={screen.phone}
            onBack={() => setScreen({ name: "client_home" })}
            onReschedule={(_token) => {
              // Could open reschedule modal or navigate
            }}
          />
        )}

        {screen.name === "owner_login" && (
          <OwnerLoginScreen
            onLoginSuccess={() => setScreen({ name: "owner_today" })}
            onBackToClient={() => setScreen({ name: "client_home" })}
          />
        )}

        {screen.name === "owner_today" && (
          <OwnerTodayScreen
            onLogout={async () => {
              await api.logout();
              setScreen({ name: "client_home" });
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  content: {
    flex: 1,
  },
});
