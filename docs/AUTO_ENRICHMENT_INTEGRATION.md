# Auto-Enrichment Integration

## Overview

The Sales Intelligence Platform now **automatically enriches data** using the Python enrichment script whenever incomplete data is detected. This runs in the background without user intervention.

## How It Works

### Automatic Triggers

The Python enrichment script runs automatically when:

#### 1. **Web Scraping** (After scraping completes)

```
User scrapes URL → Companies extracted → Saved to DB → Auto-enrichment triggered
                                                              ↓
                                        Python script finds personnel & enriches
                                                              ↓
                                        People saved to DB with ALL metadata
```

**Triggers when:**

- Company has no website
- Company has no description
- Company has no LinkedIn URL

#### 2. **CSV/Excel Upload** (After file processing)

```
User uploads CSV → Companies created → Auto-enrichment triggered
                                              ↓
                        Python script scrapes company websites for team
                                              ↓
                        Personnel saved with complete data
```

**Triggers when:**

- Company created without personnel
- Company missing website or LinkedIn

#### 3. **HAR File Processing**

```
User uploads HAR → Data extracted → Auto-enrichment for missing fields
```

---

## Integration Architecture

### Backend Services Flow

```
WebScrapingService.scrapeURL()
  ↓
saveToDatabase(companies)
  ↓
autoEnrichCompany(company)  // Automatic enrichment
  ↓
PythonEnricherService.findPersonnelForCompany()
  ↓
Save personnel to DB with metadata
```

### Excel Processing Flow

```
ExcelProcessorService.processExcelFile()
  ↓
createCompany(companyData)
  ↓
autoEnrichCompanyInBackground(company)  // Non-blocking
  ↓
PythonEnricherService.findPersonnelForCompany()
  ↓
Save personnel to DB
```

---

## What Gets Enriched

### Company Enrichment

**Missing Data Filled:**

- Website (tries common patterns: company.com, company.ai, etc.)
- LinkedIn URL (tries: linkedin.com/company/company-name)
- Domain (extracted from website)
- Description (from meta tags, Open Graph, about section)

**Additional Data Captured:**

- og_title, og_description, og_image
- website_title
- about_section_text (first 1000 chars)
- company_description_meta

### Personnel Discovery

**Target Roles Found:**

- Founders, CEO, Co-Founders
- C-Suite: CTO, COO, CFO, CMO
- HR & People: CPO, Head of People, VP of People, HR Director
- Talent Acquisition: Head of Talent, TA Manager, Recruiting Director
- Operations: People Ops Manager, HR Business Partner

**Data Captured for Each Person:**

- person_name, person_first_name, person_last_name
- person_email, person_phone
- person_title, person_linkedin
- person_bio
- scraped_from_url, scraped_at
- source_type (website, json_ld, html_parsing)
- **ALL company context** (funding, round, investor, etc.)

---

## Configuration

### Enable/Disable Auto-Enrichment

The enrichment is **automatically disabled** if:

- Python script not found
- python3 not installed
- Script throws errors

### Check Status

```typescript
const enricher = new PythonEnricherService();
const isAvailable = await enricher.isAvailable();
// Returns: true if Python enrichment can run
```

---

## Data Flow Example

### Scenario: User Scrapes StartX Jobs Page

```
1. User: "Scrape https://jobs.startx.com/companies"
2. Platform scrapes → Finds 668 companies
3. Saves companies to DB (name, website only)
4. Auto-enrichment triggered (background)
5. For each company with website:
   - Python script visits company.com/team
   - Finds founders, CEO, HR director
   - Extracts: names, titles, emails, LinkedIn
   - Saves ALL data (standard + metadata)
6. Result: 668 companies + 2000+ personnel automatically found!
```

### Scenario: User Uploads CSV with Companies

```
1. User uploads: companies.csv (50 companies, no personnel)
2. Platform processes CSV → Creates 50 companies
3. Auto-enrichment triggered for each company
4. Python script:
   - Visits each company website
   - Scrapes /team, /about, /leadership pages
   - Extracts personnel with ALL fields
5. Result: 50 companies + 150+ personnel automatically added!
```

---

## Performance

### Background Processing

- Enrichment runs **asynchronously** (non-blocking)
- User gets immediate response
- Enrichment happens in background
- Check database after 1-2 minutes to see enriched data

### Rate Limiting

Built-in delays:

- 0.5 seconds between companies
- 0.5 seconds between team pages
- Respects website rate limits

### Scalability

- Processes 1-2 companies per minute (website scraping)
- Handles 100+ companies in ~2 hours
- Can be run in parallel for large datasets

---

## Benefits

- Zero manual work - everything automatic
- Complete data coverage - nothing missing
- Personnel automatically found - no separate process
- ALL data preserved - 100% visibility
- Non-blocking - doesn't slow down platform
- No Apollo needed - pure web scraping (for now)
- Extensible - can add Apollo/Hunter later

---

## Ready to Use

The integration is complete and ready! Just ensure:

```bash
# 1. Install Python dependencies
cd palAADIN/scripts
pip install -r requirements.txt

# 2. Verify Python available
python3 --version

# 3. Start platform
cd ..
docker-compose up -d

# 4. Use normally - enrichment happens automatically!
```

**Enrichment triggers automatically whenever data is incomplete!** 🚀
