import { Request, Response, NextFunction } from "express";
import { QueryService } from "@/services/query.service";
import { QueryInput } from "@/validators/query.validator";

export class QueryController {
  constructor(private queryService: QueryService = new QueryService()) {}

  processQuery = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { query, sessionId, files } = req.body as QueryInput;
      const userId = req.user?.userId;

      if (!userId) {
        throw new Error("User ID not found");
      }

      const result = await this.queryService.processQuery({
        query,
        userId,
        sessionId,
        files,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

