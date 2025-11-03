import { apiClient } from "./api";

export interface IQueryRequest {
  query: string;
  sessionId?: string;
  files?: File[];
}

export interface IQueryResponse {
  answer: string;
  data?: {
    columns: Array<{ key: string; header: string }>;
    rows: unknown[][];
    totalRecords: number;
  };
  sessionId: string;
  queryType: string;
  metadata?: {
    resultCount: number;
    queryTime: number;
    dataSource: string;
  };
}

export class QueryService {
  async submitQuery(request: IQueryRequest): Promise<IQueryResponse> {
    const formData = new FormData();
    formData.append("query", request.query);

    if (request.sessionId) {
      formData.append("sessionId", request.sessionId);
    }

    if (request.files && request.files.length > 0) {
      request.files.forEach((file) => {
        formData.append("files", file);
      });
    }

    const response = await apiClient.post("/api/query", {
      query: request.query,
      sessionId: request.sessionId,
    });

    return response.data.data;
  }
}

export const queryService = new QueryService();

