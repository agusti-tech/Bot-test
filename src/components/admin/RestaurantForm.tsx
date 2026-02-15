"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { updateRestaurant } from "@/app/[locale]/admin/actions";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

interface RestaurantFormProps {
  restaurant: {
    id: string;
    slug: string;
    name: { en: string; de: string };
    description: { en: string; de: string };
    address: string;
    phone: string | null;
    email: string | null;
    openingHours: Record<string, { open: string; close: string } | null>;
  };
}

export default function RestaurantForm({ restaurant }: RestaurantFormProps) {
  const t = useTranslations("admin");
  const tDays = useTranslations("days");
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(restaurant.openingHours);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("openingHours", JSON.stringify(hours));

    try {
      await updateRestaurant(formData);
      toast.success(t("saved"));
    } catch {
      toast.error("Error saving changes");
    } finally {
      setLoading(false);
    }
  }

  function updateHours(
    day: string,
    field: "open" | "close",
    value: string
  ) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day]
        ? { ...prev[day]!, [field]: value }
        : { open: value, close: value },
    }));
  }

  function toggleDay(day: string) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: "09:00", close: "22:00" },
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle>{t("restaurantName")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name_en">{t("english")}</Label>
            <Input
              id="name_en"
              name="name_en"
              defaultValue={restaurant.name.en}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_de">{t("german")}</Label>
            <Input
              id="name_de"
              name="name_de"
              defaultValue={restaurant.name.de}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>{t("restaurantDescription")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="description_en">{t("english")}</Label>
            <Textarea
              id="description_en"
              name="description_en"
              defaultValue={restaurant.description.en}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description_de">{t("german")}</Label>
            <Textarea
              id="description_de"
              name="description_de"
              defaultValue={restaurant.description.de}
              rows={3}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>{t("restaurantAddress")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">{t("restaurantAddress")}</Label>
            <Input
              id="address"
              name="address"
              defaultValue={restaurant.address}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("restaurantPhone")}</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={restaurant.phone || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("restaurantEmail")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={restaurant.email || ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening Hours */}
      <Card>
        <CardHeader>
          <CardTitle>{t("openingHours")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const dayHours = hours[day];
            return (
              <div key={day} className="flex items-center gap-4">
                <label className="flex items-center gap-2 w-32">
                  <input
                    type="checkbox"
                    checked={dayHours !== null}
                    onChange={() => toggleDay(day)}
                    className="rounded"
                  />
                  <span className="text-sm">{tDays(day)}</span>
                </label>
                {dayHours ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayHours.open}
                      onChange={(e) =>
                        updateHours(day, "open", e.target.value)
                      }
                      className="w-32"
                    />
                    <span>–</span>
                    <Input
                      type="time"
                      value={dayHours.close}
                      onChange={(e) =>
                        updateHours(day, "close", e.target.value)
                      }
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Closed
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}>
        {loading ? "..." : t("saveChanges")}
      </Button>
    </form>
  );
}
