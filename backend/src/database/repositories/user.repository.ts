import { AppDataSource } from "@/config/database";
import { User } from "@/database/models";
import { NotFoundError, ConflictError } from "@/utils/errors";

export class UserRepository {
  private repository = AppDataSource.getRepository(User);

  async findById(id: string): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({ where: { email } });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    role?: string;
  }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictError("User with this email already exists");
    }

    const user = this.repository.create(data);
    return await this.repository.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.repository.update(userId, {
      lastLogin: new Date(),
    });
  }

  async updateUser(
    userId: string,
    data: Partial<User>
  ): Promise<User> {
    await this.repository.update(userId, data);
    return await this.findById(userId);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.repository.update(userId, {
      isActive: false,
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await this.repository.find({
      where: { isActive: true },
      select: ["id", "email", "role", "emailVerified", "createdAt", "lastLogin"],
    });
  }
}

