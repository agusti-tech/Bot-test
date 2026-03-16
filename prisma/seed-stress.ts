/**
 * Stress seed: adds ~300 seats, 200+ guests, 500+ reservations to Bella Italia
 * for testing pagination, zone filter, and analytics at scale.
 *
 * Run after the main seed: npm run seed && npm run seed:stress
 * Safe to run multiple times (skips if data already present).
 */

import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_TABLES = 100;
const TARGET_GUESTS = 250;
const TARGET_RESERVATIONS = 550;
const BELLA_SLUG = "bella-italia";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
const SOURCES = ["phone", "web", "ai_assistant", "walk_in"] as const;
const TIMES = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateAt(y: number, m: number, d: number): Date {
  const dt = new Date(y, m, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: BELLA_SLUG },
    select: { id: true },
  });
  if (!restaurant) {
    console.error("Restaurant not found. Run 'npm run seed' first.");
    process.exit(1);
  }
  const restaurantId = restaurant.id;
  console.log("Stress seed for restaurant:", BELLA_SLUG);

  // --- Tables: add until we have TARGET_TABLES ---
  const existingTableCount = await prisma.restaurantTable.count({
    where: { restaurantId },
  });
  if (existingTableCount < TARGET_TABLES) {
    const existingTables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      select: { sortOrder: true, label: true },
    });
    const maxOrder = existingTables.length > 0
      ? Math.max(...existingTables.map((t) => t.sortOrder))
      : -1;
    const existingLabels = new Set(existingTables.map((t) => t.label));
    const toCreate = TARGET_TABLES - existingTableCount;

    const zones: { zone: string; labelPrefix: string; count: number; shape: "ROUND" | "SQUARE" | "RECTANGLE" | "BOOTH" }[] = [
      { zone: "Main Dining", labelPrefix: "T", count: 25, shape: "RECTANGLE" },
      { zone: "Patio", labelPrefix: "P", count: 15, shape: "ROUND" },
      { zone: "Bar", labelPrefix: "B", count: 12, shape: "BOOTH" },
      { zone: "Terrace", labelPrefix: "TR", count: 20, shape: "SQUARE" },
      { zone: "Garden", labelPrefix: "G", count: 28, shape: "RECTANGLE" },
    ];
    let sortOrder = maxOrder + 1;
    let created = 0;
    for (const z of zones) {
      for (let i = 1; i <= z.count && created < toCreate; i++) {
        const label = `${z.labelPrefix}${i}`;
        if (existingLabels.has(label)) continue;
        const row = Math.floor(sortOrder / 12);
        const col = sortOrder % 12;
        await prisma.restaurantTable.create({
          data: {
            restaurantId,
            label,
            minCapacity: 2,
            maxCapacity: 4,
            shape: z.shape,
            zone: z.zone,
            posX: 80 + col * 70,
            posY: 80 + row * 80,
            width: 70,
            height: 70,
            sortOrder,
            isActive: true,
          },
        });
        existingLabels.add(label);
        sortOrder++;
        created++;
      }
    }
    console.log("Created", created, "tables. Total:", existingTableCount + created);
  } else {
    console.log("Tables already at target:", existingTableCount);
  }

  // --- Guests: add until TARGET_GUESTS ---
  const existingGuestCount = await prisma.guest.count({ where: { restaurantId } });
  if (existingGuestCount < TARGET_GUESTS) {
    const toCreate = TARGET_GUESTS - existingGuestCount;
    const firstNames = ["Anna", "Bruno", "Clara", "David", "Eva", "Felix", "Greta", "Hans", "Ines", "Jan", "Karla", "Leo", "Maria", "Noah", "Olga", "Paul", "Rita", "Stefan", "Thea", "Uwe"];
    const lastNames = ["Müller", "Schmidt", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch"];
    const guests: { restaurantId: string; name: string; phone: string; email: string }[] = [];
    for (let i = 0; i < toCreate; i++) {
      const phone = `+4930${String(1000000 + existingGuestCount + i).slice(-7)}`;
      const name = `${pick(firstNames)} ${pick(lastNames)}`;
      const email = `guest-${existingGuestCount + i}@example.com`;
      guests.push({ restaurantId, name, phone, email });
    }
    await prisma.guest.createMany({ data: guests, skipDuplicates: true });
    console.log("Created up to", toCreate, "guests. Total:", await prisma.guest.count({ where: { restaurantId } }));
  } else {
    console.log("Guests already at target:", existingGuestCount);
  }

  // --- Reservations: add until TARGET_RESERVATIONS ---
  const existingResCount = await prisma.reservation.count({ where: { restaurantId } });
  if (existingResCount < TARGET_RESERVATIONS) {
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      select: { id: true },
    });
    const guests = await prisma.guest.findMany({
      where: { restaurantId },
      select: { id: true, name: true, phone: true },
    });
    const tableIds = tables.map((t) => t.id);
    const toCreate = TARGET_RESERVATIONS - existingResCount;
    const now = new Date();
    const today = dateAt(now.getFullYear(), now.getMonth(), now.getDate());
    const reservations: {
      restaurantId: string;
      date: Date;
      time: string;
      partySize: number;
      guestName: string;
      guestPhone: string;
      guestEmail: string | null;
      status: string;
      source: string;
      tableId: string | null;
      guestId: string | null;
      estimatedDuration: number;
    }[] = [];
    for (let i = 0; i < toCreate; i++) {
      const daysAgo = Math.floor(Math.random() * 35) - 5;
      const d = new Date(today);
      d.setDate(d.getDate() + daysAgo);
      const date = dateAt(d.getFullYear(), d.getMonth(), d.getDate());
      const guest = guests[Math.floor(Math.random() * guests.length)];
      const status = pick(STATUSES);
      const source = pick(SOURCES);
      reservations.push({
        restaurantId,
        date,
        time: pick(TIMES),
        partySize: 2 + Math.floor(Math.random() * 4),
        guestName: guest.name,
        guestPhone: guest.phone ?? "",
        guestEmail: guest.phone ? `${guest.name.replace(/\s/g, ".").toLowerCase()}@example.com` : null,
        status,
        source,
        tableId: tableIds.length > 0 && Math.random() > 0.2 ? pick(tableIds) : null,
        guestId: Math.random() > 0.3 ? guest.id : null,
        estimatedDuration: 75 + Math.floor(Math.random() * 45),
      });
    }
    const BATCH = 100;
    for (let i = 0; i < reservations.length; i += BATCH) {
      const batch = reservations.slice(i, i + BATCH);
      await prisma.reservation.createMany({
        data: batch as Prisma.ReservationCreateManyInput[],
      });
    }
    console.log("Created", toCreate, "reservations. Total:", existingResCount + toCreate);
  } else {
    console.log("Reservations already at target:", existingResCount);
  }

  console.log("\n--- Stress seed complete ---");
  console.log("Log in as owner@bella-italia.de (use SEED_OWNER_PASSWORD) and check:");
  console.log("  - Dashboard: zone filter (Main Dining, Patio, Bar, Terrace, Garden)");
  console.log("  - Reservations: pagination (date = today to see multiple pages)");
  console.log("  - Guests: pagination");
  console.log("  - Analytics: Today / Week / Month metrics");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
