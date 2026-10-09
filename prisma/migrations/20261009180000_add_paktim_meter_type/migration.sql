-- Preserve existing meter types and customer data.
ALTER TYPE "MeterType" ADD VALUE IF NOT EXISTS 'PAKTIM';
