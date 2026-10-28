import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { api } from "../api/client";

interface ClientHomeScreenProps {
  onSelectSalon: (slug: string) => void;
  onViewMyBookings: (phone: string) => void;
  onSwitchToOwner: () => void;
}

export function ClientHomeScreen({
  onSelectSalon,
  onViewMyBookings,
  onSwitchToOwner,
}: ClientHomeScreenProps) {
  const [salonSlug, setSalonSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenSalon = async () => {
    const slug = salonSlug.trim().toLowerCase();
    if (!slug) {
      setError("Введите название или slug салона");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await api.getSalon(slug);
    setLoading(false);

    if (!res.success) {
      setError("Салон не найден. Проверьте ссылку или slug");
      return;
    }

    onSelectSalon(slug);
  };

  const handleLookupPhone = () => {
    const clean = phone.trim();
    if (clean.length < 7) {
      setError("Введите корректный номер телефона");
      return;
    }
    setError(null);
    onViewMyBookings(clean);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge}>UZBOOK MOBILE</Text>
        <Text style={styles.title}>Запись в салон красоты</Text>
        <Text style={styles.subtitle}>
          Быстрая онлайн-запись к проверенным мастерам без звонков и ожидания
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Найти салон</Text>
        <Text style={styles.cardDesc}>Введите идентификатор салона или адрес ссылки</Text>
        <TextInput
          style={styles.input}
          placeholder="Например: salon-pro или beauty-bar"
          placeholderTextColor="#71717a"
          value={salonSlug}
          onChangeText={(t) => {
            setSalonSlug(t);
            setError(null);
          }}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleOpenSalon}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Открыть салон</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Мои записи</Text>
        <Text style={styles.cardDesc}>Посмотреть историю и статус ваших записей</Text>
        <TextInput
          style={styles.input}
          placeholder="+998 90 123 45 67"
          placeholderTextColor="#71717a"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setError(null);
          }}
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={handleLookupPhone}>
          <Text style={styles.secondaryButtonText}>Найти мои записи</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.switchButton} onPress={onSwitchToOwner}>
        <Text style={styles.switchButtonText}>Вход для владельцев салона →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#09090b",
    minHeight: "100%",
  },
  header: {
    marginTop: 40,
    marginBottom: 24,
  },
  badge: {
    color: "#7c5cff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 6,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  cardDesc: {
    fontSize: 13,
    color: "#a1a1aa",
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    padding: 14,
    color: "#ffffff",
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#7c5cff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#27272a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  switchButtonText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "500",
  },
});
