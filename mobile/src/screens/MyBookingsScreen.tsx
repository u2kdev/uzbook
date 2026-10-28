import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../api/client";

interface MyBookingsScreenProps {
  phone: string;
  onBack: () => void;
  onReschedule: (manageToken: string) => void;
}

export function MyBookingsScreen({ phone, onBack, onReschedule }: MyBookingsScreenProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getBookingsByPhone>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getBookingsByPhone(phone).then((res) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [phone]);

  const handleCancel = (token: string) => {
    Alert.alert(
      "Отмена записи",
      "Вы уверены, что хотите отменить эту запись?",
      [
        { text: "Нет", style: "cancel" },
        {
          text: "Да, отменить",
          style: "destructive",
          onPress: async () => {
            const res = await api.cancelBooking(token, "Клиент отменил через приложение");
            if (res.success) {
              Alert.alert("Успешно", "Запись отменена");
              load();
            } else {
              Alert.alert("Ошибка", res.error.message);
            }
          },
        },
      ],
    );
  };

  const statusLabel = (st: string) => {
    switch (st) {
      case "CONFIRMED":
        return { text: "Подтверждена", color: "#22c55e" };
      case "PENDING":
        return { text: "Ожидает", color: "#eab308" };
      case "COMPLETED":
        return { text: "Завершена", color: "#3b82f6" };
      case "CANCELLED":
        return { text: "Отменена", color: "#ef4444" };
      case "NO_SHOW":
        return { text: "Не явился", color: "#a1a1aa" };
      default:
        return { text: st, color: "#a1a1aa" };
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Мои записи</Text>
        <Text style={styles.subtitle}>Номер телефона: {phone}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#7c5cff" size="large" style={{ marginTop: 40 }} />
      ) : !data || !data.success || data.data.bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Записей не найдено</Text>
          <Text style={styles.emptySub}>
            На данный номер пока нет активных или прошлых записей
          </Text>
        </View>
      ) : (
        data.data.bookings.map((b) => {
          const badge = statusLabel(b.status);
          const dateStr = new Date(b.startAt).toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.salonName}>{b.salon.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${badge.color}20` }]}>
                  <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </View>

              <Text style={styles.serviceName}>{b.service.name}</Text>
              <Text style={styles.datetime}>🕒 {dateStr} ({b.service.durationMin} мин)</Text>
              <Text style={styles.master}>👤 Мастер: {b.staff.name}</Text>
              {b.salon.address ? (
                <Text style={styles.address}>📍 {b.salon.address}</Text>
              ) : null}

              {b.status === "CONFIRMED" || b.status === "PENDING" ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.rescheduleBtn}
                    onPress={() => onReschedule(b.manageToken)}
                  >
                    <Text style={styles.rescheduleText}>Перенести</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(b.manageToken)}
                  >
                    <Text style={styles.cancelText}>Отменить</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#09090b",
    minHeight: "100%",
  },
  backButton: {
    marginTop: 40,
    marginBottom: 16,
  },
  backButtonText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySub: {
    color: "#71717a",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  bookingCard: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  salonName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  serviceName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  datetime: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 4,
  },
  master: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 4,
  },
  address: {
    color: "#71717a",
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    paddingTop: 12,
  },
  rescheduleBtn: {
    flex: 1,
    backgroundColor: "#27272a",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  rescheduleText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
});
