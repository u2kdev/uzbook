export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notificationsModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  notificationsModule = require("expo-notifications");
} catch {
  notificationsModule = null;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!notificationsModule) return null;

  try {
    const { status: existingStatus } = await notificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await notificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const tokenData = await notificationsModule.getExpoPushTokenAsync();
    return tokenData.data ?? null;
  } catch (err) {
    console.warn("Failed to get push token:", err);
    return null;
  }
}

export async function scheduleLocalNotification(payload: PushNotificationPayload) {
  if (!notificationsModule) return;

  try {
    await notificationsModule.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: true,
      },
      trigger: null, // show immediately
    });
  } catch (err) {
    console.warn("Failed to schedule local notification:", err);
  }
}
