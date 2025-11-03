import { AppDataSource } from "@/config/database";
import { RefreshToken } from "@/database/models";

export class RefreshTokenRepository {
  private repository = AppDataSource.getRepository(RefreshToken);

  async createToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    // Check if token already exists
    const existing = await this.repository.findOne({
      where: { token: data.token },
    });

    if (existing) {
      // Update expiry instead of creating duplicate
      existing.expiresAt = data.expiresAt;
      existing.isRevoked = false;
      return await this.repository.save(existing);
    }

    const refreshToken = this.repository.create(data);
    return await this.repository.save(refreshToken);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return await this.repository.findOne({
      where: { token, isRevoked: false },
    });
  }

  async revokeToken(token: string): Promise<void> {
    await this.repository.update({ token }, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.repository.update({ userId }, { isRevoked: true });
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now", { now: new Date() })
      .execute();
  }
}
