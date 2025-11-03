const axios = require("axios");
const cheerio = require("cheerio");

// Test the scraping integration with the Stealth Agents URL
async function testScrapingIntegration() {
  console.log("Testing scraping integration with Stealth Agents URL...");
  
  try {
    // Step 1: Login to get a token
    console.log("\n1. Getting authentication token...");
    const loginResponse = await axios.post("http://localhost:4000/api/auth/login", {
      email: "test@example.com",
      password: "Test123!"
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log("✓ Token obtained successfully");
    
    // Step 2: Scrape and integrate the Stealth Agents URL
    console.log("\n2. Scraping and integrating Stealth Agents data...");
    const scrapingResponse = await axios.post(
      "http://localhost:4000/api/scraping/integrate",
      {
        url: "https://stealthagents.com/companies-like-michael-page/"
      },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✓ Scraping integration completed");
    console.log("Results:", scrapingResponse.data);
    
    // Step 3: Verify the data was added to the database
    console.log("\n3. Verifying data in database...");
    
    // Get companies
    const companiesResponse = await axios.get("http://localhost:4000/api/companies", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    console.log(`✓ Found ${companiesResponse.data.companies.length} companies in database`);
    
    // Display the companies
    console.log("\n=== COMPANIES IN DATABASE ===");
    companiesResponse.data.companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Industry: ${company.industry || 'N/A'}`);
      console.log(`   Location: ${company.location || 'N/A'}`);
      console.log(`   Website: ${company.website || 'N/A'}`);
      console.log(`   Created: ${company.createdAt}`);
      console.log("");
    });
    
    // Get people
    const peopleResponse = await axios.get("http://localhost:4000/api/people", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    console.log(`✓ Found ${peopleResponse.data.people.length} people in database`);
    
    // Display the people
    if (peopleResponse.data.people.length > 0) {
      console.log("\n=== PEOPLE IN DATABASE ===");
      peopleResponse.data.people.forEach((person, index) => {
        console.log(`${index + 1}. ${person.fullName}`);
        console.log(`   Title: ${person.title || 'N/A'}`);
        console.log(`   Company: ${person.company || 'N/A'}`);
        console.log(`   Email: ${person.email || 'N/A'}`);
        console.log(`   Created: ${person.createdAt}`);
        console.log("");
      });
    }
    
    // Summary
    console.log("\n=== INTEGRATION SUMMARY ===");
    console.log(`Companies Added: ${scrapingResponse.data.companiesAdded}`);
    console.log(`People Added: ${scrapingResponse.data.peopleAdded}`);
    console.log(`Duplicates Skipped: ${scrapingResponse.data.duplicatesSkipped}`);
    console.log(`Total Companies in DB: ${companiesResponse.data.companies.length}`);
    console.log(`Total People in DB: ${peopleResponse.data.people.length}`);
    
    if (scrapingResponse.data.errors && scrapingResponse.data.errors.length > 0) {
      console.log("\nErrors:", scrapingResponse.data.errors);
    }
    
    return {
      success: true,
      companiesAdded: scrapingResponse.data.companiesAdded,
      peopleAdded: scrapingResponse.data.peopleAdded,
      totalCompanies: companiesResponse.data.companies.length,
      totalPeople: peopleResponse.data.people.length
    };
    
  } catch (error) {
    console.error("Integration test failed:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

testScrapingIntegration();
