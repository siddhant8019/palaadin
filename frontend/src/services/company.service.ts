import { apiClient } from "./api";
import { ICompany, IPaginatedResponse } from "@/types/company.types";

export interface ICompanyFilters {
  name?: string;
  industry?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  companySize?: string;
  fundingStage?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export class CompanyService {
  async getAll(
    filters?: ICompanyFilters
  ): Promise<IPaginatedResponse<ICompany>> {
    const response = await apiClient.get("/api/companies", { params: filters });
    return response.data.data;
  }

  async getById(id: string): Promise<ICompany> {
    const response = await apiClient.get(`/api/companies/${id}`);
    return response.data.data;
  }

  async create(data: Partial<ICompany>): Promise<ICompany> {
    const response = await apiClient.post("/api/companies", data);
    return response.data.data;
  }

  async update(id: string, data: Partial<ICompany>): Promise<ICompany> {
    const response = await apiClient.put(`/api/companies/${id}`, data);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/companies/${id}`);
  }

  // Alias for consistency
  async deleteCompany(id: string): Promise<void> {
    return this.delete(id);
  }

  async getWithPeople(id: string): Promise<ICompany> {
    const response = await apiClient.get(`/api/companies/${id}/people`);
    return response.data.data;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.delete(id)));
  }
}

export const companyService = new CompanyService();
