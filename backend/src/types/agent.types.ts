export enum QueryType {
  DATABASE = "database",
  SCRAPING = "scraping",
  ENTITY_LOOKUP = "entity_lookup",
  FILE_UPLOAD = "file_upload",
  HAR_PROCESSING = "har_processing",
}

export interface IExtractedEntity {
  type: "person" | "company" | "url" | "location" | "industry";
  value: string;
  confidence: number;
}

export interface IQueryIntent {
  type: QueryType;
  entities: IExtractedEntity[];
  parameters: Record<string, unknown>;
  requiresAuth: boolean;
  estimatedComplexity: "low" | "medium" | "high";
}

export interface IConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface IConversationContext {
  userId: string;
  sessionId: string;
  messages: IConversationMessage[];
  lastQuery?: string;
  lastIntent?: IQueryIntent;
  metadata: Record<string, unknown>;
}

export interface IAgentState {
  userId: string;
  sessionId: string;
  query: string;
  intent?: IQueryIntent;
  context?: IConversationContext;
  intermediateResults: Map<string, unknown>;
  finalResult?: unknown;
  errors: Error[];
  status: "pending" | "processing" | "completed" | "failed";
}

export interface IExecutionPlan {
  primaryAgent: string;
  supportingAgents: string[];
  executionMode: "parallel" | "sequential";
  estimatedDuration: number;
  fallbackStrategy?: IExecutionPlan;
}

export interface IAgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

