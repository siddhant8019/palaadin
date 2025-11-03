import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "@/utils/errors";
import { UserRole } from "@/database/models";

interface IPermission {
  resource: string;
  actions: string[];
}

const rolePermissions: Record<UserRole, IPermission[]> = {
  [UserRole.ADMIN]: [
    { resource: "users", actions: ["create", "read", "update", "delete"] },
    { resource: "companies", actions: ["create", "read", "update", "delete"] },
    { resource: "people", actions: ["create", "read", "update", "delete"] },
    { resource: "scraping", actions: ["create", "read", "update", "delete"] },
    { resource: "files", actions: ["create", "read", "update", "delete"] },
  ],
  [UserRole.USER]: [
    { resource: "companies", actions: ["create", "read", "update"] },
    { resource: "people", actions: ["create", "read", "update"] },
    { resource: "scraping", actions: ["create", "read"] },
    { resource: "files", actions: ["create", "read"] },
  ],
  [UserRole.VIEWER]: [
    { resource: "companies", actions: ["read"] },
    { resource: "people", actions: ["read"] },
  ],
};

export const requirePermission =
  (resource: string, action: string) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      const permissions = rolePermissions[user.role as UserRole];
      const hasPermission = permissions?.some(
        (p) => p.resource === resource && p.actions.includes(action)
      );

      if (!hasPermission) {
        throw new ForbiddenError(
          `Insufficient permissions to ${action} ${resource}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

      console.log(
        `[Authorization] requireRole check for ${req.method} ${req.path}, user exists: ${!!user}, user email: ${user?.email || "N/A"}`
      );

      if (!user) {
        console.log(
          `[Authorization] BLOCKING - req.user is undefined for ${req.path}`
        );
        throw new UnauthorizedError("Authentication required");
      }

      if (!roles.includes(user.role as UserRole)) {
        throw new ForbiddenError("Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
