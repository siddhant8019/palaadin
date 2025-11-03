import { geminiClient } from "@/config/gemini";
import { logger } from "@/utils/logger";

export interface ITableFormat {
  columns: Array<{ key: string; header: string }>;
  rows: unknown[][];
  totalRecords: number;
}

export interface IFormattedResponse {
  naturalLanguage: string;
  tableData?: ITableFormat;
  metadata: {
    resultCount: number;
    queryTime: number;
    dataSource: string;
  };
}

export class ResponseFormatterAgent {
  async formatResponse(
    query: string,
    data: unknown[],
    dataType: string
  ): Promise<IFormattedResponse> {
    try {
      const startTime = Date.now();

      const naturalLanguage = await this.generateNaturalLanguageResponse(
        query,
        data,
        dataType
      );

      const tableData = this.formatAsTable(data, dataType);

      const queryTime = Date.now() - startTime;

      logger.info("Response formatted", {
        query: query.substring(0, 100),
        resultCount: data.length,
        queryTime,
      });

      return {
        naturalLanguage,
        tableData,
        metadata: {
          resultCount: data.length,
          queryTime,
          dataSource: "database",
        },
      };
    } catch (error) {
      logger.error("Response formatting failed:", error);
      throw error;
    }
  }

  private async generateNaturalLanguageResponse(
    query: string,
    data: unknown[],
    dataType: string
  ): Promise<string> {
    if (data.length === 0) {
      return `I didn't find any ${dataType} matching your query "${query}".`;
    }

    if (data.length === 1) {
      return `I found 1 ${dataType.slice(0, -1)} matching your query.`;
    }

    return `I found ${data.length} ${dataType} matching your query.`;
  }

  private formatAsTable(
    data: unknown[],
    dataType: string
  ): ITableFormat | undefined {
    if (data.length === 0) {
      return undefined;
    }

    const columns = this.extractColumns(data[0], dataType);
    const rows = data.map((item) =>
      columns.map((col) => (item as Record<string, unknown>)[col.key])
    );

    return {
      columns,
      rows,
      totalRecords: data.length,
    };
  }

  private extractColumns(
    sample: unknown,
    dataType: string
  ): Array<{ key: string; header: string }> {
    if (dataType === "companies") {
      return [
        { key: "name", header: "Company Name" },
        { key: "industry", header: "Industry" },
        { key: "location", header: "Location" },
        { key: "companySize", header: "Size" },
        { key: "website", header: "Website" },
      ];
    }

    if (dataType === "people") {
      return [
        { key: "fullName", header: "Name" },
        { key: "email", header: "Email" },
        { key: "title", header: "Title" },
        { key: "location", header: "Location" },
        { key: "linkedinUrl", header: "LinkedIn" },
      ];
    }

    const sampleObj = sample as Record<string, unknown>;
    return Object.keys(sampleObj)
      .filter((key) => !key.includes("Id") && key !== "metadata")
      .slice(0, 5)
      .map((key) => ({
        key,
        header: this.formatHeader(key),
      }));
  }

  private formatHeader(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}

