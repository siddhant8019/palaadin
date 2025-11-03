import request from "supertest";
import express, { Application } from "express";
import authRoutes from "@/api/routes/auth.routes";
import { AppDataSource } from "@/data-source";
import { userFactory } from "@/__tests__/factories/user.factory";

describe("Auth API Integration Tests", () => {
  let app: Application;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: "Test@123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it("should reject registration with invalid email", async () => {
      const userData = {
        email: "invalid-email",
        password: "Test@123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty("code");
    });

    it("should reject registration with weak password", async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: "weak",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });

    it("should reject duplicate email registration", async () => {
      const email = `test${Date.now()}@example.com`;
      
      await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Test@123" });

      const response = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Test@123" })
        .expect(409);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error.code).toBe("ERR_5002");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const email = `test${Date.now()}@example.com`;
      const password = "Test@123";

      await request(app)
        .post("/api/auth/register")
        .send({ email, password });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data.user.email).toBe(email);
    });

    it("should reject login with invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Test@123",
        })
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error.code).toBe("ERR_2001");
    });

    it("should reject login with wrong password", async () => {
      const email = `test${Date.now()}@example.com`;

      await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Test@123" });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "WrongPass@123" })
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const email = `test${Date.now()}@example.com`;
      const password = "Test@123";

      await request(app)
        .post("/api/auth/register")
        .send({ email, password });

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      const email = `test${Date.now()}@example.com`;
      const password = "Test@123";

      await request(app)
        .post("/api/auth/register")
        .send({ email, password });

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

      const accessToken = loginResponse.body.data.accessToken;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
    });
  });
});

