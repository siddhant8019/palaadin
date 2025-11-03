import { AppDataSource } from "@/config/database";
import { User, Company, Person, UserRole } from "@/database/models";
import bcrypt from "bcrypt";
import { logger } from "@/utils/logger";

const SALT_ROUNDS = 12;

export const seedDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    logger.info("Database connection established for seeding");

    const userRepository = AppDataSource.getRepository(User);
    const companyRepository = AppDataSource.getRepository(Company);
    const personRepository = AppDataSource.getRepository(Person);

    const adminPassword = await bcrypt.hash("password123", SALT_ROUNDS);
    const admin = userRepository.create({
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
    });
    await userRepository.save(admin);
    logger.info("Created admin user");

    const userPassword = await bcrypt.hash("password123", SALT_ROUNDS);
    const regularUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = userRepository.create({
        email: `user${i}@example.com`,
        passwordHash: userPassword,
        role: UserRole.USER,
        isActive: true,
        emailVerified: true,
      });
      regularUsers.push(user);
    }
    await userRepository.save(regularUsers);
    logger.info("Created 5 regular users");

    const companies = [];
    const companyData = [
      {
        name: "TechCorp Inc",
        domain: "techcorp.com",
        industry: "Technology",
        companySize: "100-500",
        location: "San Francisco, CA",
        city: "San Francisco",
        state: "CA",
        country: "USA",
        linkedinUrl: "https://linkedin.com/company/techcorp",
        website: "https://techcorp.com",
        description: "Leading technology company",
        dataSource: "seed",
      },
      {
        name: "DataSystems Ltd",
        domain: "datasystems.com",
        industry: "Software",
        companySize: "50-100",
        location: "New York, NY",
        city: "New York",
        state: "NY",
        country: "USA",
        linkedinUrl: "https://linkedin.com/company/datasystems",
        website: "https://datasystems.com",
        description: "Data analytics platform",
        dataSource: "seed",
      },
    ];

    for (const data of companyData) {
      const company = companyRepository.create(data);
      companies.push(company);
    }
    await companyRepository.save(companies);
    logger.info(`Created ${companies.length} companies`);

    const people = [];
    const peopleData = [
      {
        firstName: "John",
        lastName: "Doe",
        fullName: "John Doe",
        email: "john.doe@techcorp.com",
        phone: "+1234567890",
        title: "CEO",
        companyId: companies[0].id,
        location: "San Francisco, CA",
        city: "San Francisco",
        state: "CA",
        country: "USA",
        linkedinUrl: "https://linkedin.com/in/johndoe",
        dataSource: "seed",
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        fullName: "Jane Smith",
        email: "jane.smith@datasystems.com",
        phone: "+1234567891",
        title: "CTO",
        companyId: companies[1].id,
        location: "New York, NY",
        city: "New York",
        state: "NY",
        country: "USA",
        linkedinUrl: "https://linkedin.com/in/janesmith",
        dataSource: "seed",
      },
    ];

    for (const data of peopleData) {
      const person = personRepository.create(data);
      people.push(person);
    }
    await personRepository.save(people);
    logger.info(`Created ${people.length} people`);

    logger.info("Database seeding completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error seeding database:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase().catch((error) => {
    logger.error("Unhandled error during seeding:", error);
    process.exit(1);
  });
}

