import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { api } from "../api/client";

interface OwnerLoginScreenProps {
  onLoginSuccess: () => void;
  onBackToClient: () => void;
}

export function OwnerLoginScreen({ onLoginSuccess, onBackToClient }: OwnerLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await api.login(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error.message || "Неверный логин или пароль");
      return;
    }

    onLoginSuccess();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBackToClient}>
        <Text style={styles.backButtonText}>← Режим клиента</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.badge}>КАБИНЕТ ВЛАДЕЛЬЦА</Text>
        <Text style={styles.title}>Вход в uzbook</Text>
        <Text style={styles.subtitle}>
          Управление записями, расписанием мастеров и статистикой вашего салона
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="salon@example.uz"
          placeholderTextColor="#71717a"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#71717a"
          secureTextEntry
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти в кабинет</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#09090b",
    flex: 1,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backButtonText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  header: {
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
  form: {
    marginTop: 10,
  },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
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
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
