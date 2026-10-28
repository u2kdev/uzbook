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

interface OwnerTodayScreenProps {
  onLogout: () => void;
}

export function OwnerTodayScreen({ onLogout }: OwnerTodayScreenProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getOwnerToday>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getOwnerToday().then((res) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
  ) => {
    const res = await api.updateBookingStatus(id, status);
    if (res.success) {
      load();
    } else {
      Alert.alert("Ошибка", res.error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.badge}>СЕГОДНЯ</Text>
          <Text style={styles.title}>Обзор записей</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7c5cff" style={{ marginTop: 40 }} />
      ) : !data || !data.success ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Не удалось загрузить расписание</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Статистика дня */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{data.data.stats.total}</Text>
              <Text style={styles.statLabel}>Всего записей</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: "#22c55e" }]}>
                {data.data.stats.revenue.toLocaleString("ru-RU")}
              </Text>
              <Text style={styles.statLabel}>Выручка ({data.data.currency})</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: "#eab308" }]}>
                {data.data.stats.pending}
              </Text>
              <Text style={styles.statLabel}>Ожидают</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: "#3b82f6" }]}>
                {data.data.stats.confirmed}
              </Text>
              <Text style={styles.statLabel}>Подтверждены</Text>
            </View>
          </View>

          {/* Список записей */}
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>
              Записи на {data.data.date} ({data.data.bookings.length})
            </Text>

            {data.data.bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>На сегодня записей нет</Text>
              </View>
            ) : (
              data.data.bookings.map((b) => {
                const timeStr = new Date(b.startAt).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <View key={b.id} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      <Text style={[styles.statusTag, getStatusStyle(b.status)]}>
                        {b.status}
                      </Text>
                    </View>

                    <Text style={styles.clientName}>{b.clientName}</Text>
                    <Text style={styles.clientPhone}>📞 {b.clientPhone}</Text>
                    <Text style={styles.serviceText}>
                      ✂️ {b.serviceName} · {b.price.toLocaleString("ru-RU")} {data.data.currency}
                    </Text>
                    <Text style={styles.staffText}>👤 {b.staffName}</Text>
                    {b.note ? <Text style={styles.noteText}>💬 {b.note}</Text> : null}

                    <View style={styles.btnRow}>
                      {b.status === "PENDING" ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
                          onPress={() => handleUpdateStatus(b.id, "CONFIRMED")}
                        >
                          <Text style={styles.actionBtnText}>Подтвердить</Text>
                        </TouchableOpacity>
                      ) : null}

                      {b.status === "CONFIRMED" ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
                          onPress={() => handleUpdateStatus(b.id, "COMPLETED")}
                        >
                          <Text style={styles.actionBtnText}>Завершить</Text>
                        </TouchableOpacity>
                      ) : null}

                      {b.status !== "CANCELLED" && b.status !== "COMPLETED" ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                          onPress={() => handleUpdateStatus(b.id, "CANCELLED")}
                        >
                          <Text style={styles.actionBtnText}>Отменить</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case "CONFIRMED":
      return { color: "#22c55e", backgroundColor: "rgba(34, 197, 94, 0.15)" };
    case "PENDING":
      return { color: "#eab308", backgroundColor: "rgba(234, 179, 8, 0.15)" };
    case "COMPLETED":
      return { color: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.15)" };
    case "CANCELLED":
      return { color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.15)" };
    default:
      return { color: "#a1a1aa", backgroundColor: "rgba(161, 161, 170, 0.15)" };
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#09090b",
    minHeight: "100%",
  },
  topBar: {
    marginTop: 40,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    color: "#7c5cff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#27272a",
    borderRadius: 8,
  },
  logoutText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#18181b",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  statLabel: {
    fontSize: 12,
    color: "#71717a",
    marginTop: 4,
  },
  listSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timeText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "600",
  },
  clientName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  clientPhone: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 4,
  },
  serviceText: {
    color: "#ffffff",
    fontSize: 13,
    marginBottom: 2,
  },
  staffText: {
    color: "#a1a1aa",
    fontSize: 12,
    marginBottom: 2,
  },
  noteText: {
    color: "#71717a",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#7c5cff",
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
