import { Router } from "express";
import { AuthController } from "@/api/controllers/auth.controller";
import { validateRequest } from "@/middleware/validation.middleware";
import { authenticateJWT } from "@/middleware/auth.middleware";
import { authRateLimiter } from "@/middleware/security";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "@/validators/auth.validator";

const router = Router();
const authController = new AuthController();

router.post(
  "/register",
  authRateLimiter,
  validateRequest(registerSchema),
  authController.register
);

router.post(
  "/login",
  authRateLimiter,
  validateRequest(loginSchema),
  authController.login
);

router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  authController.refreshToken
);

router.post(
  "/logout",
  validateRequest(refreshTokenSchema),
  authController.logout
);

router.post("/logout-all", authenticateJWT, authController.logoutAll);

router.get("/me", authenticateJWT, authController.me);

export default router;

