-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "auth_credentials";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "resetCodeHash" TEXT,
    "resetCodeExpiresAt" DATETIME,
    "resetCodeUsed" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT,
    "lastName" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "mercadoPagoCustomerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Customer" ("address1", "address2", "city", "createdAt", "email", "firstName", "id", "lastName", "mercadoPagoCustomerId", "phone", "postalCode", "province", "updatedAt") SELECT "address1", "address2", "city", "createdAt", "email", "firstName", "id", "lastName", "mercadoPagoCustomerId", "phone", "postalCode", "province", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE UNIQUE INDEX "Customer_username_key" ON "Customer"("username");
CREATE UNIQUE INDEX "Customer_mercadoPagoCustomerId_key" ON "Customer"("mercadoPagoCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
