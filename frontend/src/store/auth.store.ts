import { create } from "zustand";
import { IUser, IAuthResponse } from "@/types/auth.types";
import { authService } from "@/services/auth.service";

interface IAuthStore {
  user: IUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setAuth: (authData: IAuthResponse) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  checkAuth: () => Promise<void>;
  initializeAuth: () => void;
}

export const useAuthStore = create<IAuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setAuth: (authData: IAuthResponse) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", authData.accessToken);
      localStorage.setItem("refreshToken", authData.refreshToken);
      localStorage.setItem("user", JSON.stringify(authData.user));
    }

    set({
      user: authData.user,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      isAuthenticated: true,
      error: null,
    });
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const authData = await authService.login({ email, password });
      get().setAuth(authData);
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || "Login failed",
        isLoading: false,
      });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const authData = await authService.register({ email, password });
      get().setAuth(authData);
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || "Registration failed",
        isLoading: false,
      });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const { refreshToken } = get();

    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (error) {
        // Logout locally even if API call fails
      }
    }

    get().clearAuth();
  },

  logoutAll: async () => {
    try {
      await authService.logoutAll();
      get().clearAuth();
    } catch (error) {
      // Logout locally even if API call fails
      get().clearAuth();
    }
  },

  checkAuth: async () => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("accessToken");
    const userStr = localStorage.getItem("user");
    const refreshToken = localStorage.getItem("refreshToken");

    if (token && userStr && refreshToken) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          accessToken: token,
          refreshToken,
          isAuthenticated: true,
        });

        const currentUser = await authService.getCurrentUser();
        set({ user: currentUser });
      } catch (error) {
        get().clearAuth();
      }
    }
  },

  initializeAuth: () => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("accessToken");
    const userStr = localStorage.getItem("user");
    const refreshToken = localStorage.getItem("refreshToken");

    if (token && userStr && refreshToken) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          accessToken: token,
          refreshToken,
          isAuthenticated: true,
        });
      } catch (error) {
        get().clearAuth();
      }
    }
  },
}));

