-- Deliverect-first menu publish: stable ids for modifier groups + category hint on menu items
ALTER TABLE "MenuItem" ADD COLUMN "deliverectCategoryId" TEXT;

CREATE INDEX "MenuItem_vendorId_deliverectCategoryId_idx" ON "MenuItem"("vendorId", "deliverectCategoryId");

ALTER TABLE "ModifierGroup" ADD COLUMN "deliverectModifierGroupId" TEXT;

CREATE INDEX "ModifierGroup_vendorId_deliverectModifierGroupId_idx" ON "ModifierGroup"("vendorId", "deliverectModifierGroupId");
