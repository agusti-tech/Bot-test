"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTable,
  updateTable,
  deleteTable,
} from "@/app/[locale]/admin/(dashboard)/actions";
import { toast } from "sonner";

interface RestaurantTable {
  id: string;
  label: string;
  minCapacity: number;
  maxCapacity: number;
  shape: string;
  zone: string | null;
  isActive: boolean;
  isCombinable: boolean;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  sortOrder: number;
}

interface TableManagerProps {
  tables: RestaurantTable[];
}

interface TableFormData {
  label: string;
  minCapacity: number;
  maxCapacity: number;
  shape: string;
  zone: string;
  isCombinable: boolean;
}

const SHAPES = ["ROUND", "SQUARE", "RECTANGLE", "BOOTH"] as const;

const SHAPE_COLORS: Record<string, string> = {
  ROUND:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  SQUARE:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  RECTANGLE:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  BOOTH:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

const defaultFormData: TableFormData = {
  label: "",
  minCapacity: 1,
  maxCapacity: 4,
  shape: "RECTANGLE",
  zone: "",
  isCombinable: false,
};

export default function TableManager({ tables }: TableManagerProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(
    null
  );
  const [deletingTable, setDeletingTable] = useState<RestaurantTable | null>(
    null
  );
  const [formData, setFormData] = useState<TableFormData>(defaultFormData);

  // Stats
  const totalTables = tables.length;
  const activeTables = tables.filter((t) => t.isActive).length;
  const totalCapacity = tables
    .filter((t) => t.isActive)
    .reduce((sum, t) => sum + t.maxCapacity, 0);

  function openCreateDialog() {
    setEditingTable(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  }

  function openEditDialog(table: RestaurantTable) {
    setEditingTable(table);
    setFormData({
      label: table.label,
      minCapacity: table.minCapacity,
      maxCapacity: table.maxCapacity,
      shape: table.shape,
      zone: table.zone || "",
      isCombinable: table.isCombinable,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(table: RestaurantTable) {
    setDeletingTable(table);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.label.trim()) return;
    if (formData.maxCapacity < 1) return;

    try {
      if (editingTable) {
        const result = await updateTable(editingTable.id, {
          label: formData.label,
          minCapacity: formData.minCapacity,
          maxCapacity: formData.maxCapacity,
          shape: formData.shape,
          zone: formData.zone,
          isCombinable: formData.isCombinable,
          isActive: editingTable.isActive,
        });
        if (result.success) {
          toast.success(t("saved"));
        }
      } else {
        const result = await createTable({
          label: formData.label,
          minCapacity: formData.minCapacity,
          maxCapacity: formData.maxCapacity,
          shape: formData.shape,
          zone: formData.zone,
          isCombinable: formData.isCombinable,
        });
        if (result.success) {
          toast.success(t("saved"));
        }
      }
      setDialogOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error(t("error") || "Failed to save table");
    }
  }

  async function handleToggleActive(table: RestaurantTable) {
    try {
      const result = await updateTable(table.id, {
        label: table.label,
        minCapacity: table.minCapacity,
        maxCapacity: table.maxCapacity,
        shape: table.shape,
        zone: table.zone || "",
        isCombinable: table.isCombinable,
        isActive: !table.isActive,
      });
      if (result.success) {
        toast.success(t("saved"));
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error(t("error") || "Failed to update table");
    }
  }

  async function handleDelete() {
    if (!deletingTable) return;
    try {
      const result = await deleteTable(deletingTable.id);
      if (result.success) {
        toast.success(t("saved"));
        setDeleteDialogOpen(false);
        setDeletingTable(null);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error(t("error") || "Failed to delete table");
    }
  }

  function getShapeLabel(shape: string) {
    const map: Record<string, string> = {
      ROUND: t("round"),
      SQUARE: t("square"),
      RECTANGLE: t("rectangle"),
      BOOTH: t("booth"),
    };
    return map[shape] || shape;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalTables}</div>
            <div className="text-sm text-muted-foreground">
              {t("totalTables")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{activeTables}</div>
            <div className="text-sm text-muted-foreground">
              {t("activeTables")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalCapacity}</div>
            <div className="text-sm text-muted-foreground">
              {t("totalCapacity")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={openCreateDialog} disabled={isPending}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addTable")}
        </Button>
      </div>

      {/* Table List */}
      {tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <UtensilsCrossed className="h-16 w-16 mb-4" />
            <p className="text-lg">{t("noTables")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tableLabel")}</TableHead>
                  <TableHead>{t("capacity")}</TableHead>
                  <TableHead>{t("shape")}</TableHead>
                  <TableHead>{t("zone")}</TableHead>
                  <TableHead>{t("active")}</TableHead>
                  <TableHead>{t("combinable")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">
                      {table.label}
                    </TableCell>
                    <TableCell>
                      {table.minCapacity}–{table.maxCapacity}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={SHAPE_COLORS[table.shape] || ""}
                      >
                        {getShapeLabel(table.shape)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {table.zone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          table.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-pointer"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 cursor-pointer"
                        }
                        onClick={() => handleToggleActive(table)}
                      >
                        {table.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {table.isCombinable ? (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {t("yes")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("no")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(table)}
                          disabled={isPending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(table)}
                          disabled={isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTable ? t("editTable") : t("addTable")}
            </DialogTitle>
            <DialogDescription>
              {editingTable
                ? t("editTableDescription")
                : t("addTableDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="table-label">{t("tableLabel")}</Label>
              <Input
                id="table-label"
                value={formData.label}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="T1, Bar 3, Patio 2..."
                required
              />
            </div>

            {/* Capacity Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-capacity">{t("minCapacity")}</Label>
                <Input
                  id="min-capacity"
                  type="number"
                  min={1}
                  value={formData.minCapacity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minCapacity: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-capacity">{t("maxCapacity")}</Label>
                <Input
                  id="max-capacity"
                  type="number"
                  min={1}
                  value={formData.maxCapacity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxCapacity: parseInt(e.target.value) || 1,
                    }))
                  }
                  required
                />
              </div>
            </div>

            {/* Shape */}
            <div className="space-y-2">
              <Label>{t("shape")}</Label>
              <Select
                value={formData.shape}
                onValueChange={(val) =>
                  setFormData((prev) => ({ ...prev, shape: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAPES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {getShapeLabel(shape)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div className="space-y-2">
              <Label htmlFor="zone">{t("zone")}</Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, zone: e.target.value }))
                }
                placeholder="Main Dining, Patio, Bar..."
              />
            </div>

            {/* Combinable */}
            <div className="flex items-center gap-3">
              <input
                id="combinable"
                type="checkbox"
                checked={formData.isCombinable}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isCombinable: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="combinable">{t("combinable")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "..." : editingTable ? t("saveChanges") : t("addTable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTable")}</DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          {deletingTable && (
            <p className="text-sm text-muted-foreground">
              {t("tableLabel")}: <strong>{deletingTable.label}</strong>
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "..." : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
