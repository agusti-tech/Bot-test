-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "combinedWithTableId" TEXT;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_combinedWithTableId_fkey" FOREIGN KEY ("combinedWithTableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
