# Quick Start: Data Enrichment

## 🚀 Quick Setup

```bash
# 1. Install dependencies
cd palAADIN/scripts
pip install -r requirements.txt

# 2. Set up API keys (optional but recommended)
export APOLLO_API_KEY="your_apollo_key"
export HUNTER_API_KEY="your_hunter_key"
```

## 📝 Usage Examples

### Example 1: Find People for Companies (Most Common)

```bash
# Input: CSV with company names
# Output: CSV with ALL personnel + ALL data fields

python comprehensive_data_enricher.py \
  --input ../../ChiefAI/chief_Ai-15thoct.csv \
  --mode find_people \
  --output personnel_output.csv
```

**What it does:**

- Reads company list
- Finds founders, CEO, CTO, COO, HR directors
- Scrapes company websites for team data
- Calls Apollo API for professional data (if key provided)
- Finds emails using Hunter.io (if key provided)
- **Preserves ALL original CSV columns**
- **Adds 40+ new data fields**

### Example 2: Enrich Companies with Details

```bash
# Input: CSV with company names
# Output: CSV with websites, LinkedIn, descriptions

python comprehensive_data_enricher.py \
  --input ../../Data/46_companies_data.csv \
  --mode companies \
  --output enriched_companies.csv
```

**What it does:**

- Finds company website (if missing)
- Finds LinkedIn URL (if missing)
- Scrapes website for description
- Extracts Open Graph metadata
- **Preserves ALL original CSV columns**

### Example 3: Full Enrichment with All APIs

```bash
python comprehensive_data_enricher.py \
  --input ../../ChiefAI/chiefai_funding_oct2025_20251015_144509.json \
  --mode find_people \
  --apollo-key $APOLLO_API_KEY \
  --hunter-key $HUNTER_API_KEY \
  --output fully_enriched_personnel.csv
```

## 📊 What You Get

### Input CSV:

```csv
company_name,funding_amount,funding_round,lead_investor
Liberate,$50M,Series B,Battery Ventures
```

### Output CSV (100+ columns):

```csv
company_name,funding_amount,funding_round,lead_investor,
person_name,person_email,person_title,person_linkedin,person_phone,
apollo_id,apollo_headline,apollo_city,apollo_state,apollo_country,
apollo_seniority,apollo_departments,apollo_email_status,
apollo_organization_name,apollo_organization_employees,
apollo_organization_industry,apollo_organization_website,
hunter_confidence,hunter_verification_status,
person_bio,person_twitter,scraped_from_url,data_source,enriched_at,
[...ALL other fields...]
```

## 🎯 Integration Workflow

```
1. Run Script
   ↓
2. Get enriched CSV with ALL data
   ↓
3. Upload to Platform (http://localhost:3000/files)
   ↓
4. Platform stores ALL data:
   - Standard fields → Direct columns
   - Everything else → metadata JSONB
   ↓
5. View in Platform:
   - Click any row → See COMPLETE data
   - ALL Apollo fields visible
   - ALL custom fields visible
```

## 📋 Field Mapping Reference

### Automatically Detected Fields:

| Input Column                          | Maps To            | Also Stored In        |
| ------------------------------------- | ------------------ | --------------------- |
| company_name, firm_name               | company.name       | Standard              |
| person_name, name                     | person.fullName    | Standard              |
| email, apollo_email                   | person.email       | Standard              |
| title, position, apollo_current_title | person.title       | Standard              |
| linkedin_url, person_linkedin         | person.linkedinUrl | Standard              |
| phone, apollo_phone                   | person.phone       | Standard              |
| **All other fields**                  | metadata           | JSONB (fully visible) |

### Apollo Fields Captured (25+):

- apollo_id, apollo_photo_url, apollo_headline
- apollo_city, apollo_state, apollo_country
- apollo_seniority, apollo_departments, apollo_functions
- apollo_email_status, apollo_phone_status
- apollo*organization*\* (10+ org fields)
- apollo_twitter_url, apollo_github_url, apollo_facebook_url

### Hunter Fields Captured:

- hunter_type, hunter_confidence
- hunter_verification_status, hunter_verification_date
- hunter_sources (all sources where email was found)

### Website Scraping Fields:

- person_bio, scraped_from_url, scraped_at
- source_type (json_ld, html_parsing, etc.)

## 🔧 Customization

### Add More Target Roles

Edit line 35-44 in the script:

```python
self.target_roles = [
    'founder', 'ceo', 'cto',
    # Add your custom roles here:
    'vp of sales',
    'head of growth',
    'marketing director'
]
```

### Add More Data Sources

The script is modular - add new methods:

```python
def clearbit_enrich(self, company_name: str) -> Dict:
    # Your Clearbit enrichment logic
    pass

def zoominfo_find_people(self, company_name: str) -> List[Dict]:
    # Your ZoomInfo integration
    pass
```

## ⚡ Performance

- **Without API keys**: ~1-2 companies/minute (website scraping only)
- **With Apollo**: ~5-10 companies/minute (much faster, more data)
- **With Apollo + Hunter**: Maximum data coverage

## 💡 Pro Tips

1. **Use Apollo API** for best results (most comprehensive data)
2. **Run overnight** for large datasets (1000+ companies)
3. **Check output JSON** for complex nested data
4. **Upload to platform** immediately to see ALL data in UI
5. **Export from platform** for Excel analysis with all fields preserved

## 🎉 Result

After running and uploading to the platform:

- **Click any person** → See 40+ data fields
- **All Apollo data** → Fully visible in "Additional Data" section
- **All custom fields** → Preserved and displayed
- **Zero data loss** → 100% of enrichment captured

---

**The platform + this script = Complete sales intelligence solution with maximum data coverage!**
