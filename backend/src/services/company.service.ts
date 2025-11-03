import { CompanyRepository, ICompanyFilter, IPaginationOptions } from "@/database/repositories/company.repository";
import { Company } from "@/database/models";
import { logger } from "@/utils/logger";

export class CompanyService {
  constructor(
    private companyRepository: CompanyRepository = new CompanyRepository()
  ) {}

  async getCompanyById(id: string): Promise<Company> {
    return await this.companyRepository.findById(id);
  }

  async searchCompanies(
    filters: ICompanyFilter,
    options: IPaginationOptions
  ): Promise<{ companies: Company[]; total: number; page: number; totalPages: number }> {
    const { companies, total } = await this.companyRepository.search(
      filters,
      options
    );

    const page = options.page || 1;
    const limit = options.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      companies,
      total,
      page,
      totalPages,
    };
  }

  async createCompany(data: Partial<Company>): Promise<Company> {
    const company = await this.companyRepository.createCompany(data);

    logger.info("Company created", {
      companyId: company.id,
      name: company.name,
    });

    return company;
  }

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const company = await this.companyRepository.updateCompany(id, data);

    logger.info("Company updated", {
      companyId: company.id,
      name: company.name,
    });

    return company;
  }

  async deleteCompany(id: string): Promise<void> {
    await this.companyRepository.deleteCompany(id);

    logger.info("Company deleted", {
      companyId: id,
    });
  }

  async getCompanyWithPeople(id: string): Promise<Company> {
    return await this.companyRepository.getCompanyWithPeople(id);
  }

  async getAllCompanies(
    options: IPaginationOptions
  ): Promise<{ companies: Company[]; total: number; page: number; totalPages: number }> {
    return await this.searchCompanies({}, options);
  }
}

