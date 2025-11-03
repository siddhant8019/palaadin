import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/auth.service";
import { RegisterInput, LoginInput, RefreshTokenInput } from "@/validators/auth.validator";

export class AuthController {
  constructor(private authService: AuthService = new AuthService()) {}

  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body as RegisterInput;

      const result = await this.authService.register(email, password);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body as LoginInput;

      const result = await this.authService.login(
        email,
        password,
        req.ip,
        req.headers["user-agent"]
      );

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;

      const result = await this.authService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;

      await this.authService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new Error("User ID not found");
      }

      await this.authService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message: "Logged out from all devices",
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;

      res.status(200).json({
        success: true,
        data: {
          id: user?.userId,
          email: user?.email,
          role: user?.role,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

