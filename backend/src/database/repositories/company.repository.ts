import { AppDataSource } from "@/config/database";
import { Company } from "@/database/models";
import { NotFoundError } from "@/utils/errors";
import { ILike } from "typeorm";

export interface ICompanyFilter {
  name?: string;
  industry?: string;
  industry_not?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  companySize?: string;
  fundingStage?: string;
  description?: string;
  website?: string;
  search?: string; // General search across multiple fields
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export class CompanyRepository {
  private repository = AppDataSource.getRepository(Company);

  async findById(id: string): Promise<Company> {
    const company = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ["people"],
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }

  async findByDomain(domain: string): Promise<Company | null> {
    return await this.repository.findOne({
      where: { domain, isDeleted: false },
    });
  }

  async findByLinkedIn(linkedinUrl: string): Promise<Company | null> {
    return await this.repository.findOne({
      where: { linkedinUrl, isDeleted: false },
    });
  }

  async findByName(name: string): Promise<Company | null> {
    return await this.repository.findOne({
      where: { name: ILike(name), isDeleted: false },
    });
  }

  async findDuplicate(data: {
    domain?: string;
    linkedinUrl?: string;
    name?: string;
  }): Promise<Company | null> {
    if (data.domain) {
      const byDomain = await this.findByDomain(data.domain);
      if (byDomain) return byDomain;
    }

    if (data.linkedinUrl) {
      const byLinkedIn = await this.findByLinkedIn(data.linkedinUrl);
      if (byLinkedIn) return byLinkedIn;
    }

    if (data.name) {
      const byName = await this.repository.findOne({
        where: { name: ILike(data.name), isDeleted: false },
      });
      if (byName) return byName;
    }

    return null;
  }

  async search(
    filters: ICompanyFilter,
    options: IPaginationOptions = {}
  ): Promise<{ companies: Company[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = options;

    const queryBuilder = this.repository
      .createQueryBuilder("company")
      .where("company.isDeleted = :isDeleted", { isDeleted: false });

    if (filters.name) {
      queryBuilder.andWhere("company.name ILIKE :name", {
        name: `%${filters.name}%`,
      });
    }

    if (filters.industry) {
      queryBuilder.andWhere("company.industry ILIKE :industry", {
        industry: `%${filters.industry}%`,
      });
    }

    if (filters.industry_not) {
      queryBuilder.andWhere("company.industry NOT ILIKE :industry_not", {
        industry_not: `%${filters.industry_not}%`,
      });
    }

    if (filters.location) {
      queryBuilder.andWhere("company.location ILIKE :location", {
        location: `%${filters.location}%`,
      });
    }

    if (filters.city) {
      queryBuilder.andWhere("company.city ILIKE :city", {
        city: `%${filters.city}%`,
      });
    }

    if (filters.state) {
      queryBuilder.andWhere("company.state ILIKE :state", {
        state: `%${filters.state}%`,
      });
    }

    if (filters.country) {
      queryBuilder.andWhere("company.country ILIKE :country", {
        country: `%${filters.country}%`,
      });
    }

    if (filters.companySize) {
      queryBuilder.andWhere("company.companySize = :companySize", {
        companySize: filters.companySize,
      });
    }

    if (filters.fundingStage) {
      queryBuilder.andWhere("company.fundingStage = :fundingStage", {
        fundingStage: filters.fundingStage,
      });
    }

    if (filters.description) {
      queryBuilder.andWhere("company.description ILIKE :description", {
        description: `%${filters.description}%`,
      });
    }

    if (filters.website) {
      queryBuilder.andWhere("company.website ILIKE :website", {
        website: `%${filters.website}%`,
      });
    }

    // General search across multiple fields
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.andWhere(
        "(company.name ILIKE :search OR company.industry ILIKE :search OR company.location ILIKE :search OR company.description ILIKE :search OR company.website ILIKE :search)",
        { search: searchTerm }
      );
    }

    const total = await queryBuilder.getCount();

    const companies = await queryBuilder
      .orderBy(`company.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { companies, total };
  }

  async createCompany(data: Partial<Company>): Promise<Company> {
    const existing = await this.findDuplicate({
      domain: data.domain,
      linkedinUrl: data.linkedinUrl,
      name: data.name,
    });

    if (existing) {
      return await this.updateCompany(existing.id, data);
    }

    const company = this.repository.create(data);
    return await this.repository.save(company);
  }

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    await this.repository.update(id, data);
    return await this.findById(id);
  }

  async deleteCompany(id: string): Promise<void> {
    await this.repository.update(id, { isDeleted: true });
  }

  async getAllCompanies(
    options: IPaginationOptions = {}
  ): Promise<{ companies: Company[]; total: number }> {
    return await this.search({}, options);
  }

  async getCompanyWithPeople(id: string): Promise<Company> {
    const company = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ["people"],
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }
}
