import { AppDataSource } from "@/config/database";
import { Person } from "@/database/models";
import { NotFoundError } from "@/utils/errors";
import { ILike } from "typeorm";

export interface IPersonFilter {
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
  search?: string; // General search across multiple fields
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export class PersonRepository {
  private repository = AppDataSource.getRepository(Person);

  async findById(id: string): Promise<Person> {
    const person = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ["company"],
    });

    if (!person) {
      throw new NotFoundError("Person not found");
    }

    return person;
  }

  async findByEmail(email: string): Promise<Person | null> {
    return await this.repository.findOne({
      where: { email, isDeleted: false },
      relations: ["company"],
    });
  }

  async findByLinkedIn(linkedinUrl: string): Promise<Person | null> {
    return await this.repository.findOne({
      where: { linkedinUrl, isDeleted: false },
      relations: ["company"],
    });
  }

  async findByNameAndCompany(
    fullName: string,
    companyId: string
  ): Promise<Person | null> {
    return await this.repository.findOne({
      where: { 
        fullName: ILike(fullName),
        companyId, 
        isDeleted: false 
      },
      relations: ["company"],
    });
  }

  async findDuplicate(data: {
    email?: string;
    linkedinUrl?: string;
  }): Promise<Person | null> {
    if (data.email) {
      const byEmail = await this.findByEmail(data.email);
      if (byEmail) return byEmail;
    }

    if (data.linkedinUrl) {
      const byLinkedIn = await this.findByLinkedIn(data.linkedinUrl);
      if (byLinkedIn) return byLinkedIn;
    }

    return null;
  }

  async search(
    filters: IPersonFilter,
    options: IPaginationOptions = {}
  ): Promise<{ people: Person[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = options;

    const queryBuilder = this.repository
      .createQueryBuilder("person")
      .leftJoinAndSelect("person.company", "company")
      .where("person.isDeleted = :isDeleted", { isDeleted: false });

    if (filters.firstName) {
      queryBuilder.andWhere("person.firstName ILIKE :firstName", {
        firstName: `%${filters.firstName}%`,
      });
    }

    if (filters.lastName) {
      queryBuilder.andWhere("person.lastName ILIKE :lastName", {
        lastName: `%${filters.lastName}%`,
      });
    }

    if (filters.fullName) {
      queryBuilder.andWhere("person.fullName ILIKE :fullName", {
        fullName: `%${filters.fullName}%`,
      });
    }

    if (filters.email) {
      queryBuilder.andWhere("person.email ILIKE :email", {
        email: `%${filters.email}%`,
      });
    }

    if (filters.title) {
      queryBuilder.andWhere("person.title ILIKE :title", {
        title: `%${filters.title}%`,
      });
    }

    if (filters.companyId) {
      queryBuilder.andWhere("person.companyId = :companyId", {
        companyId: filters.companyId,
      });
    }

    if (filters.location) {
      queryBuilder.andWhere("person.location ILIKE :location", {
        location: `%${filters.location}%`,
      });
    }

    if (filters.city) {
      queryBuilder.andWhere("person.city ILIKE :city", {
        city: `%${filters.city}%`,
      });
    }

    if (filters.state) {
      queryBuilder.andWhere("person.state ILIKE :state", {
        state: `%${filters.state}%`,
      });
    }

    if (filters.country) {
      queryBuilder.andWhere("person.country ILIKE :country", {
        country: `%${filters.country}%`,
      });
    }

    // General search across multiple fields
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.andWhere(
        "(person.fullName ILIKE :search OR person.firstName ILIKE :search OR person.lastName ILIKE :search OR person.email ILIKE :search OR person.title ILIKE :search OR person.location ILIKE :search OR company.name ILIKE :search)",
        { search: searchTerm }
      );
    }

    const total = await queryBuilder.getCount();

    const people = await queryBuilder
      .orderBy(`person.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { people, total };
  }

  async createPerson(data: Partial<Person>): Promise<Person> {
    const existing = await this.findDuplicate({
      email: data.email,
      linkedinUrl: data.linkedinUrl,
    });

    if (existing) {
      return await this.updatePerson(existing.id, data);
    }

    if (data.firstName && data.lastName && !data.fullName) {
      data.fullName = `${data.firstName} ${data.lastName}`;
    }

    const person = this.repository.create(data);
    return await this.repository.save(person);
  }

  async updatePerson(id: string, data: Partial<Person>): Promise<Person> {
    if (data.firstName && data.lastName && !data.fullName) {
      data.fullName = `${data.firstName} ${data.lastName}`;
    }

    await this.repository.update(id, data);
    return await this.findById(id);
  }

  async deletePerson(id: string): Promise<void> {
    await this.repository.update(id, { isDeleted: true });
  }

  async getAllPeople(
    options: IPaginationOptions = {}
  ): Promise<{ people: Person[]; total: number }> {
    return await this.search({}, options);
  }

  async getPeopleByCompany(
    companyId: string,
    options: IPaginationOptions = {}
  ): Promise<{ people: Person[]; total: number }> {
    return await this.search({ companyId }, options);
  }
}
