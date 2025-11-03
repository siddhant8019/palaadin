export interface ICompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedinUrl?: string;
  website?: string;
  description?: string;
  foundedYear?: number;
  fundingStage?: string;
  dataSource: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IPerson {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  title?: string;
  companyId?: string;
  company?: ICompany;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  dataSource: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

