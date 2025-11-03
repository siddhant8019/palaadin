import axios, { AxiosInstance, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 600000, // 5 minutes for large file processing
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("accessToken");
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        // Prevent infinite retry loops
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;
          if (typeof window !== "undefined") {
            const refreshToken = localStorage.getItem("refreshToken");

            if (refreshToken) {
              try {
                const response = await axios.post(
                  `${API_URL}/api/auth/refresh`,
                  {
                    refreshToken,
                  }
                );

                const { accessToken, refreshToken: newRefreshToken } =
                  response.data.data;

                localStorage.setItem("accessToken", accessToken);
                localStorage.setItem("refreshToken", newRefreshToken);

                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }
                return this.client(originalRequest);
              } catch (refreshError) {
                localStorage.clear();
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
                return Promise.reject(refreshError);
              }
            } else {
              localStorage.clear();
              if (typeof window !== "undefined") {
                window.location.href = "/login";
              }
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  getInstance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getInstance();
