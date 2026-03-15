import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OWNER_EMAIL = "owner@haus-mueller.de";
const OWNER_PASSWORD = "owner123";

async function main() {
  const slug = "haus-mueller";
  const existing = await prisma.restaurant.findUnique({
    where: { slug },
  });

  if (existing) {
    const ownerPassword = await bcrypt.hash(OWNER_PASSWORD, 12);
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
    });
    if (!owner) {
      console.log("Haus Müller exists but owner missing. Creating owner...");
      await prisma.user.create({
        data: {
          email: OWNER_EMAIL,
          hashedPassword: ownerPassword,
          name: "Haus Müller",
          role: "OWNER",
          restaurantId: existing.id,
        },
      });
    } else {
      await prisma.user.update({
        where: { email: OWNER_EMAIL },
        data: { hashedPassword: ownerPassword },
      });
      console.log("Haus Müller owner password reset.");
    }
    console.log("Owner login: " + OWNER_EMAIL + " / " + OWNER_PASSWORD);
    return;
  }

  console.log("Seeding Haus Müller...");

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name: { en: "Haus Müller", de: "Haus Müller" },
      description: {
        en: "German cuisine at its best — seasonal, with a large vegetarian and vegan selection. Attentive service and one of the finest atmospheres in Cologne's Südstadt. Outdoor terrace, wine and craft beer. Reserve a table and taste Ceviche, Wiener Schnitzel, fillet steak, or Crème Brûlée.",
        de: "Die deutsche Küche wird im Haus Müller gut gekocht — saisonal, mit großer vegetarischer und veganer Auswahl. Aufmerksamer Service und eines der schönsten Ambientes der Kölner Südstadt. Außenterrasse, Wein und Bier. Reservieren Sie und kosten Sie Ceviche, Wiener Schnitzel, Filetsteak oder Crème Brûlée.",
      },
      address: "Achterstraße 2, 50678 Köln",
      phone: "+49 221 9321086",
      email: "info@haus-mueller-koeln.de",
      openingHours: {
        monday: { open: "17:00", close: "00:00" },
        tuesday: { open: "17:00", close: "00:00" },
        wednesday: { open: "17:00", close: "00:00" },
        thursday: { open: "17:00", close: "00:00" },
        friday: { open: "17:00", close: "00:00" },
        saturday: { open: "17:00", close: "00:00" },
        sunday: { open: "17:00", close: "00:00" },
      },
      isActive: true,
      settings: {
        siteTier: "premium",
        instagram: "hausmueller",
        ratings: { google: "4.5", opentable: "4.7" },
      } as object,
    },
  });

  const vorspeisen = await prisma.menuCategory.create({
    data: {
      name: { en: "Starters", de: "Vorspeisen" },
      sortOrder: 0,
      restaurantId: restaurant.id,
    },
  });

  const hauptgange = await prisma.menuCategory.create({
    data: {
      name: { en: "Main Courses", de: "Hauptgänge" },
      sortOrder: 1,
      restaurantId: restaurant.id,
    },
  });

  const desserts = await prisma.menuCategory.create({
    data: {
      name: { en: "Desserts", de: "Desserts" },
      sortOrder: 2,
      restaurantId: restaurant.id,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: { en: "Rinderfilet Tatar", de: "Rinderfilet Tatar" },
        description: { en: "Trüffel-Mayo, Kapern, Eigelb, Brioche. Signature.", de: "Trüffel-Mayo, Kapern, Eigelb, Brioche. Signature." },
        price: 18,
        dietaryTags: [],
        sortOrder: 0,
        categoryId: vorspeisen.id,
      },
      {
        name: { en: "Mango-Avocado Tatar", de: "Mango-Avocado Tatar" },
        description: { en: "Limette, Koriander, Sesam-Cracker", de: "Limette, Koriander, Sesam-Cracker" },
        price: 16,
        dietaryTags: ["vegan"],
        sortOrder: 1,
        categoryId: vorspeisen.id,
      },
      {
        name: { en: "Gebratene Wachtelbrust", de: "Gebratene Wachtelbrust" },
        description: { en: "Nussbutter-Püree, Bärlauch-Schaum. Chef's choice.", de: "Nussbutter-Püree, Bärlauch-Schaum. Chef's choice." },
        price: 14,
        dietaryTags: [],
        sortOrder: 2,
        categoryId: vorspeisen.id,
      },
      {
        name: { en: "Rote Bete Variation", de: "Rote Bete Variation" },
        description: { en: "Ziegenkäse, Walnuss, Honig-Dressing", de: "Ziegenkäse, Walnuss, Honig-Dressing" },
        price: 13,
        dietaryTags: ["vegetarian"],
        sortOrder: 3,
        categoryId: vorspeisen.id,
      },
      {
        name: { en: "Ceviche", de: "Ceviche" },
        description: { en: "Fresh fish, lime, red onion, cilantro. A house favourite.", de: "Frischer Fisch, Limette, rote Zwiebel, Koriander. Ein Hausklassiker." },
        price: 15,
        dietaryTags: [],
        sortOrder: 4,
        categoryId: vorspeisen.id,
      },
      {
        name: { en: "Ochsenbacke geschmort", de: "Ochsenbacke geschmort" },
        description: { en: "Kartoffelpüree, Wurzelgemüse, Rotwein-Jus. House classic.", de: "Kartoffelpüree, Wurzelgemüse, Rotwein-Jus. Hausklassiker." },
        price: 32,
        dietaryTags: [],
        sortOrder: 0,
        categoryId: hauptgange.id,
      },
      {
        name: { en: "Schweinebacke", de: "Schweinebacke" },
        description: { en: "Wasabi-Kartoffelpüree, asiatische Gemüse", de: "Wasabi-Kartoffelpüree, asiatische Gemüse" },
        price: 28,
        dietaryTags: [],
        sortOrder: 1,
        categoryId: hauptgange.id,
      },
      {
        name: { en: "Wolfsbarsch", de: "Wolfsbarsch" },
        description: { en: "Safran-Risotto, Fenchel, Zitronenbutter", de: "Safran-Risotto, Fenchel, Zitronenbutter" },
        price: 36,
        dietaryTags: [],
        sortOrder: 2,
        categoryId: hauptgange.id,
      },
      {
        name: { en: "Entenbrust", de: "Entenbrust" },
        description: { en: "Süßkartoffel, Rotkohl, Orangenreduktion. Seasonal.", de: "Süßkartoffel, Rotkohl, Orangenreduktion. Saisonal." },
        price: 34,
        dietaryTags: [],
        sortOrder: 3,
        categoryId: hauptgange.id,
      },
      {
        name: { en: "Wiener Schnitzel", de: "Wiener Schnitzel" },
        description: { en: "Classic veal schnitzel, potato salad or fries. German favourite.", de: "Klassisches Kalbsschnitzel, Kartoffelsalat oder Pommes. Ein Klassiker." },
        price: 26,
        dietaryTags: [],
        sortOrder: 4,
        categoryId: hauptgange.id,
      },
      {
        name: { en: "Crème Brûlée", de: "Crème Brûlée" },
        description: { en: "Klassisch, mit Tonkabohne verfeinert", de: "Klassisch, mit Tonkabohne verfeinert" },
        price: 10,
        dietaryTags: ["vegetarian"],
        sortOrder: 0,
        categoryId: desserts.id,
      },
      {
        name: { en: "Schokoladenmoelleux", de: "Schokoladenmoelleux" },
        description: { en: "Flüssiger Kern, Vanilleeis, Kakaonibs. House classic.", de: "Flüssiger Kern, Vanilleeis, Kakaonibs. Hausklassiker." },
        price: 12,
        dietaryTags: ["vegetarian"],
        sortOrder: 1,
        categoryId: desserts.id,
      },
      {
        name: { en: "Käseauswahl", de: "Käseauswahl" },
        description: { en: "Drei deutsche Käse, Feigensenf, Nüsse", de: "Drei deutsche Käse, Feigensenf, Nüsse" },
        price: 14,
        dietaryTags: ["vegetarian"],
        sortOrder: 2,
        categoryId: desserts.id,
      },
      {
        name: { en: "Sorbet der Saison", de: "Sorbet der Saison" },
        description: { en: "Je nach Verfügbarkeit, täglich frisch", de: "Je nach Verfügbarkeit, täglich frisch" },
        price: 9,
        dietaryTags: ["vegan"],
        sortOrder: 3,
        categoryId: desserts.id,
      },
    ],
  });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  await prisma.restaurantTokenAccount.create({
    data: {
      restaurantId: restaurant.id,
      balance: 100,
      allowanceMonthly: 100,
      periodStartsAt: periodStart,
    },
  });

  const ownerPassword = await bcrypt.hash(OWNER_PASSWORD, 12);
  await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      hashedPassword: ownerPassword,
      name: "Haus Müller",
      role: "OWNER",
      restaurantId: restaurant.id,
    },
  });

  console.log("Created Haus Müller:", restaurant.slug);
  console.log("Public page: /en/restaurants/haus-mueller or /de/restaurants/haus-mueller");
  console.log("Owner login: " + OWNER_EMAIL + " / " + OWNER_PASSWORD);
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
