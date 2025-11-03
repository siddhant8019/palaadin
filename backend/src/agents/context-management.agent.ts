import { AppDataSource } from "@/config/database";
import { UserSession } from "@/database/models";
import {
  IConversationContext,
  IConversationMessage,
  IQueryIntent,
} from "@/types/agent.types";
import { logger } from "@/utils/logger";

export class ContextManagementAgent {
  private sessionRepository = AppDataSource.getRepository(UserSession);

  async getOrCreateContext(
    userId: string,
    sessionId?: string
  ): Promise<IConversationContext> {
    try {
      if (sessionId) {
        const session = await this.sessionRepository.findOne({
          where: { id: sessionId, userId, isActive: true },
        });

        if (session) {
          return {
            userId,
            sessionId: session.id,
            messages: (session.conversationHistory as IConversationMessage[]) || [],
            lastQuery: session.lastQuery || undefined,
            metadata: (session.sessionData as Record<string, unknown>) || {},
          };
        }
      }

      const newSession = this.sessionRepository.create({
        userId,
        conversationHistory: [],
        sessionData: {},
        isActive: true,
      });

      const saved = await this.sessionRepository.save(newSession);

      return {
        userId,
        sessionId: saved.id,
        messages: [],
        metadata: {},
      };
    } catch (error) {
      logger.error("Error getting context:", error);
      throw error;
    }
  }

  async addToContext(
    sessionId: string,
    message: IConversationMessage
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) {
        return;
      }

      const messages = (session.conversationHistory as IConversationMessage[]) || [];
      messages.push(message);

      await this.sessionRepository.update(sessionId, {
        conversationHistory: messages as unknown[],
        lastQuery: message.role === "user" ? message.content : session.lastQuery,
        lastQueryTimestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error adding to context:", error);
    }
  }

  async updateContext(
    sessionId: string,
    updates: {
      lastIntent?: IQueryIntent;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) {
        return;
      }

      const sessionData = (session.sessionData as Record<string, unknown>) || {};

      if (updates.lastIntent) {
        sessionData.lastIntent = updates.lastIntent;
      }

      if (updates.metadata) {
        Object.assign(sessionData, updates.metadata);
      }

      await this.sessionRepository.update(sessionId, {
        sessionData: sessionData as unknown,
      });
    } catch (error) {
      logger.error("Error updating context:", error);
    }
  }

  async clearContext(sessionId: string): Promise<void> {
    try {
      await this.sessionRepository.update(sessionId, {
        isActive: false,
      });

      logger.info("Context cleared", { sessionId });
    } catch (error) {
      logger.error("Error clearing context:", error);
    }
  }

  async pruneOldSessions(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await this.sessionRepository
        .createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where("updatedAt < :cutoffDate", { cutoffDate })
        .execute();

      logger.info("Old sessions pruned", { daysOld });
    } catch (error) {
      logger.error("Error pruning sessions:", error);
    }
  }
}

