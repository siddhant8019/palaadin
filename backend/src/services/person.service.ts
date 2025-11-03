import { PersonRepository, IPersonFilter, IPaginationOptions } from "@/database/repositories/person.repository";
import { Person } from "@/database/models";
import { logger } from "@/utils/logger";

export class PersonService {
  constructor(
    private personRepository: PersonRepository = new PersonRepository()
  ) {}

  async getPersonById(id: string): Promise<Person> {
    return await this.personRepository.findById(id);
  }

  async searchPeople(
    filters: IPersonFilter,
    options: IPaginationOptions
  ): Promise<{ people: Person[]; total: number; page: number; totalPages: number }> {
    const { people, total } = await this.personRepository.search(
      filters,
      options
    );

    const page = options.page || 1;
    const limit = options.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      people,
      total,
      page,
      totalPages,
    };
  }

  async createPerson(data: Partial<Person>): Promise<Person> {
    const person = await this.personRepository.createPerson(data);

    logger.info("Person created", {
      personId: person.id,
      email: person.email,
    });

    return person;
  }

  async updatePerson(id: string, data: Partial<Person>): Promise<Person> {
    const person = await this.personRepository.updatePerson(id, data);

    logger.info("Person updated", {
      personId: person.id,
      email: person.email,
    });

    return person;
  }

  async deletePerson(id: string): Promise<void> {
    await this.personRepository.deletePerson(id);

    logger.info("Person deleted", {
      personId: id,
    });
  }

  async getAllPeople(
    options: IPaginationOptions
  ): Promise<{ people: Person[]; total: number; page: number; totalPages: number }> {
    return await this.searchPeople({}, options);
  }

  async getPeopleByCompany(
    companyId: string,
    options: IPaginationOptions
  ): Promise<{ people: Person[]; total: number; page: number; totalPages: number }> {
    return await this.searchPeople({ companyId }, options);
  }
}

