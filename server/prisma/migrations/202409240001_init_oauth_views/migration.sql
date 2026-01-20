-- Create enums
CREATE TYPE "ViewDirection" AS ENUM ('long', 'short', 'neutral');
CREATE TYPE "ViewEndType" AS ENUM ('manual_early', 'manual_on_time', 'manual_late', 'auto_expired');
CREATE TYPE "ViewStatus" AS ENUM ('active', 'closed');

-- Create tables
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "oauthProvider" TEXT NOT NULL,
  "oauthSub" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "View" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "assetCode" VARCHAR(10) NOT NULL,
  "direction" "ViewDirection" NOT NULL,
  "timeHorizon" INTEGER NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "startPrice" DECIMAL(12,4) NOT NULL,
  "endTime" TIMESTAMP(3),
  "endPrice" DECIMAL(12,4),
  "endType" "ViewEndType",
  "returnPct" DECIMAL(7,4),
  "status" "ViewStatus" NOT NULL,
  "content" TEXT NOT NULL,
  "hashtags" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "View_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "User_oauthProvider_oauthSub_key" ON "User"("oauthProvider", "oauthSub");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "View_assetCode_idx" ON "View"("assetCode");
CREATE INDEX "View_status_direction_idx" ON "View"("status", "direction");
CREATE INDEX "View_startTime_idx" ON "View"("startTime");
CREATE INDEX "View_endTime_idx" ON "View"("endTime");
CREATE INDEX "View_userId_idx" ON "View"("userId");
