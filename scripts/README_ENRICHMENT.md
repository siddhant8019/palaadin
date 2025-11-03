# Comprehensive Data Enrichment Script

## Purpose

This script enriches your sales intelligence data by:

- Finding ALL key personnel for companies (founders, HR, talent acquisition, executives)
- Scraping company websites for team information
- Using Apollo.io API for professional data
- Using Hunter.io API for email finding
- Capturing **100% of all available data fields** in the output
- Generating comprehensive CSVs ready for import into the Sales Intelligence Platform

## Features

### Data Sources

1. **Company Website Scraping**

   - Team pages, about pages, leadership pages
   - Extracts: names, titles, emails, phone, LinkedIn, bios
   - JSON-LD structured data extraction

2. **Apollo.io API** (if API key provided)

   - Professional contact data
   - Captures ALL Apollo fields: 25+ data points per person
   - Organization details, seniority, departments, etc.

3. **Hunter.io API** (if API key provided)

   - Domain-based email finding
   - Email verification status
   - Confidence scores

4. **Google Search**
   - Founder and CEO discovery
   - Press release extraction

### Data Captured

**For Each Person (ALL fields preserved):**

- person_name, person_first_name, person_last_name
- person_email, person_phone
- person_title, person_linkedin
- person_bio
- apollo_id, apollo_photo_url, apollo_headline
- apollo_city, apollo_state, apollo_country
- apollo_seniority, apollo_departments, apollo_functions
- apollo_email_status, apollo_phone_status
- apollo*organization*\* (all organization fields)
- hunter_type, hunter_confidence, hunter_verification_status
- company_name, company_funding, company_round, company_investor
- data_source, enriched_at, scraped_from_url
- **Plus ALL original CSV columns**

**For Each Company:**

- All original fields from input CSV
- website, domain, company_linkedin
- company_description_meta
- og\_\* (all Open Graph fields)
- about_section_text
- website_title

## Installation

```bash
cd palAADIN/scripts
pip install pandas requests beautifulsoup4 python-dotenv
```

## Usage

### Mode 1: Find People for Companies

```bash
# Basic usage (no API keys)
python comprehensive_data_enricher.py \
  --input ../../ChiefAI/ai_companies_funding_data.csv \
  --mode find_people

# With Apollo.io API
python comprehensive_data_enricher.py \
  --input ../../ChiefAI/ai_companies_funding_data.csv \
  --mode find_people \
  --apollo-key YOUR_APOLLO_API_KEY

# With both Apollo and Hunter
python comprehensive_data_enricher.py \
  --input ../../ChiefAI/ai_companies_funding_data.csv \
  --mode find_people \
  --apollo-key YOUR_APOLLO_API_KEY \
  --hunter-key YOUR_HUNTER_API_KEY \
  --output enriched_personnel.csv
```

### Mode 2: Enrich Existing Companies

```bash
# Enrich company data (add websites, LinkedIn, descriptions)
python comprehensive_data_enricher.py \
  --input ../../Data/46_companies_data.csv \
  --mode companies \
  --output enriched_companies.csv
```

## Environment Variables

Create a `.env` file in `palAADIN/scripts/`:

```bash
APOLLO_API_KEY=your_apollo_api_key_here
HUNTER_API_KEY=your_hunter_api_key_here
```

Then use:

```bash
python comprehensive_data_enricher.py --input data.csv --mode find_people
```

## Input CSV Format

### For Finding People

Your CSV should have company information:

```csv
company_name,description,funding_amount,funding_round,lead_investor,website,linkedin_url
Liberate,AI automation platform,$50M,Series B,Battery Ventures,https://liberate.ai,https://linkedin.com/company/liberate
```

**All columns are preserved in the output!**

### For Enriching Companies

Any CSV with company names:

```csv
firm_name,industry,location
Robert Half,Staffing,San Francisco
Hays,Recruiting,London
```

## Output Format

### People CSV Output

```csv
person_name,person_email,person_title,person_linkedin,person_phone,
company_name,company_funding,company_round,company_investor,
apollo_id,apollo_headline,apollo_city,apollo_seniority,
hunter_confidence,hunter_verification_status,
data_source,enriched_at,scraped_from_url,
[...ALL other original fields...]
```

**Every single field from every source is included!**

## Integration with Sales Intelligence Platform

### Import the enriched data:

1. **Via Web UI:**

   ```
   - Go to http://localhost:3000/files
   - Upload the enriched CSV
   - Platform will automatically map columns and store ALL data in metadata
   ```

2. **Via API:**

   ```bash
   curl -X POST http://localhost:4000/api/files/single \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@enriched_personnel.csv"
   ```

3. **View the data:**
   - All standard fields → Direct display
   - All Apollo/Hunter/scraped fields → Shown in "Additional Data" section
   - Click any row to see COMPLETE data

## Examples

### Example 1: Enrich ChiefAI Companies with Personnel

```bash
python comprehensive_data_enricher.py \
  --input ../../ChiefAI/chiefai_funding_oct2025_20251015_144509.json \
  --mode find_people \
  --apollo-key $APOLLO_KEY \
  --output chiefai_complete_personnel.csv
```

**Result:** CSV with ALL people (founders, HR, executives) + ALL Apollo data + ALL original company data

### Example 2: Enrich 46 Companies Dataset

```bash
python comprehensive_data_enricher.py \
  --input ../../Data/46_companies_data.csv \
  --mode companies \
  --output 46_companies_enriched.csv
```

**Result:** Original data + websites + LinkedIn URLs + descriptions + Open Graph data

### Example 3: Find People for StartX Portfolio

```bash
# First scrape StartX companies if needed
# Then find all personnel
python comprehensive_data_enricher.py \
  --input startx_companies.csv \
  --mode find_people \
  --apollo-key $APOLLO_KEY \
  --hunter-key $HUNTER_KEY
```

## Output Statistics

The script prints comprehensive statistics:

```
======================================================================
COMPREHENSIVE DATA ENRICHMENT SUMMARY
======================================================================
Total records: 847
Total columns: 45
Output file: enriched_personnel.csv

----------------------------------------------------------------------
STATISTICS:
----------------------------------------------------------------------
Companies processed: 95
People found: 847
Apollo enriched: 652
Website scraped: 127
LinkedIn found: 68
Emails found: 743

----------------------------------------------------------------------
ALL CAPTURED COLUMNS (45):
----------------------------------------------------------------------
  • apollo_city: 652/847 filled (77.0%)
  • apollo_country: 652/847 filled (77.0%)
  • apollo_departments: 652/847 filled (77.0%)
  • apollo_email_status: 652/847 filled (77.0%)
  • apollo_functions: 652/847 filled (77.0%)
  • apollo_headline: 645/847 filled (76.2%)
  • apollo_id: 652/847 filled (77.0%)
  • apollo_linkedin_url: 612/847 filled (72.3%)
  • apollo_organization_employees: 652/847 filled (77.0%)
  • apollo_organization_industry: 648/847 filled (76.5%)
  • apollo_organization_name: 652/847 filled (77.0%)
  • apollo_organization_website: 650/847 filled (76.8%)
  • apollo_phone_status: 652/847 filled (77.0%)
  • apollo_seniority: 652/847 filled (77.0%)
  • apollo_state: 620/847 filled (73.2%)
  • company_funding: 847/847 filled (100.0%)
  • company_investor: 847/847 filled (100.0%)
  • company_name: 847/847 filled (100.0%)
  • company_round: 847/847 filled (100.0%)
  • data_source: 847/847 filled (100.0%)
  • enriched_at: 847/847 filled (100.0%)
  • hunter_confidence: 95/847 filled (11.2%)
  • hunter_verification_status: 95/847 filled (11.2%)
  • person_email: 743/847 filled (87.7%)
  • person_first_name: 652/847 filled (77.0%)
  • person_last_name: 652/847 filled (77.0%)
  • person_linkedin: 612/847 filled (72.3%)
  • person_name: 847/847 filled (100.0%)
  • person_phone: 234/847 filled (27.6%)
  • person_title: 847/847 filled (100.0%)
  • scraped_from_url: 127/847 filled (15.0%)
  • [... and more ...]
```

## Advanced Usage

### Custom Target Roles

Edit the script to add more roles:

```python
self.target_roles = [
    'founder', 'ceo', 'cto',
    # Add your custom roles
    'vp of sales', 'head of growth', 'marketing director'
]
```

### Rate Limiting

Adjust delays in the script:

```python
time.sleep(0.5)  # Between companies
time.sleep(1)    # Between API calls
```

## API Keys

### Apollo.io

- Sign up: https://www.apollo.io
- Get API key from Settings → API
- 25+ data points per person
- 10,000 credits/month on paid plans

### Hunter.io

- Sign up: https://hunter.io
- Get API key from API → API Keys
- Email finding and verification
- 50 searches/month on free plan

## Troubleshoots

### No people found

- Check if website has a /team or /about page
- Try with Apollo API key for better results
- Verify company names are correct

### API rate limits

- Apollo: Adjust sleep times, upgrade plan
- Hunter: 50/month free, upgrade for more

### Missing fields

- All fields are preserved - check the JSON output
- Some companies may not have certain data available

## Next Steps

After enrichment:

1. **Upload to Platform**: Use the Files page to upload the enriched CSV
2. **View Complete Data**: Click any row to see ALL captured fields
3. **Export**: Use the platform's export feature for further analysis

## Support

For issues or enhancements, check the main platform documentation in `palAADIN/docs/`
