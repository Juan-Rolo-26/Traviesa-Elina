const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.findUnique({
    where: { email: "juanpablorolo2007@gmail.com" }
  });
  console.log("Customer:", customer);
}
main().catch(console.error).finally(() => prisma.$disconnect());
