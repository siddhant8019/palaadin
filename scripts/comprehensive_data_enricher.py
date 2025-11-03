#!/usr/bin/env python3
"""
Comprehensive Data Enricher for Sales Intelligence Platform
============================================================
Enriches company and people data from multiple sources:
- Company websites (scraping team pages, about pages)
- LinkedIn profiles (company pages, employee lists)
- Apollo.io API integration
- Crunchbase data
- Hunter.io for email finding
- Google search results

Captures ALL available data fields and stores them for complete visibility.
"""

import pandas as pd
import requests
import time
import re
import json
from typing import List, Dict, Optional, Any
from urllib.parse import quote, urlparse
import logging
from datetime import datetime
import argparse
import os
from bs4 import BeautifulSoup
import random

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ComprehensiveDataEnricher:
    def __init__(
        self,
        input_file: str,
        output_file: str = None,
        apollo_api_key: str = None,
        hunter_api_key: str = None
    ):
        self.input_file = input_file
        self.output_file = output_file or f"enriched_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        self.apollo_api_key = apollo_api_key or os.getenv('APOLLO_API_KEY')
        self.hunter_api_key = hunter_api_key or os.getenv('HUNTER_API_KEY')
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        # Target roles to find
        self.target_roles = [
            'founder', 'ceo', 'co-founder', 'cto', 'coo', 'president',
            'chief executive officer', 'chief technology officer', 'chief operating officer',
            'hr director', 'head of hr', 'chief people officer', 'vp of people',
            'talent acquisition', 'head of talent', 'recruiting manager',
            'head of recruiting', 'people operations', 'hr manager',
            'chief human resources officer', 'director of talent',
            'vp of talent', 'head of people', 'people director',
            'chief talent officer', 'talent director', 'people lead',
            'vp of hr', 'director of hr', 'people ops', 'talent lead',
            'chro', 'vp human resources', 'director of people'
        ]
        
        self.stats = {
            'companies_processed': 0,
            'people_found': 0,
            'apollo_enriched': 0,
            'website_scraped': 0,
            'linkedin_found': 0,
            'emails_found': 0
        }
    
    def load_data(self) -> pd.DataFrame:
        """Load input data (companies or people)"""
        try:
            df = pd.read_csv(self.input_file)
            logger.info(f"Loaded {len(df)} records from {self.input_file}")
            logger.info(f"Columns: {', '.join(df.columns.tolist())}")
            return df
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return pd.DataFrame()
    
    def enrich_company(self, company_row: pd.Series) -> Dict[str, Any]:
        """Enrich a single company with ALL available data"""
        enriched_data = company_row.to_dict()  # Start with ALL original data
        
        company_name = self._get_field(company_row, ['company', 'company_name', 'name', 'firm_name', 'organization'])
        
        if not company_name:
            logger.warning("No company name found in row")
            return enriched_data
        
        logger.info(f"Enriching company: {company_name}")
        
        # 1. Find company website if not present
        if 'website' not in enriched_data or pd.isna(enriched_data.get('website')):
            website = self.find_company_website(company_name)
            if website:
                enriched_data['website'] = website
        
        # 2. Find LinkedIn URL if not present
        if 'company_linkedin' not in enriched_data or pd.isna(enriched_data.get('company_linkedin')):
            linkedin = self.find_company_linkedin(company_name)
            if linkedin:
                enriched_data['company_linkedin'] = linkedin
        
        # 3. Scrape company website for details
        if enriched_data.get('website'):
            website_data = self.scrape_company_website(enriched_data['website'], company_name)
            enriched_data.update(website_data)
        
        # 4. Scrape LinkedIn company page
        if enriched_data.get('company_linkedin'):
            linkedin_data = self.scrape_linkedin_company(enriched_data['company_linkedin'])
            enriched_data.update(linkedin_data)
        
        # 5. Get domain for email finding
        if enriched_data.get('website'):
            domain = self._extract_domain(enriched_data['website'])
            enriched_data['domain'] = domain
        
        self.stats['companies_processed'] += 1
        return enriched_data
    
    def find_personnel_for_company(self, company_row: pd.Series) -> List[Dict[str, Any]]:
        """Find ALL key personnel for a company"""
        personnel = []
        
        company_name = self._get_field(company_row, ['company', 'company_name', 'name'])
        website = self._get_field(company_row, ['website', 'company_website', 'domain'])
        linkedin_url = self._get_field(company_row, ['company_linkedin', 'linkedin_url'])
        
        if not company_name:
            return personnel
        
        logger.info(f"Finding personnel for: {company_name}")
        
        # Preserve ALL original company data for each person
        company_context = company_row.to_dict()
        
        # 1. Scrape company website team pages
        if website:
            website_people = self.scrape_team_page(website, company_name)
            for person in website_people:
                person.update(company_context)  # Add all company data
                person['data_source'] = 'website_scraping'
            personnel.extend(website_people)
            self.stats['website_scraped'] += len(website_people)
        
        # 2. Scrape LinkedIn company employees
        if linkedin_url:
            linkedin_people = self.scrape_linkedin_employees(linkedin_url, company_name)
            for person in linkedin_people:
                person.update(company_context)  # Add all company data
                person['data_source'] = 'linkedin_scraping'
            personnel.extend(linkedin_people)
            self.stats['linkedin_found'] += len(linkedin_people)
        
        # 3. Apollo.io enrichment (if API key provided)
        if self.apollo_api_key:
            apollo_people = self.apollo_find_people(company_name, website)
            for person in apollo_people:
                person.update(company_context)  # Add all company data
                person['data_source'] = 'apollo_api'
                person['apollo_enriched'] = True
            personnel.extend(apollo_people)
            self.stats['apollo_enriched'] += len(apollo_people)
        
        # 4. Hunter.io email finding (if API key provided)
        if self.hunter_api_key and website:
            domain = self._extract_domain(website)
            hunter_people = self.hunter_find_emails(domain, company_name)
            for person in hunter_people:
                person.update(company_context)  # Add all company data
                person['data_source'] = 'hunter_api'
            personnel.extend(hunter_people)
            self.stats['emails_found'] += len(hunter_people)
        
        # 5. Google search for founders and key people
        google_people = self.google_search_personnel(company_name)
        for person in google_people:
            person.update(company_context)  # Add all company data
            person['data_source'] = 'google_search'
        personnel.extend(google_people)
        
        # Deduplicate
        personnel = self._deduplicate_personnel(personnel)
        
        logger.info(f"Found {len(personnel)} personnel for {company_name}")
        self.stats['people_found'] += len(personnel)
        
        return personnel
    
    def scrape_team_page(self, website: str, company_name: str) -> List[Dict[str, Any]]:
        """Scrape company team/about pages for personnel"""
        personnel = []
        
        team_paths = [
            '/team', '/about', '/leadership', '/people', '/our-team',
            '/about-us', '/leadership-team', '/executive-team', '/management',
            '/company/team', '/company/leadership', '/staff', '/about/team'
        ]
        
        for path in team_paths:
            try:
                url = website.rstrip('/') + path
                response = self.session.get(url, timeout=10, allow_redirects=True)
                
                if response.status_code == 200:
                    people = self._parse_team_page(response.text, company_name, url)
                    personnel.extend(people)
                    
                    if people:  # Found team data, stop searching
                        logger.info(f"Found {len(people)} people on {url}")
                        break
                
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                logger.debug(f"Error accessing {url}: {e}")
                continue
        
        return personnel
    
    def _parse_team_page(self, html: str, company_name: str, source_url: str) -> List[Dict[str, Any]]:
        """Parse team page HTML and extract ALL person data"""
        people = []
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Strategy 1: Find team member cards/sections
            team_patterns = [
                soup.find_all('div', class_=re.compile(r'team|member|person|employee|staff', re.I)),
                soup.find_all('div', class_=re.compile(r'profile|bio|card', re.I)),
                soup.find_all('article', class_=re.compile(r'team|member', re.I)),
            ]
            
            for pattern in team_patterns:
                for element in pattern[:50]:  # Limit to avoid noise
                    person_data = self._extract_person_from_element(element, company_name, source_url)
                    if person_data:
                        people.append(person_data)
            
            # Strategy 2: Look for structured data (JSON-LD)
            json_ld_people = self._extract_from_json_ld(soup, company_name, source_url)
            people.extend(json_ld_people)
            
        except Exception as e:
            logger.error(f"Error parsing team page: {e}")
        
        return people
    
    def _extract_person_from_element(self, element: Any, company_name: str, source_url: str) -> Optional[Dict[str, Any]]:
        """Extract person data from HTML element with ALL available fields"""
        try:
            # Find name
            name = None
            name_tags = element.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b'])
            for tag in name_tags:
                text = tag.get_text().strip()
                if len(text) > 2 and len(text) < 100 and ' ' in text:
                    name = text
                    break
            
            if not name:
                return None
            
            # Find title/role
            title = None
            title_tags = element.find_all(['p', 'span', 'div'], class_=re.compile(r'title|role|position', re.I))
            for tag in title_tags:
                text = tag.get_text().strip()
                if self._is_target_role(text):
                    title = text
                    break
            
            # Find email
            email = None
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            email_matches = re.findall(email_pattern, element.get_text())
            if email_matches:
                email = email_matches[0]
            
            # Find LinkedIn
            linkedin_url = None
            linkedin_links = element.find_all('a', href=re.compile(r'linkedin\.com/in/', re.I))
            if linkedin_links:
                linkedin_url = linkedin_links[0].get('href')
            
            # Find phone
            phone = None
            phone_pattern = r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]'
            phone_matches = re.findall(phone_pattern, element.get_text())
            if phone_matches:
                phone = phone_matches[0].strip()
            
            # Find bio/description
            bio = None
            bio_tags = element.find_all(['p'], class_=re.compile(r'bio|desc|about', re.I))
            if bio_tags:
                bio = ' '.join([tag.get_text().strip() for tag in bio_tags[:3]])  # First 3 paragraphs
            
            # Extract ALL other available data
            person_data = {
                'person_name': name,
                'person_title': title or 'Team Member',
                'person_email': email,
                'person_phone': phone,
                'person_linkedin': linkedin_url,
                'person_bio': bio,
                'company_name': company_name,
                'scraped_from_url': source_url,
                'scraped_at': datetime.now().isoformat(),
            }
            
            # Only return if we have at least a title that matches target roles
            if title and self._is_target_role(title):
                return person_data
            
        except Exception as e:
            logger.debug(f"Error extracting person from element: {e}")
        
        return None
    
    def _extract_from_json_ld(self, soup: BeautifulSoup, company_name: str, source_url: str) -> List[Dict[str, Any]]:
        """Extract people from JSON-LD structured data"""
        people = []
        
        try:
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.string)
                    
                    # Look for Person or Employee types
                    if isinstance(data, dict):
                        if data.get('@type') == 'Person':
                            person = self._parse_json_ld_person(data, company_name, source_url)
                            if person:
                                people.append(person)
                        
                        # Check for employees array
                        if 'employee' in data:
                            employees = data['employee'] if isinstance(data['employee'], list) else [data['employee']]
                            for emp in employees:
                                person = self._parse_json_ld_person(emp, company_name, source_url)
                                if person:
                                    people.append(person)
                    
                except json.JSONDecodeError:
                    continue
        
        except Exception as e:
            logger.debug(f"Error extracting JSON-LD: {e}")
        
        return people
    
    def _parse_json_ld_person(self, data: Dict, company_name: str, source_url: str) -> Optional[Dict[str, Any]]:
        """Parse JSON-LD person data"""
        try:
            return {
                'person_name': data.get('name'),
                'person_title': data.get('jobTitle'),
                'person_email': data.get('email'),
                'person_phone': data.get('telephone'),
                'person_linkedin': data.get('sameAs'),
                'person_bio': data.get('description'),
                'company_name': company_name,
                'scraped_from_url': source_url,
                'scraped_at': datetime.now().isoformat(),
                'source_type': 'json_ld'
            }
        except:
            return None
    
    def apollo_find_people(self, company_name: str, website: str = None) -> List[Dict[str, Any]]:
        """Find people using Apollo.io API with ALL available fields"""
        people = []
        
        if not self.apollo_api_key:
            return people
        
        try:
            url = "https://api.apollo.io/v1/mixed_people/search"
            
            payload = {
                "api_key": self.apollo_api_key,
                "q_organization_name": company_name,
                "page": 1,
                "per_page": 100,
                "person_titles": self.target_roles
            }
            
            response = self.session.post(url, json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                for person in data.get('people', []):
                    # Capture ALL Apollo fields
                    person_data = {
                        'person_name': person.get('name'),
                        'person_first_name': person.get('first_name'),
                        'person_last_name': person.get('last_name'),
                        'person_title': person.get('title'),
                        'person_email': person.get('email'),
                        'person_phone': person.get('phone_numbers', [{}])[0].get('raw_number') if person.get('phone_numbers') else None,
                        'person_linkedin': person.get('linkedin_url'),
                        'company_name': company_name,
                        
                        # Apollo-specific fields (ALL captured)
                        'apollo_id': person.get('id'),
                        'apollo_photo_url': person.get('photo_url'),
                        'apollo_twitter_url': person.get('twitter_url'),
                        'apollo_github_url': person.get('github_url'),
                        'apollo_facebook_url': person.get('facebook_url'),
                        'apollo_headline': person.get('headline'),
                        'apollo_city': person.get('city'),
                        'apollo_state': person.get('state'),
                        'apollo_country': person.get('country'),
                        'apollo_seniority': person.get('seniority'),
                        'apollo_departments': json.dumps(person.get('departments', [])),
                        'apollo_subdepartments': json.dumps(person.get('subdepartments', [])),
                        'apollo_functions': json.dumps(person.get('functions', [])),
                        'apollo_email_status': person.get('email_status'),
                        'apollo_phone_status': person.get('phone_status'),
                        'apollo_organization_id': person.get('organization_id'),
                        'apollo_organization_name': person.get('organization', {}).get('name'),
                        'apollo_organization_website': person.get('organization', {}).get('website_url'),
                        'apollo_organization_linkedin': person.get('organization', {}).get('linkedin_url'),
                        'apollo_organization_employees': person.get('organization', {}).get('estimated_num_employees'),
                        'apollo_organization_industry': person.get('organization', {}).get('industry'),
                        'apollo_organization_keywords': json.dumps(person.get('organization', {}).get('keywords', [])),
                        
                        'data_source': 'apollo_api',
                        'enriched_at': datetime.now().isoformat()
                    }
                    
                    people.append(person_data)
                
                logger.info(f"Apollo found {len(people)} people for {company_name}")
            
            time.sleep(1)  # Apollo rate limiting
            
        except Exception as e:
            logger.error(f"Apollo API error for {company_name}: {e}")
        
        return people
    
    def hunter_find_emails(self, domain: str, company_name: str) -> List[Dict[str, Any]]:
        """Find emails using Hunter.io API"""
        people = []
        
        if not self.hunter_api_key:
            return people
        
        try:
            url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={self.hunter_api_key}"
            
            response = self.session.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                for email_data in data.get('data', {}).get('emails', []):
                    person_data = {
                        'person_name': f"{email_data.get('first_name', '')} {email_data.get('last_name', '')}".strip(),
                        'person_first_name': email_data.get('first_name'),
                        'person_last_name': email_data.get('last_name'),
                        'person_email': email_data.get('value'),
                        'person_title': email_data.get('position'),
                        'person_linkedin': email_data.get('linkedin'),
                        'person_twitter': email_data.get('twitter'),
                        'company_name': company_name,
                        
                        # Hunter-specific fields
                        'hunter_type': email_data.get('type'),
                        'hunter_confidence': email_data.get('confidence'),
                        'hunter_verification_status': email_data.get('verification', {}).get('status'),
                        'hunter_verification_date': email_data.get('verification', {}).get('date'),
                        'hunter_sources': json.dumps(email_data.get('sources', [])),
                        
                        'data_source': 'hunter_api',
                        'enriched_at': datetime.now().isoformat()
                    }
                    
                    people.append(person_data)
                
                logger.info(f"Hunter found {len(people)} emails for {domain}")
            
            time.sleep(1)  # Hunter rate limiting
            
        except Exception as e:
            logger.error(f"Hunter API error for {domain}: {e}")
        
        return people
    
    def scrape_linkedin_employees(self, company_linkedin_url: str, company_name: str) -> List[Dict[str, Any]]:
        """Scrape LinkedIn company page for employees (basic scraping)"""
        people = []
        
        try:
            # Note: LinkedIn requires authentication for employee lists
            # This is a placeholder for actual LinkedIn scraping
            # You would need to implement LinkedIn login or use LinkedIn API
            
            logger.info(f"LinkedIn scraping requires authentication for {company_name}")
            
            # Placeholder: Would extract employees if authenticated
            # people = self._authenticated_linkedin_scrape(company_linkedin_url)
            
        except Exception as e:
            logger.error(f"LinkedIn scraping error: {e}")
        
        return people
    
    def google_search_personnel(self, company_name: str) -> List[Dict[str, Any]]:
        """Search Google for company founders and key people"""
        people = []
        
        try:
            # Search for founders
            founder_query = f'"{company_name}" founder CEO'
            # Note: Would use Google Custom Search API or SerpAPI here
            # people = self._parse_google_results(founder_query, company_name)
            
            logger.debug(f"Google search for: {founder_query}")
            
        except Exception as e:
            logger.error(f"Google search error: {e}")
        
        return people
    
    def scrape_company_website(self, website: str, company_name: str) -> Dict[str, Any]:
        """Scrape company website for ALL available company details"""
        data = {}
        
        try:
            response = self.session.get(website, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract description from meta tags
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc:
                    data['company_description_meta'] = meta_desc.get('content', '')
                
                # Extract Open Graph data
                og_tags = soup.find_all('meta', attrs={'property': re.compile(r'^og:')})
                for tag in og_tags:
                    prop = tag.get('property', '').replace('og:', 'og_')
                    content = tag.get('content', '')
                    if content:
                        data[prop] = content
                
                # Extract title
                title_tag = soup.find('title')
                if title_tag:
                    data['website_title'] = title_tag.get_text().strip()
                
                # Extract from about section
                about_section = soup.find(['section', 'div'], class_=re.compile(r'about', re.I))
                if about_section:
                    data['about_section_text'] = about_section.get_text().strip()[:1000]
                
                logger.info(f"Scraped {len(data)} fields from {website}")
        
        except Exception as e:
            logger.error(f"Website scraping error for {website}: {e}")
        
        return data
    
    def scrape_linkedin_company(self, linkedin_url: str) -> Dict[str, Any]:
        """Scrape LinkedIn company page for details"""
        data = {}
        
        try:
            # Note: LinkedIn scraping requires authentication
            # This is a placeholder
            logger.debug(f"LinkedIn company scraping for: {linkedin_url}")
            
            # Would extract: employees count, industry, specialties, headquarters, etc.
            
        except Exception as e:
            logger.error(f"LinkedIn company scraping error: {e}")
        
        return data
    
    def find_company_website(self, company_name: str) -> Optional[str]:
        """Find company website using multiple strategies"""
        # Try common patterns first
        clean_name = company_name.lower().replace(' ', '').replace('&', 'and').replace('.', '')
        
        for pattern in ['{name}.com', '{name}.ai', '{name}.io', 'www.{name}.com']:
            domain = pattern.format(name=clean_name)
            try:
                response = self.session.head(f"https://{domain}", timeout=5)
                if response.status_code == 200:
                    logger.info(f"Found website: https://{domain}")
                    return f"https://{domain}"
            except:
                continue
        
        return None
    
    def find_company_linkedin(self, company_name: str) -> Optional[str]:
        """Find company LinkedIn URL"""
        try:
            clean_name = company_name.lower().replace(' ', '-').replace('&', 'and')
            potential_url = f"https://www.linkedin.com/company/{clean_name}"
            
            response = self.session.head(potential_url, timeout=5, allow_redirects=True)
            if response.status_code == 200:
                logger.info(f"Found LinkedIn: {potential_url}")
                return potential_url
        except:
            pass
        
        return None
    
    def _get_field(self, row: pd.Series, field_names: List[str]) -> Optional[str]:
        """Get field value from row using multiple possible column names"""
        for field in field_names:
            if field in row and pd.notna(row[field]) and str(row[field]).strip():
                return str(row[field]).strip()
        return None
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path
            return domain.replace('www.', '')
        except:
            return ''
    
    def _is_target_role(self, title: str) -> bool:
        """Check if title matches target roles"""
        if not title:
            return False
        
        title_lower = title.lower()
        return any(role.lower() in title_lower for role in self.target_roles)
    
    def _deduplicate_personnel(self, personnel: List[Dict]) -> List[Dict]:
        """Deduplicate personnel by email or name"""
        seen = set()
        deduplicated = []
        
        for person in personnel:
            # Create unique key
            email = person.get('person_email', '')
            name = person.get('person_name', '')
            key = email if email else name
            
            if key and key not in seen:
                seen.add(key)
                deduplicated.append(person)
        
        return deduplicated
    
    def process_all(self, mode: str = 'companies') -> None:
        """Process all records and enrich data"""
        df = self.load_data()
        
        if df.empty:
            logger.error("No data to process")
            return
        
        all_results = []
        
        if mode == 'companies':
            # Enrich companies
            for index, row in df.iterrows():
                logger.info(f"Processing company {index + 1}/{len(df)}")
                enriched = self.enrich_company(row)
                all_results.append(enriched)
                time.sleep(0.5)
        
        elif mode == 'find_people':
            # Find people for companies
            for idx, (index, row) in enumerate(df.iterrows()):
                logger.info(f"Finding people for company {idx + 1}/{len(df)}")
                people = self.find_personnel_for_company(row)
                all_results.extend(people)
                time.sleep(0.5)
        
        # Save results
        self.save_results(all_results)
    
    def save_results(self, results: List[Dict[str, Any]]) -> None:
        """Save enriched data to CSV with ALL fields preserved"""
        try:
            df = pd.DataFrame(results)
            
            # Save to CSV
            df.to_csv(self.output_file, index=False)
            logger.info(f"Saved {len(results)} records to {self.output_file}")
            
            # Save to JSON as well (preserves complex data better)
            json_file = self.output_file.replace('.csv', '.json')
            df.to_json(json_file, orient='records', indent=2)
            logger.info(f"Also saved to {json_file}")
            
            # Print summary
            self.print_summary(df)
            
        except Exception as e:
            logger.error(f"Error saving results: {e}")
    
    def print_summary(self, df: pd.DataFrame) -> None:
        """Print comprehensive summary"""
        print(f"\n{'='*70}")
        print(f"COMPREHENSIVE DATA ENRICHMENT SUMMARY")
        print(f"{'='*70}")
        print(f"Total records: {len(df)}")
        print(f"Total columns: {len(df.columns)}")
        print(f"Output file: {self.output_file}")
        print(f"\n{'-'*70}")
        print(f"STATISTICS:")
        print(f"{'-'*70}")
        print(f"Companies processed: {self.stats['companies_processed']}")
        print(f"People found: {self.stats['people_found']}")
        print(f"Apollo enriched: {self.stats['apollo_enriched']}")
        print(f"Website scraped: {self.stats['website_scraped']}")
        print(f"LinkedIn found: {self.stats['linkedin_found']}")
        print(f"Emails found: {self.stats['emails_found']}")
        
        print(f"\n{'-'*70}")
        print(f"ALL CAPTURED COLUMNS ({len(df.columns)}):")
        print(f"{'-'*70}")
        for col in sorted(df.columns):
            non_null = df[col].notna().sum()
            print(f"  • {col}: {non_null}/{len(df)} filled ({non_null/len(df)*100:.1f}%)")
        
        print(f"\n{'='*70}\n")

def main():
    parser = argparse.ArgumentParser(
        description='Comprehensive Data Enricher for Sales Intelligence Platform'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Input CSV file (companies or existing people data)'
    )
    parser.add_argument(
        '--output',
        help='Output CSV file (default: enriched_data_TIMESTAMP.csv)'
    )
    parser.add_argument(
        '--mode',
        choices=['companies', 'find_people'],
        default='find_people',
        help='Mode: enrich companies OR find people for companies'
    )
    parser.add_argument(
        '--apollo-key',
        help='Apollo.io API key'
    )
    parser.add_argument(
        '--hunter-key',
        help='Hunter.io API key'
    )
    
    args = parser.parse_args()
    
    enricher = ComprehensiveDataEnricher(
        input_file=args.input,
        output_file=args.output,
        apollo_api_key=args.apollo_key,
        hunter_api_key=args.hunter_key
    )
    
    enricher.process_all(mode=args.mode)

if __name__ == "__main__":
    main()

