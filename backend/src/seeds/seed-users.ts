import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../entities/entities/User';
import { hashPassword } from '../auth/password.util';

const dataSource = new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }),
  entities: [User],
  synchronize: false,
});

const seedUsers = [
  {
    fullName: 'Test User',
    email: 'test@partyon.com',
    dateOfBirth: '1998-04-15',
    phoneNumber: '+447700900001',
    password: 'Test1234!',
  },
  {
    fullName: 'Maria Lopez',
    email: 'maria@partyon.com',
    dateOfBirth: '1996-07-22',
    phoneNumber: '+34600111222',
    password: 'Maria1234!',
  },
  {
    fullName: 'John Miller',
    email: 'john@partyon.com',
    dateOfBirth: '1995-01-09',
    phoneNumber: '+12025550123',
    password: 'John1234!',
  },
];

async function runSeed() {
  await dataSource.initialize();
  const userRepository = dataSource.getRepository(User);

  for (const entry of seedUsers) {
    const [name, ...surnameParts] = entry.fullName.trim().split(/\s+/);
    const surname = surnameParts.join(' ') || '-';
    const email = entry.email.toLowerCase();

    let user = await userRepository.findOne({ where: { email } });

    if (!user) {
      user = userRepository.create();
    }

    user.name = name;
    user.surname = surname;
    user.userName = email.split('@')[0] || `user${Date.now()}`;
    user.phoneNumber = entry.phoneNumber;
    user.email = email;
    user.birthDate = entry.dateOfBirth;
    user.password = hashPassword(entry.password);
    await userRepository.save(user);
  }

  console.log(`Seed complete: ${seedUsers.length} users upserted.`);
  await dataSource.destroy();
}

runSeed().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
