import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerUiOptions } from "swagger-ui-express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sales Intelligence Platform API",
      version: "1.0.0",
      description: `
        A universal, AI-powered sales intelligence platform API that combines conversational AI 
        with intelligent web scraping and master database management.
      `,
      contact: {
        name: "API Support",
        email: "support@salesintelligence.io",
      },
      license: {
        name: "Proprietary",
        url: "https://salesintelligence.io/license",
      },
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Development server",
      },
      {
        url: "https://api.salesintelligence.io",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Authorization header using the Bearer scheme",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  example: "Validation failed",
                },
                code: {
                  type: "string",
                  example: "ERR_1000",
                },
                statusCode: {
                  type: "integer",
                  example: 400,
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                metadata: {
                  type: "object",
                },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            role: {
              type: "string",
              enum: ["admin", "user", "viewer"],
            },
            isActive: {
              type: "boolean",
            },
            emailVerified: {
              type: "boolean",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Company: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
            },
            domain: {
              type: "string",
            },
            industry: {
              type: "string",
            },
            companySize: {
              type: "string",
            },
            location: {
              type: "string",
            },
            linkedinUrl: {
              type: "string",
              format: "uri",
            },
            website: {
              type: "string",
              format: "uri",
            },
            description: {
              type: "string",
            },
            foundedYear: {
              type: "integer",
            },
            fundingStage: {
              type: "string",
            },
            dataSource: {
              type: "string",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Person: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            firstName: {
              type: "string",
            },
            lastName: {
              type: "string",
            },
            fullName: {
              type: "string",
            },
            email: {
              type: "string",
              format: "email",
            },
            phone: {
              type: "string",
            },
            linkedinUrl: {
              type: "string",
              format: "uri",
            },
            title: {
              type: "string",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            location: {
              type: "string",
            },
            dataSource: {
              type: "string",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        ScrapingJob: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            url: {
              type: "string",
              format: "uri",
            },
            status: {
              type: "string",
              enum: ["pending", "analyzing", "scraping", "validating", "completed", "failed"],
            },
            strategyUsed: {
              type: "string",
            },
            recordsExtracted: {
              type: "integer",
            },
            validationStatus: {
              type: "string",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        ForbiddenError: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        ValidationError: {
          description: "Validation failed",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        ServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Companies",
        description: "Company management endpoints",
      },
      {
        name: "People",
        description: "Person management endpoints",
      },
      {
        name: "Scraping",
        description: "Web scraping endpoints",
      },
      {
        name: "Files",
        description: "File upload and processing endpoints",
      },
      {
        name: "Query",
        description: "Natural language query processing endpoints",
      },
    ],
  },
  apis: ["./src/api/routes/*.ts", "./src/api/controllers/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #3182CE }
  `,
  customSiteTitle: "Sales Intelligence API Docs",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
};

