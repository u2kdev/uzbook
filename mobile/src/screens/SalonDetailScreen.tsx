import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { api } from "../api/client";

interface SalonDetailScreenProps {
  slug: string;
  onBack: () => void;
  onStartBooking: (serviceId?: string, staffId?: string) => void;
}

export function SalonDetailScreen({ slug, onBack, onStartBooking }: SalonDetailScreenProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getSalon>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getSalon(slug).then((res) => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#7c5cff" />
      </View>
    );
  }

  if (!data || !data.success) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Не удалось загрузить данные салона</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { salon, services, staff } = data.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Назад к поиску</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.salonName}>{salon.name}</Text>
        {salon.description ? (
          <Text style={styles.description}>{salon.description}</Text>
        ) : null}
        {salon.address ? (
          <Text style={styles.address}>📍 {salon.address}, {salon.city || "Ташкент"}</Text>
        ) : null}
      </View>

      <TouchableOpacity style={styles.primaryCta} onPress={() => onStartBooking()}>
        <Text style={styles.primaryCtaText}>Записаться на услугу</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Услуги ({services.length})</Text>
        {services.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.itemCard}
            onPress={() => onStartBooking(s.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{s.name}</Text>
              <Text style={styles.itemSub}>{s.durationMin} минут</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.itemPrice}>
                {s.price.toLocaleString("ru-RU")} {salon.currency}
              </Text>
              <Text style={styles.bookPill}>Выбрать</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Мастера ({staff.length})</Text>
        {staff.map((st) => (
          <TouchableOpacity
            key={st.id}
            style={styles.itemCard}
            onPress={() => onStartBooking(undefined, st.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{st.name}</Text>
              <Text style={styles.itemSub}>{st.title || "Мастер салона"}</Text>
            </View>
            <Text style={styles.bookPill}>К мастеру</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#09090b",
    minHeight: "100%",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    marginTop: 40,
    marginBottom: 16,
  },
  backButtonText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  hero: {
    marginBottom: 20,
  },
  salonName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 6,
    lineHeight: 20,
  },
  address: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 8,
  },
  primaryCta: {
    backgroundColor: "#7c5cff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  primaryCtaText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  itemName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  itemSub: {
    color: "#71717a",
    fontSize: 13,
    marginTop: 3,
  },
  itemPrice: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  bookPill: {
    color: "#7c5cff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 15,
    marginBottom: 16,
  },
});
