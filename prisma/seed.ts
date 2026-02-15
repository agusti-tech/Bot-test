import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create super admin
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@restaurant-app.local" },
    update: {},
    create: {
      email: "admin@restaurant-app.local",
      hashedPassword,
      name: "Super Admin",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Created super admin:", admin.email);

  // Create sample restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "bella-italia" },
    update: {},
    create: {
      slug: "bella-italia",
      name: { en: "Bella Italia", de: "Bella Italia" },
      description: {
        en: "Authentic Italian cuisine in the heart of the city. Fresh pasta, wood-fired pizza, and homemade desserts.",
        de: "Authentische italienische Küche im Herzen der Stadt. Frische Pasta, holzofengebackene Pizza und hausgemachte Desserts.",
      },
      address: "Hauptstraße 42, 10115 Berlin",
      phone: "+49 30 1234567",
      email: "info@bella-italia.de",
      openingHours: {
        monday: { open: "11:00", close: "22:00" },
        tuesday: { open: "11:00", close: "22:00" },
        wednesday: { open: "11:00", close: "22:00" },
        thursday: { open: "11:00", close: "23:00" },
        friday: { open: "11:00", close: "23:00" },
        saturday: { open: "12:00", close: "23:00" },
        sunday: { open: "12:00", close: "21:00" },
      },
      isActive: true,
    },
  });

  console.log("Created restaurant:", restaurant.slug);

  // Create restaurant owner
  const ownerPassword = await bcrypt.hash("owner123", 12);
  const owner = await prisma.user.upsert({
    where: { email: "owner@bella-italia.de" },
    update: {},
    create: {
      email: "owner@bella-italia.de",
      hashedPassword: ownerPassword,
      name: "Marco Rossi",
      role: "OWNER",
      restaurantId: restaurant.id,
    },
  });

  console.log("Created owner:", owner.email);

  // Create menu categories
  const appetizers = await prisma.menuCategory.create({
    data: {
      name: { en: "Appetizers", de: "Vorspeisen" },
      sortOrder: 0,
      restaurantId: restaurant.id,
    },
  });

  const pasta = await prisma.menuCategory.create({
    data: {
      name: { en: "Pasta", de: "Pasta" },
      sortOrder: 1,
      restaurantId: restaurant.id,
    },
  });

  const pizza = await prisma.menuCategory.create({
    data: {
      name: { en: "Pizza", de: "Pizza" },
      sortOrder: 2,
      restaurantId: restaurant.id,
    },
  });

  const desserts = await prisma.menuCategory.create({
    data: {
      name: { en: "Desserts", de: "Desserts" },
      sortOrder: 3,
      restaurantId: restaurant.id,
    },
  });

  const drinks = await prisma.menuCategory.create({
    data: {
      name: { en: "Drinks", de: "Getränke" },
      sortOrder: 4,
      restaurantId: restaurant.id,
    },
  });

  // Create menu items
  await prisma.menuItem.createMany({
    data: [
      // Appetizers
      {
        name: { en: "Bruschetta", de: "Bruschetta" },
        description: {
          en: "Toasted bread with fresh tomatoes, garlic, and basil",
          de: "Geröstetes Brot mit frischen Tomaten, Knoblauch und Basilikum",
        },
        price: 8.5,
        dietaryTags: ["vegetarian"],
        sortOrder: 0,
        categoryId: appetizers.id,
      },
      {
        name: { en: "Caprese Salad", de: "Caprese-Salat" },
        description: {
          en: "Fresh mozzarella, tomatoes, and basil with olive oil",
          de: "Frischer Mozzarella, Tomaten und Basilikum mit Olivenöl",
        },
        price: 10.9,
        dietaryTags: ["vegetarian", "gluten-free"],
        sortOrder: 1,
        categoryId: appetizers.id,
      },
      {
        name: { en: "Minestrone Soup", de: "Minestrone-Suppe" },
        description: {
          en: "Traditional Italian vegetable soup",
          de: "Traditionelle italienische Gemüsesuppe",
        },
        price: 7.5,
        dietaryTags: ["vegan"],
        sortOrder: 2,
        categoryId: appetizers.id,
      },
      // Pasta
      {
        name: { en: "Spaghetti Carbonara", de: "Spaghetti Carbonara" },
        description: {
          en: "Classic carbonara with guanciale, egg, and pecorino",
          de: "Klassische Carbonara mit Guanciale, Ei und Pecorino",
        },
        price: 14.9,
        dietaryTags: [],
        sortOrder: 0,
        categoryId: pasta.id,
      },
      {
        name: { en: "Penne Arrabbiata", de: "Penne Arrabbiata" },
        description: {
          en: "Penne with spicy tomato sauce and garlic",
          de: "Penne mit scharfer Tomatensauce und Knoblauch",
        },
        price: 12.5,
        dietaryTags: ["vegan"],
        sortOrder: 1,
        categoryId: pasta.id,
      },
      {
        name: {
          en: "Tagliatelle al Ragù",
          de: "Tagliatelle al Ragù",
        },
        description: {
          en: "Fresh tagliatelle with slow-cooked Bolognese sauce",
          de: "Frische Tagliatelle mit langsam gekochter Bolognese-Sauce",
        },
        price: 15.9,
        dietaryTags: [],
        sortOrder: 2,
        categoryId: pasta.id,
      },
      // Pizza
      {
        name: { en: "Margherita", de: "Margherita" },
        description: {
          en: "Tomato sauce, mozzarella, and fresh basil",
          de: "Tomatensauce, Mozzarella und frischer Basilikum",
        },
        price: 11.5,
        dietaryTags: ["vegetarian"],
        sortOrder: 0,
        categoryId: pizza.id,
      },
      {
        name: { en: "Diavola", de: "Diavola" },
        description: {
          en: "Tomato sauce, mozzarella, and spicy salami",
          de: "Tomatensauce, Mozzarella und scharfe Salami",
        },
        price: 13.9,
        dietaryTags: [],
        sortOrder: 1,
        categoryId: pizza.id,
      },
      {
        name: {
          en: "Quattro Formaggi",
          de: "Quattro Formaggi",
        },
        description: {
          en: "Four cheese pizza with mozzarella, gorgonzola, parmesan, and fontina",
          de: "Vier-Käse-Pizza mit Mozzarella, Gorgonzola, Parmesan und Fontina",
        },
        price: 14.5,
        dietaryTags: ["vegetarian"],
        sortOrder: 2,
        categoryId: pizza.id,
      },
      // Desserts
      {
        name: { en: "Tiramisu", de: "Tiramisu" },
        description: {
          en: "Classic Italian dessert with mascarpone and espresso",
          de: "Klassisches italienisches Dessert mit Mascarpone und Espresso",
        },
        price: 8.9,
        dietaryTags: ["vegetarian"],
        sortOrder: 0,
        categoryId: desserts.id,
      },
      {
        name: { en: "Panna Cotta", de: "Panna Cotta" },
        description: {
          en: "Vanilla panna cotta with berry sauce",
          de: "Vanille-Panna-Cotta mit Beerensauce",
        },
        price: 7.5,
        dietaryTags: ["vegetarian", "gluten-free"],
        sortOrder: 1,
        categoryId: desserts.id,
      },
      // Drinks
      {
        name: { en: "Sparkling Water", de: "Sprudelwasser" },
        description: {
          en: "750ml bottle",
          de: "750ml Flasche",
        },
        price: 3.5,
        dietaryTags: ["vegan", "gluten-free"],
        sortOrder: 0,
        categoryId: drinks.id,
      },
      {
        name: { en: "House Wine (Red)", de: "Hauswein (Rot)" },
        description: {
          en: "Glass of Italian red wine",
          de: "Glas italienischer Rotwein",
        },
        price: 6.5,
        dietaryTags: ["vegan", "gluten-free"],
        sortOrder: 1,
        categoryId: drinks.id,
      },
      {
        name: { en: "Espresso", de: "Espresso" },
        description: {
          en: "Traditional Italian espresso",
          de: "Traditioneller italienischer Espresso",
        },
        price: 2.9,
        dietaryTags: ["vegan", "gluten-free"],
        sortOrder: 2,
        categoryId: drinks.id,
      },
    ],
  });

  console.log("Created menu items");

  // Create a second sample restaurant
  const restaurant2 = await prisma.restaurant.upsert({
    where: { slug: "zum-goldenen-hirsch" },
    update: {},
    create: {
      slug: "zum-goldenen-hirsch",
      name: { en: "The Golden Deer", de: "Zum Goldenen Hirsch" },
      description: {
        en: "Traditional German cuisine with a modern twist. Hearty dishes and local beers in a cozy atmosphere.",
        de: "Traditionelle deutsche Küche mit modernem Twist. Herzhafte Gerichte und lokale Biere in gemütlicher Atmosphäre.",
      },
      address: "Schillerstraße 15, 80336 München",
      phone: "+49 89 9876543",
      email: "info@goldener-hirsch.de",
      openingHours: {
        monday: null,
        tuesday: { open: "11:30", close: "22:00" },
        wednesday: { open: "11:30", close: "22:00" },
        thursday: { open: "11:30", close: "22:00" },
        friday: { open: "11:30", close: "23:00" },
        saturday: { open: "11:30", close: "23:00" },
        sunday: { open: "11:30", close: "21:00" },
      },
      isActive: true,
    },
  });

  console.log("Created restaurant:", restaurant2.slug);

  const mainCourses = await prisma.menuCategory.create({
    data: {
      name: { en: "Main Courses", de: "Hauptgerichte" },
      sortOrder: 0,
      restaurantId: restaurant2.id,
    },
  });

  const sides = await prisma.menuCategory.create({
    data: {
      name: { en: "Sides", de: "Beilagen" },
      sortOrder: 1,
      restaurantId: restaurant2.id,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: { en: "Wiener Schnitzel", de: "Wiener Schnitzel" },
        description: {
          en: "Breaded veal cutlet with potato salad",
          de: "Paniertes Kalbsschnitzel mit Kartoffelsalat",
        },
        price: 18.9,
        dietaryTags: [],
        sortOrder: 0,
        categoryId: mainCourses.id,
      },
      {
        name: { en: "Sauerbraten", de: "Sauerbraten" },
        description: {
          en: "Marinated pot roast with red cabbage and potato dumplings",
          de: "Marinierter Schmorbraten mit Rotkohl und Kartoffelklößen",
        },
        price: 19.5,
        dietaryTags: [],
        sortOrder: 1,
        categoryId: mainCourses.id,
      },
      {
        name: { en: "Pretzel", de: "Brezel" },
        description: {
          en: "Bavarian pretzel with butter",
          de: "Bayerische Brezel mit Butter",
        },
        price: 4.5,
        dietaryTags: ["vegetarian"],
        sortOrder: 0,
        categoryId: sides.id,
      },
    ],
  });

  console.log("Created menu items for second restaurant");
  console.log("\n--- Seed complete ---");
  console.log("Admin login: admin@restaurant-app.local / admin123");
  console.log("Owner login: owner@bella-italia.de / owner123");
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
