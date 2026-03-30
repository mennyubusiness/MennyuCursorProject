-- Optional pod-level pickup sales tax (basis points). Null = no tax (legacy behavior).
ALTER TABLE "Pod" ADD COLUMN "pickupSalesTaxBps" INTEGER;
