-- CreateTable
CREATE TABLE "email_verification_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" VARCHAR(32) NOT NULL DEFAULT 'REGISTER',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verification_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_code_email_purpose_key" ON "email_verification_code"("email", "purpose");

-- CreateIndex
CREATE INDEX "email_verification_code_expiresAt_idx" ON "email_verification_code"("expiresAt");
