import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSources = [
  "Booking",
  "Reception",
  "Walk In",
  "Telegram",
  "Phone",
  "Instagram",
  "Other",
];

async function main() {
  for (const name of defaultSources) {
    await prisma.bookingSource.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Seeded booking sources");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
