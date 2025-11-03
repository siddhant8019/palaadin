import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "@/utils/errors";

export const validateRequest =
  (schema: z.ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => err.message).join(", ");
        next(new ValidationError(errorMessages));
      } else {
        next(error);
      }
    }
  };

export const validateQuery =
  (schema: z.ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => err.message).join(", ");
        next(new ValidationError(errorMessages));
      } else {
        next(error);
      }
    }
  };

export const validateParams =
  (schema: z.ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => err.message).join(", ");
        next(new ValidationError(errorMessages));
      } else {
        next(error);
      }
    }
  };

