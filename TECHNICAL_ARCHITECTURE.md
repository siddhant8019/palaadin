# Technical Architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (Next.js + TypeScript)                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ Search Bar  │  │ Data Table  │  │ Agent Panel │           │
│  │   Component │  │  Component  │  │  Component  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
│                  (Express.js + TypeScript)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Middleware Stack                                        │  │
│  │ • Authentication (JWT Verification)                     │  │
│  │ • Authorization (RBAC)                                  │  │
│  │ • Rate Limiting                                         │  │
│  │ • Request Validation (Zod)                              │  │
│  │ • Error Handling                                        │  │
│  │ • Logging                                               │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────┴────────┐  ┌────────┴────────┐  ┌───────┴────────┐
│  Auth Service  │  │ Query Service   │  │ Data Service   │
│                │  │                 │  │                │
│ • Registration │  │ • Intent Parse  │  │ • CRUD Ops     │
│ • Login        │  │ • Agent Routing │  │ • Search       │
│ • Token Gen    │  │ • Response Gen  │  │ • Export       │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│              MULTI-AGENT ORCHESTRATION LAYER                    │
│                      (LangGraph)                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           Conversational Agent Layer                      │ │
│  │                                                           │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐     │ │
│  │  │  Intent    │  │   Context   │  │    Router    │     │ │
│  │  │Recognition │→ │ Management  │→ │    Agent     │     │ │
│  │  │   Agent    │  │    Agent    │  │              │     │ │
│  │  └────────────┘  └─────────────┘  └──────┬───────┘     │ │
│  │                                           │             │ │
│  │       ┌───────────────┬──────────────────┼─────────┐   │ │
│  │       │               │                  │         │   │ │
│  │  ┌────┴────┐  ┌───────┴──────┐  ┌────────┴───┐  ┌┴──────┐ │
│  │  │Database │  │   Scraper    │  │   File    │  │Online │ │
│  │  │ Query   │  │  Controller  │  │ Processor │  │Search │ │
│  │  │ Agent   │  │    Agent     │  │   Agent   │  │ Agent │ │
│  │  └─────────┘  └───────┬──────┘  └───────────┘  └───────┘ │
│  └────────────────────────┼──────────────────────────────────┘ │
│                           │                                    │
│  ┌────────────────────────┼──────────────────────────────────┐ │
│  │              Scraping Agent Layer                         │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐    │ │
│  │  │  Analysis   │→ │Implementation│→ │ Validation  │    │ │
│  │  │   Agent     │  │    Agent     │  │   Agent     │    │ │
│  │  │             │  │              │  │             │    │ │
│  │  │• Analyze    │  │• CSS Select  │  │• Count Check│    │ │
│  │  │• Strategy   │  │• HAR Parse   │  │• Format Val │    │ │
│  │  │  Selection  │  │• OCR/ML      │  │• Logic Check│    │ │
│  │  └─────────────┘  └──────────────┘  └─────────────┘    │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────┴────────┐  ┌────────┴────────┐  ┌───────┴────────┐
│  Gemini API    │  │  Web Search API │  │   Puppeteer    │
│                │  │                 │  │                │
│ • Intent Parse │  │ • LinkedIn      │  │ • Page Load    │
│ • Strategy Gen │  │   Search        │  │ • HAR Capture  │
│ • Data Extract │  │ • Data Enrich   │  │ • Screenshots  │
│ • NL Response  │  │ • Validation    │  │ • Scraping     │
└────────────────┘  └─────────────────┘  └────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                      DATA LAYER                                 │
│                    (PostgreSQL)                                 │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  users   │  │companies │  │   people    │  │ scraping  │  │
│  │          │  │          │  │             │  │   jobs    │  │
│  └──────────┘  └──────────┘  └─────────────┘  └───────────┘  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   user   │  │   file   │  │enrichment   │  │  audit    │  │
│  │sessions  │  │ uploads  │  │    logs     │  │   logs    │  │
│  └──────────┘  └──────────┘  └─────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Flow 1: Database Query Flow

```
User Query: "Show me all tech companies in SF"
    │
    ├─→ [Intent Recognition Agent]
    │       │ Query Type: database
    │       │ Entities: {industry: "tech", location: "SF"}
    │
    ├─→ [Router Agent]
    │       │ Route to: Database Query Agent
    │
    ├─→ [Database Query Agent]
    │       │ Build SQL: SELECT * FROM companies
    │       │            WHERE industry LIKE '%tech%'
    │       │            AND location LIKE '%SF%'
    │       │ Execute Query
    │
    ├─→ [Response Formatter Agent]
    │       │ Format results as table
    │       │ Generate NL response: "Found 47 tech companies in SF"
    │
    └─→ Return to User
```

### Flow 2: Scraping Request Flow

```
User Query: "Scrape companies from https://example.com/companies"
    │
    ├─→ [Intent Recognition Agent]
    │       │ Query Type: scraping
    │       │ URL: https://example.com/companies
    │
    ├─→ [Scraper Controller Agent]
    │       │ Create scraping job
    │       │ Trigger Analysis Agent
    │
    ├─→ [Analysis Agent]
    │       │ Load page with Puppeteer
    │       │ Analyze HTML structure
    │       │ Detect: Static HTML site
    │       │ Strategy: CSS Selector
    │       │ Selectors: ['.company-name', '.company-industry']
    │
    ├─→ [Implementation Agent]
    │       │ Execute CSS selector scraping
    │       │ Extract 150 companies
    │       │ Structure data
    │
    ├─→ [Validation Agent]
    │       │ Check: Expected ~150 records ✓
    │       │ Check: Required fields present ✓
    │       │ Check: Email format valid ✓
    │       │ Check: Logical consistency ✓
    │       │ Result: PASS (100% confidence)
    │
    ├─→ [Database Update]
    │       │ Deduplicate (found 20 existing)
    │       │ Insert 130 new companies
    │       │ Update scraping job status: completed
    │
    └─→ Return to User: "Successfully scraped 150 companies,
                         added 130 new records"
```

### Flow 3: Entity Lookup with Online Search

```
User Query: "Tell me about Elon Musk"
    │
    ├─→ [Intent Recognition Agent]
    │       │ Query Type: entity_lookup
    │       │ Entity: Person "Elon Musk"
    │
    ├─→ [Database Query Agent]
    │       │ Search people table for "Elon Musk"
    │       │ Result: Not found
    │
    ├─→ [Online Search Agent]
    │       │ Search web for "Elon Musk"
    │       │ Find LinkedIn profile
    │       │ Extract data:
    │       │   - Name: Elon Musk
    │       │   - Title: CEO
    │       │   - Company: Tesla, SpaceX
    │       │   - LinkedIn: linkedin.com/in/elonmusk
    │       │ Validate data: 100% confidence
    │
    ├─→ [Database Insert]
    │       │ Create/update person record
    │       │ Link to companies (create if needed)
    │       │ Log enrichment source
    │
    ├─→ [Response Formatter Agent]
    │       │ Format person data
    │       │ Generate response with details
    │
    └─→ Return to User: "Elon Musk is CEO of Tesla and SpaceX..."
                         [Display in table format]
```

### Flow 4: Excel File Upload Flow

```
User Action: Upload Excel file "contacts.xlsx"
    │
    ├─→ [File Processor Agent]
    │       │ Detect file type: Excel
    │       │ Parse Excel file
    │       │ Extract headers: ["Full Name", "Email Address", "Company"]
    │       │ Extract 500 rows
    │
    ├─→ [Column Mapping with Gemini]
    │       │ Analyze headers
    │       │ Map: "Full Name" → split to first_name + last_name
    │       │      "Email Address" → email
    │       │      "Company" → lookup/create company_id
    │
    ├─→ [Row Processing]
    │       │ For each row:
    │       │   1. Validate data
    │       │   2. Check for duplicates
    │       │   3. Lookup/create company
    │       │   4. Insert/update person
    │       │ Progress: 500/500 processed
    │       │ Results:
    │       │   - 450 new records
    │       │   - 50 duplicates (updated)
    │
    └─→ Return to User: "Processed 500 records successfully
                         Added: 450, Updated: 50"
```

### Flow 5: HAR File Upload Flow

```
User Action: Upload HAR file "capture.har"
    │
    ├─→ [File Processor Agent]
    │       │ Detect file type: HAR
    │       │ Parse HAR JSON
    │       │ Find 15 HTTP entries
    │
    ├─→ [HAR Data Extraction]
    │       │ Filter API calls with JSON responses
    │       │ Found 3 relevant API calls
    │       │ Extract data from responses
    │       │ Parsed 200 company records
    │
    ├─→ [Validation Agent]
    │       │ Validate extracted data
    │       │ Check data structure
    │       │ Validate field formats
    │       │ Result: PASS
    │
    ├─→ [Database Update]
    │       │ Deduplicate
    │       │ Insert new records
    │
    └─→ Return to User: "Extracted 200 companies from HAR file"
```

## Component Architecture

### Frontend Component Hierarchy

```
App (Next.js)
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── UserMenu
│   │   └── ThemeToggle
│   ├── Main Content Area
│   │   ├── SearchBar
│   │   │   ├── Input
│   │   │   ├── FileUpload
│   │   │   └── Suggestions
│   │   ├── DataTable
│   │   │   ├── TableHeader
│   │   │   ├── TableBody
│   │   │   ├── TableRow
│   │   │   └── Pagination
│   │   └── AgentPanel (optional)
│   │       ├── AgentStatus
│   │       ├── ProgressBar
│   │       └── ActivityLog
│   └── Footer
└── Pages
    ├── Login
    ├── Register
    ├── Dashboard
    ├── Companies
    ├── People
    └── Settings
```

### Backend Service Architecture

```
Express App
├── Middleware Layer
│   ├── AuthenticationMiddleware
│   ├── AuthorizationMiddleware
│   ├── ValidationMiddleware
│   ├── RateLimitMiddleware
│   ├── ErrorHandlerMiddleware
│   └── LoggingMiddleware
├── Route Layer
│   ├── AuthRoutes
│   ├── QueryRoutes
│   ├── CompanyRoutes
│   ├── PeopleRoutes
│   └── ScrapingRoutes
├── Controller Layer
│   ├── AuthController
│   ├── QueryController
│   ├── CompanyController
│   ├── PeopleController
│   └── ScrapingController
├── Service Layer
│   ├── AuthService
│   ├── QueryService
│   ├── CompanyService
│   ├── PeopleService
│   ├── ScrapingService
│   ├── FileProcessingService
│   └── EnrichmentService
├── Agent Layer
│   ├── AgentOrchestrator
│   ├── IntentRecognitionAgent
│   ├── ContextManagementAgent
│   ├── RouterAgent
│   ├── DatabaseQueryAgent
│   ├── ScraperControllerAgent
│   ├── FileProcessorAgent
│   ├── OnlineSearchAgent
│   ├── ResponseFormatterAgent
│   ├── AnalysisAgent
│   ├── ImplementationAgent
│   └── ValidationAgent
└── Repository Layer
    ├── UserRepository
    ├── CompanyRepository
    ├── PersonRepository
    ├── ScrapingJobRepository
    └── SessionRepository
```

## Technology Integration Points

### Gemini API Integration

```typescript
// Centralized Gemini client
class GeminiClient {
  private model: GenerativeModel;

  async generateText(prompt: string): Promise<string>;
  async generateStructured<T>(prompt: string, schema: Schema): Promise<T>;
  async analyzeImage(image: Buffer, prompt: string): Promise<string>;
  async streamResponse(prompt: string): AsyncGenerator<string>;
}

// Usage by agents
class IntentRecognitionAgent {
  constructor(private gemini: GeminiClient) {}

  async analyze(query: string): Promise<QueryIntent> {
    const prompt = buildIntentPrompt(query);
    return await this.gemini.generateStructured(prompt, intentSchema);
  }
}
```

### LangGraph State Management

```typescript
// Define agent state
interface AgentState {
  userId: string;
  query: string;
  intent: QueryIntent;
  context: ConversationContext;
  executionPlan: ExecutionPlan;
  intermediateResults: Map<string, any>;
  finalResult: any;
  errors: Error[];
}

// Define agent graph
const agentGraph = new StateGraph<AgentState>()
  .addNode("intent_recognition", intentRecognitionAgent)
  .addNode("context_management", contextManagementAgent)
  .addNode("router", routerAgent)
  .addNode("database_query", databaseQueryAgent)
  .addNode("scraper_controller", scraperControllerAgent)
  .addNode("response_formatter", responseFormatterAgent)
  .addEdge("intent_recognition", "context_management")
  .addEdge("context_management", "router")
  .addConditionalEdges("router", routingDecision)
  .addEdge("database_query", "response_formatter")
  .addEdge("scraper_controller", "response_formatter");
```

### Database Connection Management

```typescript
// Connection pool
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Repository base class
class BaseRepository<T> {
  protected async query<R>(sql: string, params?: any[]): Promise<R[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                           │
│                         (DNS + DDoS Protection)             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Vercel / Netlify                         │
│                   (Frontend Hosting)                        │
│                                                             │
│   ┌──────────────────────────────────────────────────┐    │
│   │  Next.js Application (Static + SSR)              │    │
│   │  • CDN-cached static assets                      │    │
│   │  • Edge functions for API routes                 │    │
│   └──────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────┴────────────────────────────────────┐
│            AWS Application Load Balancer                    │
│                  (SSL Termination)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  AWS ECS / Fargate                          │
│                  (Backend Containers)                       │
│                                                             │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
│   │   Express     │  │   Express     │  │   Express     │ │
│   │   Instance 1  │  │   Instance 2  │  │   Instance 3  │ │
│   └───────────────┘  └───────────────┘  └───────────────┘ │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────┴────────┐  ┌────┴──────────┐  ┌─┴──────────────┐
│  AWS RDS       │  │  Gemini API   │  │  Web Search    │
│  (PostgreSQL)  │  │               │  │  API           │
│                │  │               │  │                │
│  • Primary     │  └───────────────┘  └────────────────┘
│  • Read Replica│
└────────────────┘
```

## Security Architecture

### Request Flow with Security Layers

```
Client Request
    │
    ├─→ [Layer 1: HTTPS/TLS]
    │       │ Encrypt transport
    │
    ├─→ [Layer 2: Rate Limiting]
    │       │ Check request rate
    │       │ Block if exceeded
    │
    ├─→ [Layer 3: CORS]
    │       │ Verify origin
    │       │ Block unauthorized origins
    │
    ├─→ [Layer 4: Authentication]
    │       │ Verify JWT token
    │       │ Check token expiry
    │       │ Validate signature
    │
    ├─→ [Layer 5: Authorization]
    │       │ Check user role
    │       │ Verify permissions
    │       │ Check resource access
    │
    ├─→ [Layer 6: Input Validation]
    │       │ Validate schema
    │       │ Sanitize inputs
    │       │ Check constraints
    │
    ├─→ [Layer 7: Business Logic]
    │       │ Execute request
    │       │ Apply business rules
    │
    └─→ Response (encrypted via HTTPS)
```

This architecture ensures scalability, security, and maintainability while providing the flexibility needed for the AI-powered features of the Sales Intelligence Platform.
