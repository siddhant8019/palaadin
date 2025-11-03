import {
  QueryType,
  IQueryIntent,
  IExecutionPlan,
  IConversationContext,
} from "@/types/agent.types";
import { logger } from "@/utils/logger";

export class RouterAgent {
  async route(
    intent: IQueryIntent,
    context: IConversationContext
  ): Promise<IExecutionPlan> {
    try {
      const plan = this.buildExecutionPlan(intent);

      logger.info("Execution plan created", {
        primaryAgent: plan.primaryAgent,
        supportingAgents: plan.supportingAgents,
        executionMode: plan.executionMode,
      });

      return plan;
    } catch (error) {
      logger.error("Routing failed:", error);
      throw error;
    }
  }

  private buildExecutionPlan(intent: IQueryIntent): IExecutionPlan {
    switch (intent.type) {
      case QueryType.DATABASE:
        return {
          primaryAgent: "database-query",
          supportingAgents: ["response-formatter"],
          executionMode: "sequential",
          estimatedDuration: 1000,
        };

      case QueryType.SCRAPING:
        return {
          primaryAgent: "scraper-controller",
          supportingAgents: ["analysis", "implementation", "validation"],
          executionMode: "sequential",
          estimatedDuration: 10000,
          fallbackStrategy: {
            primaryAgent: "scraper-controller",
            supportingAgents: ["analysis", "implementation-har", "validation"],
            executionMode: "sequential",
            estimatedDuration: 15000,
          },
        };

      case QueryType.ENTITY_LOOKUP:
        return {
          primaryAgent: "database-query",
          supportingAgents: ["online-search", "response-formatter"],
          executionMode: "sequential",
          estimatedDuration: 3000,
        };

      case QueryType.FILE_UPLOAD:
        return {
          primaryAgent: "file-processor",
          supportingAgents: ["excel-mapper", "validation"],
          executionMode: "sequential",
          estimatedDuration: 5000,
        };

      case QueryType.HAR_PROCESSING:
        return {
          primaryAgent: "file-processor",
          supportingAgents: ["har-parser", "validation"],
          executionMode: "sequential",
          estimatedDuration: 3000,
        };

      default:
        return {
          primaryAgent: "database-query",
          supportingAgents: ["response-formatter"],
          executionMode: "sequential",
          estimatedDuration: 1000,
        };
    }
  }
}

