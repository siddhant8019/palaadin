import { Company } from "@/database/models/Company.model";

/**
 * Company factory for creating test companies
 */
export const companyFactory = {
  build: (overrides?: Partial<Company>): Company => {
    const company = new Company();
    const timestamp = Date.now();
    
    company.id = overrides?.id || `test-company-${timestamp}-${Math.random()}`;
    company.name = overrides?.name || `Test Company ${timestamp}`;
    company.domain = overrides?.domain || `testcompany${timestamp}.com`;
    company.industry = overrides?.industry || "Technology";
    company.companySize = overrides?.companySize || "50-100";
    company.location = overrides?.location || "San Francisco, CA";
    company.city = overrides?.city || "San Francisco";
    company.state = overrides?.state || "CA";
    company.country = overrides?.country || "United States";
    company.linkedinUrl = overrides?.linkedinUrl || `https://linkedin.com/company/test${timestamp}`;
    company.website = overrides?.website || `https://testcompany${timestamp}.com`;
    company.description = overrides?.description || "A test company";
    company.foundedYear = overrides?.foundedYear || 2020;
    company.fundingStage = overrides?.fundingStage || "Series A";
    company.dataSource = overrides?.dataSource || "test";
    company.metadata = overrides?.metadata || {};
    company.isDeleted = overrides?.isDeleted ?? false;
    company.createdAt = overrides?.createdAt || new Date();
    company.updatedAt = overrides?.updatedAt || new Date();
    
    return company;
  },

  createBatch: (count: number, overrides?: Partial<Company>): Company[] => {
    const companies: Company[] = [];
    for (let i = 0; i < count; i++) {
      companies.push(companyFactory.build({
        ...overrides,
        name: `Test Company ${Date.now()}-${i}`,
        domain: `testcompany${Date.now()}-${i}.com`,
      }));
    }
    return companies;
  },
};

