-- Outbox email: penyimpanan email penting sebelum dikirim worker, dengan
-- status/attempts/lastError/nextRetryAt untuk retry berjenjang.
--
-- Aman pada database kosong maupun existing: enum & tabel dibuat dengan guard
-- IF NOT EXISTS (via DO block untuk enum yang tidak mendukungnya), index
-- dibuat IF NOT EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusEmailOutbox') THEN
    CREATE TYPE "StatusEmailOutbox" AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id"              TEXT NOT NULL,
  "jenis_email"     TEXT NOT NULL,
  "recipient"       TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "payload"         JSONB NOT NULL,
  "status"          "StatusEmailOutbox" NOT NULL DEFAULT 'PENDING',
  "attempts"        INTEGER NOT NULL DEFAULT 0,
  "last_error"      TEXT,
  "next_retry_at"   TIMESTAMPTZ(3),
  "sent_at"         TIMESTAMPTZ(3),
  "idempotency_key" TEXT,
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_idempotency_key_key"
  ON "email_outbox" ("idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_email_outbox_status_retry"
  ON "email_outbox" ("status", "next_retry_at");

CREATE INDEX IF NOT EXISTS "idx_email_outbox_created"
  ON "email_outbox" ("created_at" DESC);
