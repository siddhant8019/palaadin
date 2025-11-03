import { UserRepository } from "@/database/repositories/user.repository";
import { RefreshTokenRepository } from "@/database/repositories/refresh-token.repository";
import { hashPassword, comparePassword } from "@/utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "@/utils/jwt";
import { UnauthorizedError } from "@/utils/errors";
import { User, UserRole } from "@/database/models";
import { securityLogger } from "@/utils/logger";

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export class AuthService {
  constructor(
    private userRepository: UserRepository = new UserRepository(),
    private refreshTokenRepository: RefreshTokenRepository = new RefreshTokenRepository()
  ) {}

  async register(
    email: string,
    password: string
  ): Promise<IAuthResponse> {
    const passwordHash = await hashPassword(password);

    const user = await this.userRepository.createUser({
      email,
      passwordHash,
      role: UserRole.USER,
    });

    securityLogger.info("User registered", {
      userId: user.id,
      email: user.email,
    });

    return await this.generateAuthResponse(user);
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IAuthResponse> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      securityLogger.warn("Failed login attempt - user not found", {
        email,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      securityLogger.warn("Failed login attempt - invalid password", {
        userId: user.id,
        email,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError("Invalid email or password");
    }

    await this.userRepository.updateLastLogin(user.id);

    securityLogger.info("User logged in", {
      userId: user.id,
      email: user.email,
      ipAddress,
    });

    return await this.generateAuthResponse(user);
  }

  async refreshAccessToken(refreshToken: string): Promise<IAuthResponse> {
    const tokenRecord = await this.refreshTokenRepository.findByToken(
      refreshToken
    );

    if (!tokenRecord) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (new Date() > tokenRecord.expiresAt) {
      await this.refreshTokenRepository.revokeToken(refreshToken);
      throw new UnauthorizedError("Refresh token expired");
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(payload.userId);

    await this.refreshTokenRepository.revokeToken(refreshToken);

    return await this.generateAuthResponse(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenRepository.revokeToken(refreshToken);

    securityLogger.info("User logged out", {
      refreshToken: refreshToken.substring(0, 10) + "...",
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllUserTokens(userId);

    securityLogger.info("User logged out from all devices", {
      userId,
    });
  }

  private async generateAuthResponse(user: User): Promise<IAuthResponse> {
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.createToken({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}

