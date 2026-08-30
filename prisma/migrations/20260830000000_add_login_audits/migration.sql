-- CreateTable
CREATE TABLE "login_audits" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_audits_email_created_at_idx" ON "login_audits"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_audits_ip_address_created_at_idx" ON "login_audits"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "login_audits_status_created_at_idx" ON "login_audits"("status", "created_at");

-- CreateIndex
CREATE INDEX "login_audits_created_at_idx" ON "login_audits"("created_at");
