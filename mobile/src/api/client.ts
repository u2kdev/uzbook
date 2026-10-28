import { CONFIG } from "../config/env";
import { Storage } from "./storage";

export type ApiResponse<T> =
  | { success: true; data: T; meta?: Record<string, unknown> }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export class MobileApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = CONFIG.apiUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, "");
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    if (requiresAuth) {
      const accessToken = await Storage.getItem(CONFIG.tokenStorageKeys.accessToken);
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    try {
      let res = await fetch(url, { ...options, headers });

      // Handle 401 and attempt refresh
      if (res.status === 401 && requiresAuth) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          const newAccessToken = await Storage.getItem(CONFIG.tokenStorageKeys.accessToken);
          headers.set("Authorization", `Bearer ${newAccessToken}`);
          res = await fetch(url, { ...options, headers });
        }
      }

      const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
      if (!json) {
        return {
          success: false,
          error: { code: "network_error", message: `HTTP ${res.status}: Ошибка ответа сервера` },
        };
      }

      return json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка сетевого соединения";
      return {
        success: false,
        error: { code: "network_exception", message: msg },
      };
    }
  }

  // Auth Methods
  async login(email: string, password: string) {
    const res = await this.request<{
      user: { id: string; email: string; name: string; role: string; phone?: string | null };
      business: { id: string; name: string; slug: string; category: string; plan: string } | null;
      tokens: { accessToken: string; refreshToken: string; expiresIn: number; tokenType: string };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.data.tokens) {
      await Storage.setItem(CONFIG.tokenStorageKeys.accessToken, res.data.tokens.accessToken);
      await Storage.setItem(CONFIG.tokenStorageKeys.refreshToken, res.data.tokens.refreshToken);
      await Storage.setItem(CONFIG.tokenStorageKeys.userRole, res.data.user.role);
    }

    return res;
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = await Storage.getItem(CONFIG.tokenStorageKeys.refreshToken);
    if (!refreshToken) return false;

    const res = await this.request<{
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    if (res.success && res.data.tokens) {
      await Storage.setItem(CONFIG.tokenStorageKeys.accessToken, res.data.tokens.accessToken);
      await Storage.setItem(CONFIG.tokenStorageKeys.refreshToken, res.data.tokens.refreshToken);
      return true;
    }

    await this.logout();
    return false;
  }

  async getMe() {
    return this.request<{
      user: { id: string; email: string; name: string; role: string; phone?: string | null };
      business: {
        id: string;
        name: string;
        slug: string;
        category: string;
        phone: string | null;
        address: string | null;
        city: string | null;
        plan: string;
      } | null;
    }>("/auth/me", { method: "GET" }, true);
  }

  async logout() {
    await Storage.deleteItem(CONFIG.tokenStorageKeys.accessToken);
    await Storage.deleteItem(CONFIG.tokenStorageKeys.refreshToken);
    await Storage.deleteItem(CONFIG.tokenStorageKeys.userRole);
  }

  // Public Salons & Availability
  async getSalon(slug: string) {
    return this.request<{
      salon: {
        id: string;
        name: string;
        slug: string;
        category: string;
        description: string | null;
        phone: string | null;
        address: string | null;
        city: string | null;
        timezone: string;
        currency: string;
      };
      services: Array<{
        id: string;
        name: string;
        category: string | null;
        durationMin: number;
        price: number;
        description: string | null;
      }>;
      staff: Array<{
        id: string;
        name: string;
        title: string | null;
        bio: string | null;
        photoUrl: string | null;
        serviceIds: string[];
      }>;
      gallery: Array<{ id: string; url: string; caption: string | null }>;
    }>(`/salons/${slug}`, { method: "GET" });
  }

  async getAvailability(params: {
    slug: string;
    staffId: string;
    serviceId: string;
    date?: string;
    days?: number;
  }) {
    const qs = new URLSearchParams({
      staffId: params.staffId,
      serviceId: params.serviceId,
      ...(params.date ? { date: params.date } : {}),
      ...(params.days ? { days: String(params.days) } : {}),
    });
    return this.request<{
      slug: string;
      staffId: string;
      serviceId: string;
      days: Array<{ date: string; slots: Array<{ start: string; label: string }> }>;
    }>(`/salons/${params.slug}/availability?${qs.toString()}`, { method: "GET" });
  }

  // Bookings (Client)
  async createBooking(payload: {
    slug: string;
    staffId: string;
    serviceId: string;
    startAt: string;
    name: string;
    phone: string;
    email?: string;
    note?: string;
  }) {
    const res = await this.request<{
      booking: { id: string; manageToken: string; startAt: string; endAt: string };
      manageUrl: string;
    }>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.success) {
      await Storage.setItem(CONFIG.tokenStorageKeys.clientPhone, payload.phone);
    }
    return res;
  }

  async getBookingsByPhone(phone: string) {
    const qs = new URLSearchParams({ phone });
    return this.request<{
      phone: string;
      count: number;
      bookings: Array<{
        id: string;
        manageToken: string;
        manageUrl: string;
        status: string;
        startAt: string;
        endAt: string;
        clientName: string;
        clientPhone: string;
        service: { name: string; price: number; durationMin: number };
        staff: { name: string };
        salon: { name: string; slug: string; address: string | null; phone: string | null };
      }>;
    }>(`/bookings?${qs.toString()}`, { method: "GET" });
  }

  async getBookingDetails(token: string) {
    return this.request<{
      id: string;
      status: string;
      startAt: string;
      endAt: string;
      price: number;
      durationMin: number;
      clientName: string;
      clientPhone: string;
      note: string | null;
      manageToken: string;
      manageUrl: string;
      service: { id: string; name: string; price: number; durationMin: number };
      staff: { id: string; name: string; photoUrl: string | null; title: string | null };
      business: { id: string; name: string; slug: string; phone: string | null; address: string | null };
    }>(`/bookings/${token}`, { method: "GET" });
  }

  async cancelBooking(token: string, reason?: string) {
    return this.request<{ cancelled: boolean; bookingId: string; message: string }>(
      `/bookings/${token}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
  }

  async rescheduleBooking(token: string, startAt: string) {
    return this.request<{ rescheduled: boolean; startAt: string; endAt: string; message: string }>(
      `/bookings/${token}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({ startAt }),
      },
    );
  }

  // Owner Management (Bearer Auth)
  async getOwnerToday(date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return this.request<{
      date: string;
      timezone: string;
      currency: string;
      stats: {
        total: number;
        confirmed: number;
        pending: number;
        completed: number;
        cancelled: number;
        noShow: number;
        revenue: number;
      };
      staff: Array<{ id: string; name: string; color: string; photoUrl: string | null }>;
      bookings: Array<{
        id: string;
        status: string;
        startAt: string;
        endAt: string;
        clientName: string;
        clientPhone: string;
        serviceName: string;
        price: number;
        staffId: string;
        staffName: string;
        note: string | null;
      }>;
    }>(`/owner/today${qs}`, { method: "GET" }, true);
  }

  async getOwnerBookings(params: {
    status?: string;
    staffId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.staffId) qs.set("staffId", params.staffId);
    if (params.fromDate) qs.set("fromDate", params.fromDate);
    if (params.toDate) qs.set("toDate", params.toDate);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));

    return this.request<{
      total: number;
      limit: number;
      offset: number;
      bookings: Array<{
        id: string;
        manageToken: string;
        status: string;
        startAt: string;
        endAt: string;
        source: string;
        cancelReason: string | null;
        client: { name: string; phone: string; email: string | null; note: string | null };
        service: { id: string; name: string; price: number; durationMin: number };
        staff: { id: string; name: string; color: string };
      }>;
    }>(`/owner/bookings?${qs.toString()}`, { method: "GET" }, true);
  }

  async updateBookingStatus(id: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW", reason?: string) {
    return this.request<{ id: string; status: string; updatedAt: string; message: string }>(
      `/owner/bookings/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      },
      true,
    );
  }

  async getOwnerServices() {
    return this.request<{
      count: number;
      services: Array<{
        id: string;
        name: string;
        category: string | null;
        description: string | null;
        price: number;
        durationMin: number;
        isActive: boolean;
      }>;
    }>("/owner/services", { method: "GET" }, true);
  }

  async getOwnerStaff() {
    return this.request<{
      count: number;
      staff: Array<{
        id: string;
        name: string;
        title: string | null;
        bio: string | null;
        color: string;
        photoUrl: string | null;
        isActive: boolean;
        sortOrder: number;
        serviceIds: string[];
      }>;
    }>("/owner/staff", { method: "GET" }, true);
  }
}

export const api = new MobileApiClient();
