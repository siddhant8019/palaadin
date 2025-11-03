import request from "supertest";
import express, { Application } from "express";
import authRoutes from "@/api/routes/auth.routes";
import { AppDataSource } from "@/config/database";
import { User } from "@/database/models/User.model";
import { errorHandler } from "@/middleware/error-handler";

describe("Auth Controller", () => {
  let app: Application;
  let userRepo: any;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
    app.use(errorHandler);

    userRepo = AppDataSource.getRepository(User);
  });

  beforeEach(async () => {
    await userRepo.clear();
  });

  afterAll(async () => {
    await userRepo.clear();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "newuser@example.com",
        password: "SecurePass123!",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data.user.email).toBe("newuser@example.com");
    });

    it("should reject duplicate email", async () => {
      await request(app).post("/api/auth/register").send({
        email: "duplicate@example.com",
        password: "SecurePass123!",
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "duplicate@example.com",
        password: "AnotherPass123!",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should validate email format", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "invalid-email",
        password: "SecurePass123!",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should validate password strength", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "weak",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject missing fields", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should trim email whitespace", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "  spaces@example.com  ",
        password: "SecurePass123!",
      });

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe("spaces@example.com");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register").send({
        email: "loginuser@example.com",
        password: "SecurePass123!",
      });
    });

    it("should login with correct credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "loginuser@example.com",
        password: "SecurePass123!",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    });

    it("should reject incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "loginuser@example.com",
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject non-existent email", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "SecurePass123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should update lastLogin timestamp", async () => {
      const user = await userRepo.findOne({
        where: { email: "loginuser@example.com" },
      });
      const lastLoginBefore = user.lastLogin;

      await request(app).post("/api/auth/login").send({
        email: "loginuser@example.com",
        password: "SecurePass123!",
      });

      const updatedUser = await userRepo.findOne({
        where: { email: "loginuser@example.com" },
      });

      expect(updatedUser.lastLogin).toBeDefined();
      if (lastLoginBefore) {
        expect(updatedUser.lastLogin.getTime()).toBeGreaterThan(
          lastLoginBefore.getTime()
        );
      }
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          email: "refreshuser@example.com",
          password: "SecurePass123!",
        });

      refreshToken = registerResponse.body.data.refreshToken;
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({
        refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({
        refreshToken: "invalid.token.here",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject missing refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          email: "logoutuser@example.com",
          password: "SecurePass123!",
        });

      accessToken = registerResponse.body.data.accessToken;
      refreshToken = registerResponse.body.data.refreshToken;
    });

    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject logout without authentication", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          email: "meuser@example.com",
          password: "SecurePass123!",
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it("should get current user with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe("meuser@example.com");
    });

    it("should reject without authentication", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

