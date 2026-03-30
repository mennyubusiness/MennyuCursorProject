-- Single global display order per pod: renumber sortOrder 0..n-1 by previous display order (featured first, then sortOrder, then vendorId).
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "podId"
      ORDER BY "isFeatured" DESC, "sortOrder" ASC, "vendorId" ASC
    ) - 1 AS new_sort
  FROM "PodVendor"
)
UPDATE "PodVendor" pv
SET "sortOrder" = o.new_sort
FROM ordered o
WHERE pv.id = o.id;
