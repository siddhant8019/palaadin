import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { UnauthorizedError } from "./errors";

export interface IJWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const generateAccessToken = (payload: {
  userId: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: "1h", // Increased from 15m to prevent expiry during file processing
    algorithm: "HS256",
  });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
};

export const verifyAccessToken = (token: string): IJWTPayload => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as IJWTPayload;
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
};
