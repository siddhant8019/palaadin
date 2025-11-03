import { Person } from "@/database/models/Person.model";

/**
 * Person factory for creating test people
 */
export const personFactory = {
  build: (overrides?: Partial<Person>): Person => {
    const person = new Person();
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    
    person.id = overrides?.id || `test-person-${timestamp}-${randomNum}`;
    person.firstName = overrides?.firstName || "John";
    person.lastName = overrides?.lastName || "Doe";
    person.fullName = overrides?.fullName || `John Doe ${randomNum}`;
    person.email = overrides?.email || `john.doe${timestamp}${randomNum}@example.com`;
    person.phone = overrides?.phone || "+1234567890";
    person.linkedinUrl = overrides?.linkedinUrl || `https://linkedin.com/in/johndoe${timestamp}${randomNum}`;
    person.title = overrides?.title || "Software Engineer";
    person.companyId = overrides?.companyId || null;
    person.location = overrides?.location || "San Francisco, CA";
    person.city = overrides?.city || "San Francisco";
    person.state = overrides?.state || "CA";
    person.country = overrides?.country || "United States";
    person.bio = overrides?.bio || "A test person";
    person.dataSource = overrides?.dataSource || "test";
    person.metadata = overrides?.metadata || {};
    person.isDeleted = overrides?.isDeleted ?? false;
    person.createdAt = overrides?.createdAt || new Date();
    person.updatedAt = overrides?.updatedAt || new Date();
    
    return person;
  },

  createBatch: (count: number, overrides?: Partial<Person>): Person[] => {
    const people: Person[] = [];
    for (let i = 0; i < count; i++) {
      people.push(personFactory.build({
        ...overrides,
        fullName: `Test Person ${i}`,
        email: `testperson${i}@example.com`,
      }));
    }
    return people;
  },
};

