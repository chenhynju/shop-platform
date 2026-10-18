ALTER TABLE "Product" ADD COLUMN "merchantId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "merchantId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING';
CREATE INDEX "Product_merchantId_createdAt_idx" ON "Product"("merchantId", "createdAt");
CREATE INDEX "OrderItem_merchantId_orderId_idx" ON "OrderItem"("merchantId", "orderId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
