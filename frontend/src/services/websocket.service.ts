import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";

export interface IBatchJob {
  id: string;
  url: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  errors: string[];
}

export interface IBatchProgress {
  jobId: string;
  status: string;
  progress: number;
  processedRecords: number;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  estimatedTimeRemaining?: number;
  errors: string[];
}

export interface IWebSocketService {
  connect(): void;
  disconnect(): void;
  subscribeToJob(jobId: string): void;
  unsubscribeFromJob(jobId: string): void;
  cancelJob(jobId: string): void;
  onJobProgress(callback: (progress: IBatchProgress) => void): void;
  onJobCompleted(callback: (data: any) => void): void;
  onJobFailed(callback: (data: any) => void): void;
  onJobCancelled(callback: (data: any) => void): void;
  onNotification(callback: (notification: any) => void): void;
  isConnected(): boolean;
}

class WebSocketService implements IWebSocketService {
  private socket: Socket | null = null;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    this.socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
    });

    this.setupEventHandlers();
    this.authenticate();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
      this.authenticate();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.isAuthenticated = false;

      if (reason === "io server disconnect") {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.handleReconnect();
    });

    this.socket.on("authenticated", (data) => {
      console.log("WebSocket authenticated:", data);
      this.isAuthenticated = true;
    });

    this.socket.on("authentication_failed", (data) => {
      console.error("WebSocket authentication failed:", data);
      this.isAuthenticated = false;
    });

    this.socket.on("job_subscribed", (data) => {
      console.log("Subscribed to job:", data);
    });

    this.socket.on("job_unsubscribed", (data) => {
      console.log("Unsubscribed from job:", data);
    });

    this.socket.on("job_cancelled", (data) => {
      console.log("Job cancelled:", data);
    });

    this.socket.on("error", (data) => {
      console.error("WebSocket error:", data);
    });
  }

  private authenticate(): void {
    if (!this.socket?.connected || this.isAuthenticated) {
      return;
    }

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (token && userId) {
      this.socket.emit("authenticate", { userId, token });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  subscribeToJob(jobId: string): void {
    if (!this.socket?.connected || !this.isAuthenticated) {
      console.error("WebSocket not connected or not authenticated");
      return;
    }

    this.socket.emit("subscribe_job", { jobId });
  }

  unsubscribeFromJob(jobId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit("unsubscribe_job", { jobId });
  }

  cancelJob(jobId: string): void {
    if (!this.socket?.connected || !this.isAuthenticated) {
      console.error("WebSocket not connected or not authenticated");
      return;
    }

    this.socket.emit("cancel_job", { jobId });
  }

  onJobProgress(callback: (progress: IBatchProgress) => void): void {
    if (!this.socket) return;
    this.socket.on("job_progress", callback);
  }

  onJobCompleted(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on("job_completed", callback);
  }

  onJobFailed(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on("job_failed", callback);
  }

  onJobCancelled(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on("job_cancelled", callback);
  }

  onNotification(callback: (notification: any) => void): void {
    if (!this.socket) return;
    this.socket.on("notification", callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
