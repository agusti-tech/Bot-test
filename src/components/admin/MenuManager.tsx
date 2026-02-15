"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "@/app/[locale]/admin/actions";

interface MenuItem {
  id: string;
  name: { en: string; de: string };
  description: { en: string; de: string } | null;
  price: string | number;
  dietaryTags: string[];
  isAvailable: boolean;
  sortOrder: number;
  categoryId: string;
}

interface Category {
  id: string;
  name: { en: string; de: string };
  sortOrder: number;
  items: MenuItem[];
}

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "halal",
  "kosher",
  "dairy-free",
  "nut-free",
];

export default function MenuManager({
  categories: initialCategories,
}: {
  categories: Category[];
}) {
  const t = useTranslations("admin");
  const tMenu = useTranslations("menu");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState<string | null>(null);
  const [editItemOpen, setEditItemOpen] = useState<MenuItem | null>(null);

  async function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createCategory(formData);
      setAddCategoryOpen(false);
      toast.success(t("saved"));
    } catch {
      toast.error("Error");
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteCategory(id);
      toast.success(t("saved"));
    } catch {
      toast.error("Error");
    }
  }

  async function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createMenuItem(formData);
      setAddItemOpen(null);
      toast.success(t("saved"));
    } catch {
      toast.error("Error");
    }
  }

  async function handleEditItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editItemOpen) return;
    const formData = new FormData(e.currentTarget);
    try {
      await updateMenuItem(editItemOpen.id, formData);
      setEditItemOpen(null);
      toast.success(t("saved"));
    } catch {
      toast.error("Error");
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteMenuItem(id);
      toast.success(t("saved"));
    } catch {
      toast.error("Error");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Add Category Button */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addCategory")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addCategory")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("english")}</Label>
                <Input name="name_en" required placeholder="e.g. Appetizers" />
              </div>
              <div className="space-y-2">
                <Label>{t("german")}</Label>
                <Input name="name_de" required placeholder="z.B. Vorspeisen" />
              </div>
            </div>
            <Button type="submit">{t("saveChanges")}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Categories and Items */}
      {initialCategories.map((category) => (
        <Card key={category.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{category.name.en} / {category.name.de}</CardTitle>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("editCategory")}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      try {
                        await updateCategory(category.id, formData);
                        toast.success(t("saved"));
                      } catch {
                        toast.error("Error");
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("english")}</Label>
                        <Input
                          name="name_en"
                          defaultValue={category.name.en}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("german")}</Label>
                        <Input
                          name="name_de"
                          defaultValue={category.name.de}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit">{t("saveChanges")}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteCategory(category.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border rounded-md p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {item.name.en} / {item.name.de}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPrice(item.price)}
                      {!item.isAvailable && (
                        <span className="ml-2 text-destructive">
                          ({tMenu("unavailable")})
                        </span>
                      )}
                    </div>
                    {item.dietaryTags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.dietaryTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditItemOpen(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add Item Button */}
              <Dialog
                open={addItemOpen === category.id}
                onOpenChange={(open) =>
                  setAddItemOpen(open ? category.id : null)
                }
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 mt-2">
                    <Plus className="h-4 w-4" />
                    {t("addItem")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t("addItem")}</DialogTitle>
                  </DialogHeader>
                  <MenuItemForm
                    categoryId={category.id}
                    onSubmit={handleAddItem}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editItemOpen}
        onOpenChange={(open) => !open && setEditItemOpen(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editItem")}</DialogTitle>
          </DialogHeader>
          {editItemOpen && (
            <MenuItemForm
              categoryId={editItemOpen.categoryId}
              item={editItemOpen}
              onSubmit={handleEditItem}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuItemForm({
  categoryId,
  item,
  onSubmit,
}: {
  categoryId: string;
  item?: MenuItem;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const t = useTranslations("admin");
  const tMenu = useTranslations("menu");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    item?.dietaryTags || []
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="dietaryTags" value={selectedTags.join(",")} />
      <input
        type="hidden"
        name="isAvailable"
        value={item?.isAvailable !== false ? "true" : "false"}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("itemName")} ({t("english")})</Label>
          <Input
            name="name_en"
            defaultValue={item?.name.en || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{t("itemName")} ({t("german")})</Label>
          <Input
            name="name_de"
            defaultValue={item?.name.de || ""}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("itemDescription")} ({t("english")})</Label>
          <Input
            name="description_en"
            defaultValue={item?.description?.en || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("itemDescription")} ({t("german")})</Label>
          <Input
            name="description_de"
            defaultValue={item?.description?.de || ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("itemPrice")} (EUR)</Label>
        <Input
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={item ? String(item.price) : ""}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("dietaryTags")}</Label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tMenu(`dietary.${tag}` as Parameters<typeof tMenu>[0])}
            </Badge>
          ))}
        </div>
      </div>

      {item && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isAvailable"
            name="isAvailable"
            defaultChecked={item.isAvailable}
            onChange={(e) => {
              const hidden = e.currentTarget.form?.querySelector(
                'input[name="isAvailable"][type="hidden"]'
              ) as HTMLInputElement;
              if (hidden) hidden.value = e.target.checked ? "true" : "false";
            }}
          />
          <Label htmlFor="isAvailable">{t("availability")}</Label>
        </div>
      )}

      <Button type="submit">{t("saveChanges")}</Button>
    </form>
  );
}
