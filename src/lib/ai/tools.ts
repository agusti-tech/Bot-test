import { prisma } from "@/lib/prisma";
import { findBestTable } from "@/lib/table-assignment";
import { estimateWaitMinutes } from "@/lib/waitlist";
import { findOrCreateGuest, findGuestByPhone } from "@/lib/guest";
import { AnthropicTool, ToolHandler, Locale } from "./types";

const MAX_CONCURRENT = parseInt(
  process.env.MAX_CONCURRENT_RESERVATIONS || "10",
  10
);

// --- Tool Definitions (Anthropic format) ---

export const toolDefinitions: AnthropicTool[] = [
  {
    name: "check_availability",
    description:
      "Check if the restaurant has availability for a given date, time, and party size. Returns a specific table assignment if available. Use this before creating a reservation.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Time in HH:MM 24-hour format",
        },
        party_size: {
          type: "integer",
          description: "Number of guests",
        },
        seating_preference: {
          type: "string",
          description:
            "Optional seating preference: patio, bar, main dining, private room, etc.",
        },
      },
      required: ["date", "time", "party_size"],
    },
  },
  {
    name: "get_menu_info",
    description:
      "Get the restaurant's menu information. Can filter by dietary tags or search for specific items.",
    input_schema: {
      type: "object" as const,
      properties: {
        dietary_filter: {
          type: "string",
          description:
            "Filter by dietary tag: vegetarian, vegan, gluten-free, halal, kosher, dairy-free, nut-free",
        },
        search_query: {
          type: "string",
          description: "Search term to find specific menu items by name or description",
        },
        category_name: {
          type: "string",
          description: "Filter by category name",
        },
      },
      required: [],
    },
  },
  {
    name: "create_reservation",
    description:
      "Create a new reservation. Only call this after confirming availability AND collecting all required info: date, time, party size, name, and phone number.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        time: { type: "string", description: "Time in HH:MM format" },
        party_size: { type: "integer", description: "Number of guests" },
        guest_name: { type: "string", description: "Guest's full name" },
        guest_phone: { type: "string", description: "Guest's phone number" },
        guest_email: {
          type: "string",
          description: "Optional email address",
        },
        notes: {
          type: "string",
          description: "Optional special requests or notes",
        },
        seating_preference: {
          type: "string",
          description: "Optional seating preference",
        },
      },
      required: ["date", "time", "party_size", "guest_name", "guest_phone"],
    },
  },
  {
    name: "add_to_waitlist",
    description:
      "Add a guest to the waitlist when no table is available. Use after check_availability returns no tables. Collect name and optionally phone, then call this.",
    input_schema: {
      type: "object" as const,
      properties: {
        guest_name: { type: "string", description: "Guest's full name" },
        guest_phone: {
          type: "string",
          description: "Optional phone number",
        },
        party_size: { type: "integer", description: "Number of guests" },
        seating_preference: {
          type: "string",
          description: "Optional seating preference: patio, bar, etc.",
        },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["guest_name", "party_size"],
    },
  },
  {
    name: "get_guest_by_phone",
    description:
      "Look up a returning guest by phone number. Use when you have the guest's phone to check if they have visited before; if found, you may welcome them back and use their preferences (seating, dietary).",
    input_schema: {
      type: "object" as const,
      properties: {
        guest_phone: {
          type: "string",
          description: "Guest's phone number to look up",
        },
      },
      required: ["guest_phone"],
    },
  },
];

// --- Tool Handlers ---

async function checkAvailability(
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
): Promise<unknown> {
  const { date, time, party_size, seating_preference } = input as {
    date: string;
    time: string;
    party_size: number;
    seating_preference?: string;
  };

  // Load restaurant opening hours
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: context.restaurantId },
    select: { openingHours: true },
  });

  if (!restaurant) {
    return { available: false, reason: "Restaurant not found" };
  }

  const openingHours = restaurant.openingHours as Record<
    string,
    { open: string; close: string } | null
  >;

  // Determine the day of week
  const requestDate = new Date(date + "T12:00:00");
  const dayName = requestDate
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const dayHours = openingHours[dayName];

  if (!dayHours) {
    return {
      available: false,
      reason: `The restaurant is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.`,
      openingHours,
    };
  }

  // Check if time is within opening hours
  const requestMinutes = timeToMinutes(time);
  const openMinutes = timeToMinutes(dayHours.open);
  const closeMinutes = timeToMinutes(dayHours.close);

  if (requestMinutes < openMinutes || requestMinutes >= closeMinutes) {
    return {
      available: false,
      reason: `The restaurant is open from ${dayHours.open} to ${dayHours.close} on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s. The requested time ${time} is outside these hours.`,
    };
  }

  // Try to find a specific table using smart assignment
  const table = await findBestTable({
    restaurantId: context.restaurantId,
    date,
    time,
    partySize: party_size,
    seatingPreference: seating_preference,
  });

  if (table) {
    const tableLabel = table.combinedWithLabel
      ? `${table.label} + ${table.combinedWithLabel}`
      : table.label;
    const capacity = table.combinedCapacity ?? table.maxCapacity;
    return {
      available: true,
      table: {
        label: tableLabel,
        capacity,
        zone: table.zone,
      },
      openHours: `${dayHours.open} – ${dayHours.close}`,
      partySize: party_size,
    };
  }

  // Fallback: check if it's a general capacity issue (for restaurants without tables configured)
  const tableCount = await prisma.restaurantTable.count({
    where: { restaurantId: context.restaurantId, isActive: true },
  });

  if (tableCount === 0) {
    // No tables configured — use legacy concurrent reservation check
    const windowStart = minutesToTime(Math.max(0, requestMinutes - 30));
    const windowEnd = minutesToTime(requestMinutes + 30);

    const existingCount = await prisma.reservation.count({
      where: {
        restaurantId: context.restaurantId,
        date: new Date(date),
        time: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (existingCount >= MAX_CONCURRENT) {
      return {
        available: false,
        reason: `That time slot is fully booked. There are already ${existingCount} reservations around ${time}.`,
      };
    }

    return {
      available: true,
      existingReservations: existingCount,
      openHours: `${dayHours.open} – ${dayHours.close}`,
      partySize: party_size,
    };
  }

  return {
    available: false,
    reason: `No tables available for a party of ${party_size} at ${time}. All suitable tables are booked during that time.`,
  };
}

async function getMenuInfo(
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
): Promise<unknown> {
  const { dietary_filter, search_query, category_name } = input as {
    dietary_filter?: string;
    search_query?: string;
    category_name?: string;
  };

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: context.restaurantId },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const locale = context.locale;

  const result = categories
    .map((cat) => {
      const catName =
        (cat.name as Record<string, string>)[locale] ||
        (cat.name as Record<string, string>).en;

      // Filter by category name if specified
      if (
        category_name &&
        !catName.toLowerCase().includes(category_name.toLowerCase())
      ) {
        return null;
      }

      let items = cat.items.map((item) => {
        const itemName =
          (item.name as Record<string, string>)[locale] ||
          (item.name as Record<string, string>).en;
        const itemDesc = item.description
          ? (item.description as Record<string, string>)[locale] ||
            (item.description as Record<string, string>).en
          : "";

        return {
          name: itemName,
          description: itemDesc,
          price: `€${Number(item.price).toFixed(2)}`,
          dietaryTags: item.dietaryTags,
        };
      });

      // Apply dietary filter
      if (dietary_filter) {
        items = items.filter((item) =>
          item.dietaryTags.some(
            (tag) => tag.toLowerCase() === dietary_filter.toLowerCase()
          )
        );
      }

      // Apply search query
      if (search_query) {
        const q = search_query.toLowerCase();
        items = items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        );
      }

      if (items.length === 0) return null;

      return { category: catName, items };
    })
    .filter(Boolean);

  if (result.length === 0) {
    return { message: "No menu items found matching your criteria." };
  }

  return { menu: result };
}

async function createReservation(
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
): Promise<unknown> {
  const { date, time, party_size, guest_name, guest_phone, guest_email, notes, seating_preference } =
    input as {
      date: string;
      time: string;
      party_size: number;
      guest_name: string;
      guest_phone: string;
      guest_email?: string;
      notes?: string;
      seating_preference?: string;
    };

  // Re-validate availability and get table assignment
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: context.restaurantId },
    select: { openingHours: true },
  });

  if (!restaurant) {
    return { success: false, error: "Restaurant not found." };
  }

  // Try to assign a specific table
  const table = await findBestTable({
    restaurantId: context.restaurantId,
    date,
    time,
    partySize: party_size,
    seatingPreference: seating_preference,
  });

  // Check if tables are configured but none available
  const tableCount = await prisma.restaurantTable.count({
    where: { restaurantId: context.restaurantId, isActive: true },
  });

  if (tableCount > 0 && !table) {
    return {
      success: false,
      error: "No tables available for this party size at the requested time.",
    };
  }

  const guest = await findOrCreateGuest({
    restaurantId: context.restaurantId,
    name: guest_name.trim(),
    phone: (guest_phone ?? "").trim() || null,
    email: (guest_email ?? "").trim() || null,
    seatingPreference: seating_preference || null,
  });

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId: context.restaurantId,
      date: new Date(date),
      time,
      partySize: party_size,
      guestName: guest_name,
      guestPhone: guest_phone,
      guestEmail: guest_email || null,
      notes: notes || null,
      source: "ai_assistant",
      tableId: table?.id || null,
      combinedWithTableId: table?.combinedWithTableId || null,
      seatingPreference: seating_preference || null,
      guestId: guest?.id ?? null,
    },
  });

  // Do not return table assignment to the guest; it is for internal use only.
  return {
    success: true,
    reservation: {
      id: reservation.id,
      date: date,
      time: reservation.time,
      partySize: reservation.partySize,
      guestName: reservation.guestName,
      status: reservation.status,
    },
  };
}

async function addToWaitlist(
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
): Promise<unknown> {
  const { guest_name, guest_phone, party_size, seating_preference, notes } = input as {
    guest_name: string;
    guest_phone?: string;
    party_size: number;
    seating_preference?: string;
    notes?: string;
  };

  const estimatedWaitMin = await estimateWaitMinutes(context.restaurantId, party_size);

  await prisma.waitlistEntry.create({
    data: {
      restaurantId: context.restaurantId,
      guestName: guest_name.trim(),
      guestPhone: guest_phone?.trim() || null,
      partySize: party_size,
      seatingPref: seating_preference?.trim() || null,
      notes: notes?.trim() || null,
      status: "WAITING",
      estimatedWaitMin: estimatedWaitMin ?? null,
    },
  });

  const waitMessage =
    estimatedWaitMin != null
      ? ` Estimated wait: about ${estimatedWaitMin} minutes.`
      : "";
  return {
    success: true,
    message: `Added ${guest_name} to the waitlist for ${party_size} guests.${waitMessage}`,
    estimatedWaitMin: estimatedWaitMin ?? undefined,
  };
}

async function getGuestByPhone(
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
): Promise<unknown> {
  const { guest_phone } = input as { guest_phone: string };
  const phone = (guest_phone ?? "").trim();
  if (!phone) return { found: false, guest: null };
  const guest = await findGuestByPhone(context.restaurantId, phone);
  if (!guest)
    return { found: false, guest: null };
  return {
    found: true,
    guest: {
      name: guest.name,
      totalVisits: guest.totalVisits,
      noShowCount: guest.noShowCount,
      seatingPreference: guest.seatingPreference,
      dietaryRestrictions: guest.dietaryRestrictions,
      tags: guest.tags,
      lastVisitAt: guest.lastVisitAt?.toISOString() ?? null,
    },
  };
}

// --- Handler Map ---

export const toolHandlers: Record<string, ToolHandler> = {
  check_availability: checkAvailability,
  get_menu_info: getMenuInfo,
  create_reservation: createReservation,
  add_to_waitlist: addToWaitlist,
  get_guest_by_phone: getGuestByPhone,
};

// --- Helpers ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
