module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/agents/(.*)$": "<rootDir>/src/agents/$1",
    "^@/api/(.*)$": "<rootDir>/src/api/$1",
    "^@/config/(.*)$": "<rootDir>/src/config/$1",
    "^@/database/(.*)$": "<rootDir>/src/database/$1",
    "^@/middleware/(.*)$": "<rootDir>/src/middleware/$1",
    "^@/services/(.*)$": "<rootDir>/src/services/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/validators/(.*)$": "<rootDir>/src/validators/$1",
  },
};

