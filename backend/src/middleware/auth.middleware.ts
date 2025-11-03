import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, IJWTPayload } from "@/utils/jwt";
import { UnauthorizedError } from "@/utils/errors";
import { logger } from "@/utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;
    }
  }
}

export const authenticateJWT = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("No authorization token provided", {
        method: req.method,
        path: req.path,
      });
      throw new UnauthorizedError("No token provided");
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    // Log auth failures for debugging
    if (error instanceof Error) {
      logger.warn("Authentication failed", {
        method: req.method,
        path: req.path,
        error: error.message,
      });
    }
    next(error);
  }
};

export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      req.user = payload;
    }

    next();
  } catch (_error) {
    next();
  }
};
