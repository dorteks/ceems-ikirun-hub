/*
  Warnings:

  - The values [AYEPE_1,AYEPE_2,AYETORO,GRA,KELEBE_1,KELEBE_2,OGO_OLUWA,OKE_FIA,OSOGBO_1,OSOGBO_2,OTA_EFUN,OKEFIA] on the enum `ServiceCenter` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ServiceCenter_new" AS ENUM ('EWETA', 'ILA', 'INISA', 'IRAGBIJI', 'IREE', 'ODOFUN', 'STATION_ROAD');
ALTER TABLE "Customer" ALTER COLUMN "service_center" TYPE "ServiceCenter_new" USING ("service_center"::text::"ServiceCenter_new");
ALTER TABLE "customer_enumerations" ALTER COLUMN "service_center" TYPE "ServiceCenter_new" USING ("service_center"::text::"ServiceCenter_new");
ALTER TYPE "ServiceCenter" RENAME TO "ServiceCenter_old";
ALTER TYPE "ServiceCenter_new" RENAME TO "ServiceCenter";
DROP TYPE "public"."ServiceCenter_old";
COMMIT;
