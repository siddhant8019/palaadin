const axios = require('axios');
const cheerio = require('cheerio');

async function testScraping() {
    console.log('Testing scraping system with Stealth Agents URL...');
    
    try {
        // Test basic scraping with axios and cheerio
        const response = await axios.get('https://stealthagents.com/companies-like-michael-page/', {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Extract key information
        const title = $('title').text();
        const h1 = $('h1').text();
        const companyNames = [];
        
        // Extract company names from the list
        $('h2, h3, strong').each((i, element) => {
            const text = $(element).text().trim();
            if (text.includes('Company') || text.includes('International') || text.includes('Group') || text.includes('Consulting')) {
                companyNames.push(text);
            }
        });

        // Extract specific company names from the content
        const companies = [
            'Michael Page',
            'Robert Half',
            'Adecco',
            'Randstad',
            'Kelly Services',
            'ManpowerGroup',
            'Robert Walters',
            'Hays',
            'PageGroup',
            'Reed'
        ];

        const foundCompanies = companies.filter(company => 
            response.data.toLowerCase().includes(company.toLowerCase())
        );

        console.log('\n=== SCRAPING RESULTS ===');
        console.log('Title:', title);
        console.log('H1:', h1);
        console.log('Companies Found:', foundCompanies.length);
        console.log('Company Names:', foundCompanies);
        
        // Extract key metrics mentioned in the content
        const metrics = {
            '714,000+ Hours Saved': response.data.includes('714,000+'),
            '$60M+ Generated': response.data.includes('$60M+'),
            '35+ Industries': response.data.includes('35+'),
            '1,200+ Skilled Agents': response.data.includes('1,200+')
        };

        console.log('\n=== KEY METRICS FOUND ===');
        Object.entries(metrics).forEach(([metric, found]) => {
            console.log(`${metric}: ${found ? '✓' : '✗'}`);
        });

        // Extract contact information
        const contactInfo = {
            'Phone': response.data.includes('(888) 693-1045'),
            'Email': response.data.includes('support@stealthagents.com'),
            'Address': response.data.includes('Cherry Hill, New Jersey')
        };

        console.log('\n=== CONTACT INFORMATION ===');
        Object.entries(contactInfo).forEach(([info, found]) => {
            console.log(`${info}: ${found ? '✓' : '✗'}`);
        });

        // Calculate accuracy
        const totalChecks = Object.values(metrics).length + Object.values(contactInfo).length + foundCompanies.length;
        const successfulChecks = Object.values(metrics).filter(Boolean).length + 
                                Object.values(contactInfo).filter(Boolean).length + 
                                foundCompanies.length;
        
        const accuracy = (successfulChecks / totalChecks) * 100;

        console.log('\n=== SCRAPING ACCURACY ===');
        console.log(`Success Rate: ${accuracy.toFixed(1)}%`);
        console.log(`Total Data Points: ${totalChecks}`);
        console.log(`Successfully Extracted: ${successfulChecks}`);

        return {
            success: true,
            accuracy: accuracy,
            data: {
                title,
                companies: foundCompanies,
                metrics,
                contactInfo
            }
        };

    } catch (error) {
        console.error('Scraping failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

testScraping();
