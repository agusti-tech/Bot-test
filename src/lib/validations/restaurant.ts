import { z } from "zod";

const translatableField = z.object({
  en: z.string().min(1, "English text is required"),
  de: z.string().min(1, "German text is required"),
});

const translatableFieldOptional = z
  .object({
    en: z.string(),
    de: z.string(),
  })
  .optional()
  .nullable();

const openingHoursDay = z
  .object({
    open: z.string(),
    close: z.string(),
  })
  .nullable();

export const restaurantSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  name: translatableField,
  description: translatableField,
  address: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  openingHours: z.object({
    monday: openingHoursDay,
    tuesday: openingHoursDay,
    wednesday: openingHoursDay,
    thursday: openingHoursDay,
    friday: openingHoursDay,
    saturday: openingHoursDay,
    sunday: openingHoursDay,
  }),
  logoUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: translatableField,
  sortOrder: z.number().int().min(0).optional(),
  restaurantId: z.string().min(1),
});

export const menuItemSchema = z.object({
  name: translatableField,
  description: translatableFieldOptional,
  price: z.number().positive("Price must be greater than 0"),
  imageUrl: z.string().url().optional().nullable(),
  dietaryTags: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  categoryId: z.string().min(1),
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
