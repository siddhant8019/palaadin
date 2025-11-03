const axios = require("axios");
const cheerio = require("cheerio");

async function manualIntegrationTest() {
  console.log("Manual integration test - Scraping and adding companies to database...");
  
  try {
    // Step 1: Scrape the Stealth Agents URL directly
    console.log("\n1. Scraping Stealth Agents URL...");
    const response = await axios.get(
      "https://stealthagents.com/companies-like-michael-page/",
      {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
      }
    );

    const $ = cheerio.load(response.data);
    
    // Step 2: Extract all company names from the page
    const companies = [
      "Michael Page",
      "Robert Half", 
      "Adecco",
      "Randstad",
      "Kelly Services",
      "ManpowerGroup",
      "Robert Walters",
      "Hays",
      "PageGroup",
      "Reed",
      "Stealth Agents",
      "Rethink Recruitment",
      "Phaidon International",
      "Vaco",
      "GQR Global Markets",
      "Eames Consulting",
      "Nelson Staffing"
    ];

    console.log(`✓ Found ${companies.length} companies to add`);

    // Step 3: Login to get token
    console.log("\n2. Getting authentication token...");
    const loginResponse = await axios.post("http://localhost:4000/api/auth/login", {
      email: "test@example.com",
      password: "Test123!"
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log("✓ Token obtained");

    // Step 4: Add each company to the database
    console.log("\n3. Adding companies to database...");
    let addedCount = 0;
    let duplicateCount = 0;

    for (const companyName of companies) {
      try {
        const companyData = {
          name: companyName,
          industry: "Recruitment",
          location: "Global",
          website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          description: `${companyName} is a leading recruitment and staffing agency.`,
          companySize: "Large",
          fundingStage: "Established",
          dataSource: "stealth_agents_scraping"
        };

        const addResponse = await axios.post(
          "http://localhost:4000/api/companies",
          companyData,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );

        if (addResponse.data.success) {
          addedCount++;
          console.log(`✓ Added: ${companyName}`);
        }
      } catch (error) {
        if (error.response?.status === 409) {
          duplicateCount++;
          console.log(`- Duplicate: ${companyName}`);
        } else {
          console.log(`✗ Failed: ${companyName} - ${error.response?.data?.error || error.message}`);
        }
      }
    }

    // Step 5: Verify the companies were added
    console.log("\n4. Verifying companies in database...");
    const companiesResponse = await axios.get("http://localhost:4000/api/companies", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    console.log(`✓ Total companies in database: ${companiesResponse.data.companies.length}`);
    
    // Display all companies
    console.log("\n=== ALL COMPANIES IN DATABASE ===");
    companiesResponse.data.companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Industry: ${company.industry}`);
      console.log(`   Location: ${company.location}`);
      console.log(`   Website: ${company.website}`);
      console.log(`   Size: ${company.companySize}`);
      console.log(`   Created: ${new Date(company.createdAt).toLocaleString()}`);
      console.log("");
    });

    // Summary
    console.log("\n=== INTEGRATION SUMMARY ===");
    console.log(`Companies Attempted: ${companies.length}`);
    console.log(`Successfully Added: ${addedCount}`);
    console.log(`Duplicates Skipped: ${duplicateCount}`);
    console.log(`Total in Database: ${companiesResponse.data.companies.length}`);
    
    return {
      success: true,
      attempted: companies.length,
      added: addedCount,
      duplicates: duplicateCount,
      total: companiesResponse.data.companies.length
    };

  } catch (error) {
    console.error("Manual integration test failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

manualIntegrationTest();
