import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { api } from "../api/client";

interface BookingWizardProps {
  slug: string;
  initialServiceId?: string;
  initialStaffId?: string;
  onCancel: () => void;
  onSuccess: (bookingId: string, manageToken: string) => void;
}

export function BookingWizardScreen({
  slug,
  initialServiceId,
  initialStaffId,
  onCancel,
  onSuccess,
}: BookingWizardProps) {
  const [salonData, setSalonData] = useState<Awaited<ReturnType<typeof api.getSalon>> | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId ?? null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId ?? null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [availableSlots, setAvailableSlots] = useState<Array<{ start: string; label: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNote, setClientNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSalon(slug).then((res) => {
      setSalonData(res);
      if (res.success) {
        if (!initialServiceId && res.data.services[0]) {
          setSelectedServiceId(res.data.services[0].id);
        }
        if (!initialStaffId && res.data.staff[0]) {
          setSelectedStaffId(res.data.staff[0].id);
        }
      }
    });
  }, [slug, initialServiceId, initialStaffId]);

  useEffect(() => {
    if (!selectedServiceId || !selectedStaffId) return;

    let mounted = true;
    setLoadingSlots(true);
    setSelectedSlot(null);

    api
      .getAvailability({
        slug,
        serviceId: selectedServiceId,
        staffId: selectedStaffId,
        date: selectedDate,
      })
      .then((res) => {
        if (!mounted) return;
        setLoadingSlots(false);
        if (res.success && res.data.days[0]) {
          setAvailableSlots(res.data.days[0].slots);
        } else {
          setAvailableSlots([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug, selectedServiceId, selectedStaffId, selectedDate]);

  const handleSubmit = async () => {
    if (!selectedServiceId || !selectedStaffId || !selectedSlot) {
      setError("Выберите услугу, мастера и время записи");
      return;
    }
    if (clientName.trim().length < 2) {
      setError("Введите ваше имя (минимум 2 буквы)");
      return;
    }
    if (clientPhone.trim().length < 7) {
      setError("Введите номер телефона");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await api.createBooking({
      slug,
      serviceId: selectedServiceId,
      staffId: selectedStaffId,
      startAt: selectedSlot,
      name: clientName.trim(),
      phone: clientPhone.trim(),
      note: clientNote.trim() || undefined,
    });

    setSubmitting(false);

    if (!res.success) {
      setError(res.error.message || "Не удалось создать запись");
      return;
    }

    onSuccess(res.data.booking.id, res.data.booking.manageToken);
  };

  if (!salonData || !salonData.success) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#7c5cff" />
      </View>
    );
  }

  const { services, staff } = salonData.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>Оформление записи</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.closeText}>Закрыть</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* 1. Выбор услуги */}
      <View style={styles.section}>
        <Text style={styles.stepTitle}>1. Услуга</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.pill, selectedServiceId === s.id && styles.pillActive]}
              onPress={() => setSelectedServiceId(s.id)}
            >
              <Text style={[styles.pillText, selectedServiceId === s.id && styles.pillTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 2. Выбор мастера */}
      <View style={styles.section}>
        <Text style={styles.stepTitle}>2. Мастер</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {staff.map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[styles.pill, selectedStaffId === st.id && styles.pillActive]}
              onPress={() => setSelectedStaffId(st.id)}
            >
              <Text style={[styles.pillText, selectedStaffId === st.id && styles.pillTextActive]}>
                {st.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. Выбор времени */}
      <View style={styles.section}>
        <Text style={styles.stepTitle}>3. Время на {selectedDate}</Text>
        {loadingSlots ? (
          <ActivityIndicator color="#7c5cff" style={{ marginVertical: 20 }} />
        ) : availableSlots.length === 0 ? (
          <Text style={styles.emptySlots}>На выбранную дату нет свободных окон</Text>
        ) : (
          <View style={styles.slotsGrid}>
            {availableSlots.map((slot) => (
              <TouchableOpacity
                key={slot.start}
                style={[styles.slotPill, selectedSlot === slot.start && styles.slotPillActive]}
                onPress={() => setSelectedSlot(slot.start)}
              >
                <Text
                  style={[
                    styles.slotPillText,
                    selectedSlot === slot.start && styles.slotPillTextActive,
                  ]}
                >
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 4. Контактные данные */}
      <View style={styles.section}>
        <Text style={styles.stepTitle}>4. Ваши контакты</Text>
        <TextInput
          style={styles.input}
          placeholder="Ваше имя"
          placeholderTextColor="#71717a"
          value={clientName}
          onChangeText={setClientName}
        />
        <TextInput
          style={styles.input}
          placeholder="+998 90 123 45 67"
          placeholderTextColor="#71717a"
          keyboardType="phone-pad"
          value={clientPhone}
          onChangeText={setClientPhone}
        />
        <TextInput
          style={[styles.input, { height: 70 }]}
          placeholder="Пожелание к записи (необязательно)"
          placeholderTextColor="#71717a"
          multiline
          value={clientNote}
          onChangeText={setClientNote}
        />
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmBtnText}>Подтвердить запись</Text>
        )}
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    marginTop: 40,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  closeText: {
    color: "#a1a1aa",
    fontSize: 14,
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
  section: {
    marginBottom: 22,
  },
  stepTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
  },
  pill: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: "#7c5cff",
    borderColor: "#7c5cff",
  },
  pillText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "500",
  },
  pillTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotPill: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  slotPillActive: {
    backgroundColor: "#7c5cff",
    borderColor: "#7c5cff",
  },
  slotPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
  slotPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  emptySlots: {
    color: "#71717a",
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 14,
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 10,
  },
  confirmBtn: {
    backgroundColor: "#7c5cff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
