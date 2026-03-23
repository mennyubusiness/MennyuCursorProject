/**
 * Mennyu MVP seed: pods, vendors, pod-vendor membership, menu items, and Deliverect-style modifiers.
 * Idempotent and non-destructive: no MenuItem (or OrderLineItem-referenced) rows are deleted.
 * Run: npm run db:seed (or npx prisma db seed)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type MenuItemSeed = {
  name: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
};

/** Upsert one menu item by vendorId + name. Preserves existing rows (e.g. referenced by OrderLineItem). Returns the menu item. */
async function upsertMenuItem(
  vendorId: string,
  item: MenuItemSeed
): Promise<{ id: string }> {
  const existing = await prisma.menuItem.findFirst({
    where: { vendorId, name: item.name },
  });
  if (existing) {
    await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        description: item.description,
        priceCents: item.priceCents,
        sortOrder: item.sortOrder,
        isAvailable: true,
      },
    });
    return { id: existing.id };
  }
  const created = await prisma.menuItem.create({
    data: {
      vendorId,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      sortOrder: item.sortOrder,
      isAvailable: true,
    },
  });
  return { id: created.id };
}

async function main() {
  // Pod
  const pod = await prisma.pod.upsert({
    where: { slug: "downtown-food-pod" },
    update: {},
    create: {
      name: "Downtown Food Pod",
      slug: "downtown-food-pod",
      description: "A variety of food carts in the heart of downtown. Order from multiple vendors in one place.",
      address: "123 Main St, Portland, OR",
      latitude: 45.5152,
      longitude: -122.6784,
      isActive: true,
    },
  });

  // Vendors (no Deliverect IDs in seed; add when onboarding)
  const vendorTaco = await prisma.vendor.upsert({
    where: { slug: "taco-fiesta" },
    update: {},
    create: {
      name: "Taco Fiesta",
      slug: "taco-fiesta",
      description: "Authentic tacos and burritos",
      isActive: true,
    },
  });

  const vendorPizza = await prisma.vendor.upsert({
    where: { slug: "slice-of-heaven" },
    update: {},
    create: {
      name: "Slice of Heaven",
      slug: "slice-of-heaven",
      description: "Wood-fired pizza by the slice",
      isActive: true,
    },
  });

  const vendorBowls = await prisma.vendor.upsert({
    where: { slug: "green-bowl" },
    update: {},
    create: {
      name: "Green Bowl",
      slug: "green-bowl",
      description: "Healthy grain bowls and salads",
      isActive: true,
    },
  });

  // Pod–Vendor membership
  await prisma.podVendor.upsert({
    where: {
      podId_vendorId: { podId: pod.id, vendorId: vendorTaco.id },
    },
    update: {},
    create: { podId: pod.id, vendorId: vendorTaco.id, sortOrder: 0, isActive: true },
  });
  await prisma.podVendor.upsert({
    where: {
      podId_vendorId: { podId: pod.id, vendorId: vendorPizza.id },
    },
    update: {},
    create: { podId: pod.id, vendorId: vendorPizza.id, sortOrder: 1, isActive: true },
  });
  await prisma.podVendor.upsert({
    where: {
      podId_vendorId: { podId: pod.id, vendorId: vendorBowls.id },
    },
    update: {},
    create: { podId: pod.id, vendorId: vendorBowls.id, sortOrder: 2, isActive: true },
  });

  // Menu items – Taco Fiesta (prices in cents). Upsert by (vendorId, name); no deletes.
  const tacoItems: MenuItemSeed[] = [
    { name: "Street Tacos (3)", description: "Beef, chicken, or carnitas", priceCents: 999, sortOrder: 0 },
    { name: "Burrito", description: "Rice, beans, protein, salsa", priceCents: 1299, sortOrder: 1 },
    { name: "Quesadilla", description: "Cheese and your choice of protein", priceCents: 899, sortOrder: 2 },
    { name: "Chips & Guac", description: "House-made guacamole", priceCents: 499, sortOrder: 3 },
  ];
  for (const item of tacoItems) {
    await upsertMenuItem(vendorTaco.id, item);
  }

  // Menu items – Slice of Heaven (capture Whole Pizza for modifier seeding)
  const pizzaItems: MenuItemSeed[] = [
    { name: "Cheese Slice", description: "Classic marinara and mozzarella", priceCents: 499, sortOrder: 0 },
    { name: "Pepperoni Slice", description: "Pepperoni and cheese", priceCents: 599, sortOrder: 1 },
    { name: "Whole Pizza (8 slice)", description: "Choose your toppings", priceCents: 2499, sortOrder: 2 },
    { name: "Garlic Bread", description: "Buttered with herbs", priceCents: 399, sortOrder: 3 },
  ];
  let wholePizza: { id: string } | null = null;
  for (const item of pizzaItems) {
    const menuItem = await upsertMenuItem(vendorPizza.id, item);
    if (item.name === "Whole Pizza (8 slice)") wholePizza = menuItem;
  }

  // ---- Deliverect-style modifiers: one realistic item (Whole Pizza) ----
  if (wholePizza) {
    let sizeGroup = await prisma.modifierGroup.findFirst({ where: { vendorId: vendorPizza.id, name: "Pizza size" } });
    if (!sizeGroup) {
      sizeGroup = await prisma.modifierGroup.create({
        data: {
          vendorId: vendorPizza.id,
          name: "Pizza size",
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          sortOrder: 0,
          isAvailable: true,
        },
      });
    }
    let largeOpt = await prisma.modifierOption.findFirst({ where: { modifierGroupId: sizeGroup.id, name: "Large" } });
    if (!largeOpt) {
      largeOpt = await prisma.modifierOption.create({
        data: { modifierGroupId: sizeGroup.id, name: "Large", priceCents: 0, sortOrder: 0, isDefault: true, isAvailable: true },
      });
    }
    let xlargeOpt = await prisma.modifierOption.findFirst({ where: { modifierGroupId: sizeGroup.id, name: "X-Large" } });
    if (!xlargeOpt) {
      xlargeOpt = await prisma.modifierOption.create({
        data: { modifierGroupId: sizeGroup.id, name: "X-Large", priceCents: 300, sortOrder: 1, isDefault: false, isAvailable: true },
      });
    }

    let toppingsGroup = await prisma.modifierGroup.findFirst({ where: { vendorId: vendorPizza.id, name: "Extra toppings" } });
    if (!toppingsGroup) {
      toppingsGroup = await prisma.modifierGroup.create({
        data: {
          vendorId: vendorPizza.id,
          name: "Extra toppings",
          minSelections: 0,
          maxSelections: 5,
          isRequired: false,
          sortOrder: 1,
          isAvailable: true,
        },
      });
    }
    let extraCheeseOpt = await prisma.modifierOption.findFirst({ where: { modifierGroupId: toppingsGroup.id, name: "Extra cheese" } });
    if (!extraCheeseOpt) {
      extraCheeseOpt = await prisma.modifierOption.create({
        data: { modifierGroupId: toppingsGroup.id, name: "Extra cheese", priceCents: 100, sortOrder: 0, isDefault: false, isAvailable: true },
      });
    }
    if (!(await prisma.modifierOption.findFirst({ where: { modifierGroupId: toppingsGroup.id, name: "Mushrooms" } }))) {
      await prisma.modifierOption.create({
        data: { modifierGroupId: toppingsGroup.id, name: "Mushrooms", priceCents: 50, sortOrder: 1, isDefault: false, isAvailable: true },
      });
    }

    let drizzleGroup = await prisma.modifierGroup.findFirst({ where: { vendorId: vendorPizza.id, name: "Drizzle (with Extra cheese)" } });
    if (!drizzleGroup) {
      drizzleGroup = await prisma.modifierGroup.create({
        data: {
          vendorId: vendorPizza.id,
          name: "Drizzle (with Extra cheese)",
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          sortOrder: 0,
          isAvailable: true,
          parentModifierOptionId: extraCheeseOpt.id,
        },
      });
    }
    if (!(await prisma.modifierOption.findFirst({ where: { modifierGroupId: drizzleGroup.id, name: "Garlic drizzle" } }))) {
      await prisma.modifierOption.create({
        data: { modifierGroupId: drizzleGroup.id, name: "Garlic drizzle", priceCents: 0, sortOrder: 0, isDefault: false, isAvailable: true },
      });
    }

    const existingSizeLink = await prisma.menuItemModifierGroup.findUnique({
      where: { menuItemId_modifierGroupId: { menuItemId: wholePizza.id, modifierGroupId: sizeGroup.id } },
    });
    if (!existingSizeLink) {
      await prisma.menuItemModifierGroup.create({
        data: { menuItemId: wholePizza.id, modifierGroupId: sizeGroup.id, required: true, minSelections: 1, maxSelections: 1, sortOrder: 0 },
      });
    }
    const existingToppingsLink = await prisma.menuItemModifierGroup.findUnique({
      where: { menuItemId_modifierGroupId: { menuItemId: wholePizza.id, modifierGroupId: toppingsGroup.id } },
    });
    if (!existingToppingsLink) {
      await prisma.menuItemModifierGroup.create({
        data: { menuItemId: wholePizza.id, modifierGroupId: toppingsGroup.id, required: false, minSelections: 0, maxSelections: 5, sortOrder: 1 },
      });
    }
    console.log("Modifier seed: Whole Pizza (8 slice) – ModifierGroup, ModifierOption, MenuItemModifierGroup records upserted.");
  }

  // Menu items – Green Bowl
  const bowlItems: MenuItemSeed[] = [
    { name: "Grain Bowl", description: "Quinoa, greens, roasted veggies", priceCents: 1299, sortOrder: 0 },
    { name: "Chicken Bowl", description: "Grilled chicken, rice, black beans", priceCents: 1399, sortOrder: 1 },
    { name: "Side Salad", description: "Mixed greens, house dressing", priceCents: 599, sortOrder: 2 },
    { name: "Fresh Juice", description: "Daily selection", priceCents: 499, sortOrder: 3 },
  ];
  for (const item of bowlItems) {
    await upsertMenuItem(vendorBowls.id, item);
  }

  // ---- Second pod: Riverside Market ----
  const podRiverside = await prisma.pod.upsert({
    where: { slug: "riverside-market" },
    update: {},
    create: {
      name: "Riverside Market",
      slug: "riverside-market",
      description: "Food trucks and vendors by the river. Coffee, BBQ, and noodles.",
      address: "450 River Dr, Portland, OR",
      latitude: 45.528,
      longitude: -122.662,
      isActive: true,
    },
  });

  const vendorCoffee = await prisma.vendor.upsert({
    where: { slug: "river-coffee" },
    update: {},
    create: {
      name: "River Coffee",
      slug: "river-coffee",
      description: "Specialty coffee and pastries",
      isActive: true,
    },
  });

  const vendorBBQ = await prisma.vendor.upsert({
    where: { slug: "smoke-pit-bbq" },
    update: {},
    create: {
      name: "Smoke Pit BBQ",
      slug: "smoke-pit-bbq",
      description: "Slow-smoked meats and sides",
      isActive: true,
    },
  });

  const vendorNoodle = await prisma.vendor.upsert({
    where: { slug: "eastside-noodles" },
    update: {},
    create: {
      name: "Eastside Noodles",
      slug: "eastside-noodles",
      description: "Hand-pulled noodles and broths",
      isActive: true,
    },
  });

  await prisma.podVendor.upsert({
    where: { podId_vendorId: { podId: podRiverside.id, vendorId: vendorCoffee.id } },
    update: {},
    create: { podId: podRiverside.id, vendorId: vendorCoffee.id, sortOrder: 0, isActive: true },
  });
  await prisma.podVendor.upsert({
    where: { podId_vendorId: { podId: podRiverside.id, vendorId: vendorBBQ.id } },
    update: {},
    create: { podId: podRiverside.id, vendorId: vendorBBQ.id, sortOrder: 1, isActive: true },
  });
  await prisma.podVendor.upsert({
    where: { podId_vendorId: { podId: podRiverside.id, vendorId: vendorNoodle.id } },
    update: {},
    create: { podId: podRiverside.id, vendorId: vendorNoodle.id, sortOrder: 2, isActive: true },
  });

  const coffeeItems: MenuItemSeed[] = [
    { name: "Drip Coffee", description: "House blend or single origin", priceCents: 399, sortOrder: 0 },
    { name: "Latte", description: "Espresso and steamed milk", priceCents: 549, sortOrder: 1 },
    { name: "Croissant", description: "Butter croissant", priceCents: 449, sortOrder: 2 },
    { name: "Breakfast Burrito", description: "Eggs, cheese, salsa", priceCents: 899, sortOrder: 3 },
  ];
  for (const item of coffeeItems) {
    await upsertMenuItem(vendorCoffee.id, item);
  }

  const bbqItems: MenuItemSeed[] = [
    { name: "Brisket Plate", description: "Smoked brisket, two sides", priceCents: 1699, sortOrder: 0 },
    { name: "Pulled Pork Sandwich", description: "Coleslaw, pickles", priceCents: 1199, sortOrder: 1 },
    { name: "Mac & Cheese", description: "Side", priceCents: 499, sortOrder: 2 },
    { name: "Cornbread", description: "Two pieces", priceCents: 399, sortOrder: 3 },
  ];
  for (const item of bbqItems) {
    await upsertMenuItem(vendorBBQ.id, item);
  }

  const noodleItems: MenuItemSeed[] = [
    { name: "Beef Noodle Soup", description: "Hand-pulled noodles, braised beef", priceCents: 1299, sortOrder: 0 },
    { name: "Spicy Dan Dan", description: "Pork, chili oil, peanuts", priceCents: 1199, sortOrder: 1 },
    { name: "Vegetarian Broth", description: "Mushroom and greens", priceCents: 1099, sortOrder: 2 },
    { name: "Dumplings (6)", description: "Pork or veggie", priceCents: 799, sortOrder: 3 },
  ];
  for (const item of noodleItems) {
    await upsertMenuItem(vendorNoodle.id, item);
  }

  // Dev vendor login (Auth.js): email/password — Taco Fiesta owner
  const devEmail = "vendor@mennyu.local";
  const devPasswordHash = await bcrypt.hash("mennyu-dev-password", 12);
  let devUser = await prisma.user.findUnique({ where: { email: devEmail } });
  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: devEmail,
        passwordHash: devPasswordHash,
        name: "Seed vendor user",
        vendorMemberships: {
          create: { vendorId: vendorTaco.id, role: "owner" },
        },
      },
    });
    console.log("Auth: created dev user", devEmail, "(password: mennyu-dev-password) for vendor", vendorTaco.slug);
  } else {
    const m = await prisma.vendorMembership.findUnique({
      where: { userId_vendorId: { userId: devUser.id, vendorId: vendorTaco.id } },
    });
    if (!m) {
      await prisma.vendorMembership.create({
        data: { userId: devUser.id, vendorId: vendorTaco.id, role: "owner" },
      });
      console.log("Auth: linked existing user to Taco Fiesta vendor");
    }
  }

  console.log("Seed complete: 2 pods, 6 vendors, menu items + Deliverect-style modifiers (Whole Pizza) created.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
