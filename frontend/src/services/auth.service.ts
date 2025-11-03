import { apiClient } from "./api";
import {
  IAuthResponse,
  ILoginCredentials,
  IRegisterCredentials,
  IUser,
} from "@/types/auth.types";

export class AuthService {
  async register(credentials: IRegisterCredentials): Promise<IAuthResponse> {
    const response = await apiClient.post("/api/auth/register", credentials);
    return response.data.data;
  }

  async login(credentials: ILoginCredentials): Promise<IAuthResponse> {
    const response = await apiClient.post("/api/auth/login", credentials);
    return response.data.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post("/api/auth/logout", { refreshToken });
  }

  async logoutAll(): Promise<void> {
    await apiClient.post("/api/auth/logout-all");
  }

  async getCurrentUser(): Promise<IUser> {
    const response = await apiClient.get("/api/auth/me");
    return response.data.data;
  }

  async refreshToken(refreshToken: string): Promise<IAuthResponse> {
    const response = await apiClient.post("/api/auth/refresh", {
      refreshToken,
    });
    return response.data.data;
  }
}

export const authService = new AuthService();

