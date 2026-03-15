-- CreateTable
CREATE TABLE "RestaurantTokenAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "allowanceMonthly" INTEGER NOT NULL DEFAULT 100,
    "periodStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTokenAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTokenAccount_restaurantId_key" ON "RestaurantTokenAccount"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantTokenAccount_restaurantId_idx" ON "RestaurantTokenAccount"("restaurantId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_restaurantId_idx" ON "TokenUsageLog"("restaurantId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_restaurantId_createdAt_idx" ON "TokenUsageLog"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "RestaurantTokenAccount" ADD CONSTRAINT "RestaurantTokenAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
