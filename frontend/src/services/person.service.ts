import { apiClient } from "./api";
import { IPerson, IPaginatedResponse } from "@/types/company.types";

export interface IPersonFilters {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  title?: string;
  companyId?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export class PersonService {
  async getAll(filters?: IPersonFilters): Promise<IPaginatedResponse<IPerson>> {
    const response = await apiClient.get("/api/people", { params: filters });
    return response.data.data;
  }

  async getById(id: string): Promise<IPerson> {
    const response = await apiClient.get(`/api/people/${id}`);
    return response.data.data;
  }

  async create(data: Partial<IPerson>): Promise<IPerson> {
    const response = await apiClient.post("/api/people", data);
    return response.data.data;
  }

  async update(id: string, data: Partial<IPerson>): Promise<IPerson> {
    const response = await apiClient.put(`/api/people/${id}`, data);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/people/${id}`);
  }

  async getByCompany(
    companyId: string,
    filters?: IPersonFilters
  ): Promise<IPaginatedResponse<IPerson>> {
    const response = await apiClient.get(`/api/people/company/${companyId}`, {
      params: filters,
    });
    return response.data.data;
  }
}

export const personService = new PersonService();

