import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { logger } from "../utils/logger";
import {
  batchProcessingService,
  IBatchProgress,
} from "./batch-processing.service";

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupEventHandlers();
    this.setupBatchProcessingListeners();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      logger.info("Client connected", { socketId: socket.id });

      // Handle user authentication
      socket.on("authenticate", (data: { userId: string; token: string }) => {
        try {
          // In a real implementation, you'd verify the JWT token here
          const userId = data.userId;

          if (!this.connectedClients.has(userId)) {
            this.connectedClients.set(userId, new Set());
          }
          this.connectedClients.get(userId)!.add(socket.id);

          socket.data.userId = userId;
          socket.join(`user_${userId}`);

          logger.info("Client authenticated", { socketId: socket.id, userId });
          socket.emit("authenticated", { success: true });
        } catch (error) {
          logger.error("Authentication failed", { socketId: socket.id, error });
          socket.emit("authentication_failed", { error: "Invalid token" });
        }
      });

      // Handle job subscription
      socket.on("subscribe_job", (data: { jobId: string }) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const job = batchProcessingService.getJob(data.jobId);
        if (!job || job.userId !== userId) {
          socket.emit("error", { message: "Job not found or access denied" });
          return;
        }

        socket.join(`job_${data.jobId}`);
        socket.emit("job_subscribed", { jobId: data.jobId });

        // Send current job status
        socket.emit("job_progress", batchProcessingService.getJobProgress(job));

        logger.info("Client subscribed to job", {
          socketId: socket.id,
          jobId: data.jobId,
        });
      });

      // Handle job unsubscription
      socket.on("unsubscribe_job", (data: { jobId: string }) => {
        socket.leave(`job_${data.jobId}`);
        socket.emit("job_unsubscribed", { jobId: data.jobId });

        logger.info("Client unsubscribed from job", {
          socketId: socket.id,
          jobId: data.jobId,
        });
      });

      // Handle job cancellation
      socket.on("cancel_job", (data: { jobId: string }) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const cancelled = batchProcessingService.cancelJob(data.jobId);
        if (cancelled) {
          socket.emit("job_cancelled", { jobId: data.jobId });
          logger.info("Job cancelled by user", {
            socketId: socket.id,
            jobId: data.jobId,
          });
        } else {
          socket.emit("error", { message: "Failed to cancel job" });
        }
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        const userId = socket.data.userId;
        if (userId && this.connectedClients.has(userId)) {
          this.connectedClients.get(userId)!.delete(socket.id);
          if (this.connectedClients.get(userId)!.size === 0) {
            this.connectedClients.delete(userId);
          }
        }

        logger.info("Client disconnected", { socketId: socket.id, userId });
      });
    });
  }

  /**
   * Setup batch processing event listeners
   */
  private setupBatchProcessingListeners(): void {
    // Job started
    batchProcessingService.on("jobStarted", (job) => {
      this.io.to(`user_${job.userId}`).emit("job_started", {
        jobId: job.id,
        url: job.url,
        startTime: job.startTime,
      });

      logger.info("Job started event sent", {
        jobId: job.id,
        userId: job.userId,
      });
    });

    // Job progress updates
    batchProcessingService.on("jobProgress", (progress: IBatchProgress) => {
      this.io.to(`job_${progress.jobId}`).emit("job_progress", progress);

      // Also send to user's general room
      const job = batchProcessingService.getJob(progress.jobId);
      if (job) {
        this.io.to(`user_${job.userId}`).emit("job_progress", progress);
      }
    });

    // Job completed
    batchProcessingService.on("jobCompleted", (job) => {
      this.io.to(`user_${job.userId}`).emit("job_completed", {
        jobId: job.id,
        totalRecords: job.totalRecords,
        successCount: job.successCount,
        errorCount: job.errorCount,
        duration: job.endTime
          ? job.endTime.getTime() - job.startTime.getTime()
          : 0,
      });

      logger.info("Job completed event sent", {
        jobId: job.id,
        userId: job.userId,
      });
    });

    // Job failed
    batchProcessingService.on("jobFailed", (job) => {
      this.io.to(`user_${job.userId}`).emit("job_failed", {
        jobId: job.id,
        errors: job.errors,
        duration: job.endTime
          ? job.endTime.getTime() - job.startTime.getTime()
          : 0,
      });

      logger.info("Job failed event sent", {
        jobId: job.id,
        userId: job.userId,
      });
    });

    // Job cancelled
    batchProcessingService.on("jobCancelled", (job) => {
      this.io.to(`user_${job.userId}`).emit("job_cancelled", {
        jobId: job.id,
        reason: "Job cancelled by user",
      });

      logger.info("Job cancelled event sent", {
        jobId: job.id,
        userId: job.userId,
      });
    });
  }

  /**
   * Send real-time notification to user
   */
  sendNotificationToUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: any;
    }
  ): void {
    this.io.to(`user_${userId}`).emit("notification", notification);
    logger.info("Notification sent to user", {
      userId,
      type: notification.type,
    });
  }

  /**
   * Send system-wide notification
   */
  sendSystemNotification(notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }): void {
    this.io.emit("system_notification", notification);
    logger.info("System notification sent", { type: notification.type });
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get user's connected clients
   */
  getUserClients(userId: string): string[] {
    return Array.from(this.connectedClients.get(userId) || []);
  }

  /**
   * Disconnect user's all clients
   */
  disconnectUser(userId: string): void {
    const clients = this.connectedClients.get(userId);
    if (clients) {
      clients.forEach((socketId) => {
        this.io.sockets.sockets.get(socketId)?.disconnect();
      });
      this.connectedClients.delete(userId);
    }
  }
}

// Export singleton instance
let websocketService: WebSocketService | null = null;

export const initializeWebSocket = (server: HTTPServer): WebSocketService => {
  if (!websocketService) {
    websocketService = new WebSocketService(server);
  }
  return websocketService;
};

export const getWebSocketService = (): WebSocketService | null => {
  return websocketService;
};
