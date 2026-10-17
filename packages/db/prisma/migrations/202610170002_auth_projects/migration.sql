ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
CREATE TABLE "Session" (
"id" TEXT NOT NULL PRIMARY KEY, "tokenHash" TEXT NOT NULL, "userId" INTEGER NOT NULL,
"expiresAt" DATETIME NOT NULL,
CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "Project" (
"id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL,
"description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'PLANNED',
"ownerId" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" DATETIME NOT NULL,
CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "Project_ownerId_createdAt_idx" ON "Project"("ownerId", "createdAt");
