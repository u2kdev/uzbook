export const CONFIG = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
  appName: "uzbook",
  scheme: "uzbook",
  tokenStorageKeys: {
    accessToken: "uzbook_access_token",
    refreshToken: "uzbook_refresh_token",
    userRole: "uzbook_user_role",
    clientPhone: "uzbook_client_phone",
  },
};
