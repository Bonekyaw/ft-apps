import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed banners
  const bannersToCreate = [
    {
      title: 'Welcome to Family Taxi',
      imageUrl:
        'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&h=400&fit=crop',
      priority: 0,
      isActive: true,
    },
    {
      title: '50% Off First Ride',
      imageUrl:
        'https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&h=400&fit=crop',
      priority: 1,
      isActive: true,
    },
    {
      title: 'Safe Rides, Happy Family',
      imageUrl:
        'https://images.unsplash.com/photo-1562618817-5a020b498e19?w=800&h=400&fit=crop',
      priority: 2,
      isActive: true,
    },
  ];

  for (const b of bannersToCreate) {
    await prisma.banner.create({ data: b });
  }

  // Seed announcements
  const announcementsToCreate = [
    {
      title: 'Holiday Surge Pricing Update',
      body: 'During the Thingyan holiday (Apr 13-16), fares may be slightly higher due to increased demand. Plan your trips accordingly!',
      imageUrl:
        'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=200&h=200&fit=crop',
      priority: 0,
      isActive: true,
    },
    {
      title: 'New Payment Options Coming Soon',
      body: 'We are working on adding KBZPay and Wave Pay as payment methods. Stay tuned for updates!',
      priority: 1,
      isActive: true,
    },
    {
      title: 'Driver Safety Standards',
      body: 'All Family Taxi drivers are now required to complete safety training. Your safety is our priority.',
      priority: 2,
      isActive: true,
    },
  ];

  for (const a of announcementsToCreate) {
    await prisma.announcement.create({ data: a });
  }

  const bc = await prisma.banner.count();
  const ac = await prisma.announcement.count();
  console.log(`Seeded: ${bc} banners, ${ac} announcements`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
