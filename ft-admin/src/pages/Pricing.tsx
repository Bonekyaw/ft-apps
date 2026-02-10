import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  getPricingDefaults,
  putPricingDefaults,
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  type PricingRuleDto,
  type CreatePricingRuleBody,
} from "@/lib/pricing-api";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";

const RULE_TYPES: { value: CreatePricingRuleBody["ruleType"]; label: string }[] = [
  { value: "DISTANCE_BAND", label: "Distance band (per km rate)" },
  { value: "TIME_OF_DAY", label: "Time of day (surge)" },
  { value: "SPECIAL_DAY", label: "Special day (weekend/holiday surge)" },
];

export default function PricingPage() {
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsForm, setDefaultsForm] = useState({
    baseFareMinMmkt: 1500,
    baseFareMaxMmkt: 2000,
    initialKmForBase: 2,
    perKmRateDefaultMmkt: 1000,
    taxiPlusMultiplier: 1.2,
    currency: "MMK",
  });

  const [rules, setRules] = useState<PricingRuleDto[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleDto | null>(null);
  const [ruleForm, setRuleForm] = useState<CreatePricingRuleBody>({
    name: "",
    active: true,
    priority: 0,
    ruleType: "DISTANCE_BAND",
    minDistanceKm: 0,
    maxDistanceKm: undefined,
    perKmRateMmkt: 1000,
    startHour: 0,
    endHour: 23,
    timeSurgeMultiplier: 1.2,
    dayOfWeek: undefined,
    isWeekend: false,
    isHoliday: false,
    specialDayMultiplier: 1.1,
  });
  const [ruleSaving, setRuleSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PricingRuleDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDefaults() {
    setDefaultsLoading(true);
    setError(null);
    try {
      const d = await getPricingDefaults();
      setDefaultsForm({
        baseFareMinMmkt: d.baseFareMinMmkt,
        baseFareMaxMmkt: d.baseFareMaxMmkt,
        initialKmForBase: d.initialKmForBase,
        perKmRateDefaultMmkt: d.perKmRateDefaultMmkt,
        taxiPlusMultiplier: d.taxiPlusMultiplier,
        currency: d.currency,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load defaults");
    } finally {
      setDefaultsLoading(false);
    }
  }

  async function loadRules() {
    setRulesLoading(true);
    setError(null);
    try {
      const list = await getPricingRules();
      setRules(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setRulesLoading(false);
    }
  }

  useEffect(() => {
    loadDefaults();
    loadRules();
  }, []);

  async function handleSaveDefaults() {
    setDefaultsSaving(true);
    setError(null);
    try {
      await putPricingDefaults(defaultsForm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save defaults");
    } finally {
      setDefaultsSaving(false);
    }
  }

  function openAddRule() {
    setEditingRule(null);
    setRuleForm({
      name: "",
      active: true,
      priority: 0,
      ruleType: "DISTANCE_BAND",
      minDistanceKm: 0,
      maxDistanceKm: undefined,
      perKmRateMmkt: 1000,
      startHour: 0,
      endHour: 23,
      timeSurgeMultiplier: 1.2,
      dayOfWeek: undefined,
      isWeekend: false,
      isHoliday: false,
      specialDayMultiplier: 1.1,
    });
    setRuleDialogOpen(true);
  }

  function openEditRule(rule: PricingRuleDto) {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      active: rule.active,
      priority: rule.priority,
      ruleType: rule.ruleType,
      minDistanceKm: rule.minDistanceKm ?? 0,
      maxDistanceKm: rule.maxDistanceKm ?? undefined,
      perKmRateMmkt: rule.perKmRateMmkt ?? 1000,
      startHour: rule.startHour ?? 0,
      endHour: rule.endHour ?? 23,
      timeSurgeMultiplier: rule.timeSurgeMultiplier ?? 1.2,
      dayOfWeek: rule.dayOfWeek ?? undefined,
      isWeekend: rule.isWeekend ?? false,
      isHoliday: rule.isHoliday ?? false,
      specialDayMultiplier: rule.specialDayMultiplier ?? 1.1,
    });
    setRuleDialogOpen(true);
  }

  async function handleSaveRule() {
    setRuleSaving(true);
    setError(null);
    try {
      if (editingRule) {
        await updatePricingRule(editingRule.id, ruleForm);
      } else {
        await createPricingRule(ruleForm);
      }
      setRuleDialogOpen(false);
      loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule");
    } finally {
      setRuleSaving(false);
    }
  }

  async function handleDeleteRule(rule: PricingRuleDto) {
    try {
      await deletePricingRule(rule.id);
      setDeleteTarget(null);
      loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete rule");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pricing Engine</h1>
        <p className="text-muted-foreground">
          Base fare, per-km rate, and rules for distance, time of day, and special days.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fare defaults</CardTitle>
          <CardDescription>
            Base fare (MMK), initial km covered by base, default per-km rate, and Taxi Plus multiplier (e.g. 1.2 = +20%).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {defaultsLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Base fare min (MMK)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={defaultsForm.baseFareMinMmkt}
                    onChange={(e) =>
                      setDefaultsForm((s) => ({
                        ...s,
                        baseFareMinMmkt: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base fare max (MMK)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={defaultsForm.baseFareMaxMmkt}
                    onChange={(e) =>
                      setDefaultsForm((s) => ({
                        ...s,
                        baseFareMaxMmkt: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial km (covered by base)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={defaultsForm.initialKmForBase}
                    onChange={(e) =>
                      setDefaultsForm((s) => ({
                        ...s,
                        initialKmForBase: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Per km rate default (MMK)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={defaultsForm.perKmRateDefaultMmkt}
                    onChange={(e) =>
                      setDefaultsForm((s) => ({
                        ...s,
                        perKmRateDefaultMmkt: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxi Plus multiplier (e.g. 1.2)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={defaultsForm.taxiPlusMultiplier}
                    onChange={(e) =>
                      setDefaultsForm((s) => ({
                        ...s,
                        taxiPlusMultiplier: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
              <Button onClick={handleSaveDefaults} disabled={defaultsSaving}>
                {defaultsSaving ? "Saving..." : "Save defaults"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing rules</CardTitle>
          <CardDescription>
            Override per-km rate by distance, or apply surge by time of day or special days. Lower priority runs first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openAddRule} className="mb-4">
            <PlusIcon className="mr-2 size-4" />
            Add rule
          </Button>
          {rulesLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.ruleType}</Badge>
                    </TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell>{r.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.ruleType === "DISTANCE_BAND" &&
                        `${r.minDistanceKm ?? 0}–${r.maxDistanceKm ?? "∞"} km → ${r.perKmRateMmkt ?? "-"} MMK/km`}
                      {r.ruleType === "TIME_OF_DAY" &&
                        `${r.startHour ?? 0}:00–${r.endHour ?? 23}:59 → ${r.timeSurgeMultiplier ?? 1}x`}
                      {r.ruleType === "SPECIAL_DAY" &&
                        (r.isWeekend
                          ? `Weekend → ${r.specialDayMultiplier ?? 1}x`
                          : r.holidayDate
                            ? `Holiday → ${r.specialDayMultiplier ?? 1}x`
                            : `Day ${r.dayOfWeek} → ${r.specialDayMultiplier ?? 1}x`)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditRule(r)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editingRule ? "Edit rule" : "Add rule"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) =>
                  setRuleForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="e.g. Long distance discount"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={ruleForm.ruleType}
                onValueChange={(v: CreatePricingRuleBody["ruleType"]) =>
                  setRuleForm((s) => ({ ...s, ruleType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) =>
                    setRuleForm((s) => ({
                      ...s,
                      priority: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  id="active"
                  aria-label="Active"
                  checked={ruleForm.active}
                  onChange={(e) =>
                    setRuleForm((s) => ({ ...s, active: e.target.checked }))
                  }
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>

            {ruleForm.ruleType === "DISTANCE_BAND" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Min distance (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ruleForm.minDistanceKm ?? ""}
                      onChange={(e) =>
                        setRuleForm((s) => ({
                          ...s,
                          minDistanceKm: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max distance (km, empty = no limit)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ruleForm.maxDistanceKm ?? ""}
                      onChange={(e) =>
                        setRuleForm((s) => ({
                          ...s,
                          maxDistanceKm: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Per km rate (MMK)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={ruleForm.perKmRateMmkt ?? ""}
                    onChange={(e) =>
                      setRuleForm((s) => ({
                        ...s,
                        perKmRateMmkt: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </>
            )}

            {ruleForm.ruleType === "TIME_OF_DAY" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Start hour (0–23)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={ruleForm.startHour ?? ""}
                      onChange={(e) =>
                        setRuleForm((s) => ({
                          ...s,
                          startHour: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End hour (0–23)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={ruleForm.endHour ?? ""}
                      onChange={(e) =>
                        setRuleForm((s) => ({
                          ...s,
                          endHour:
                            e.target.value === ""
                              ? 23
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Surge multiplier (e.g. 1.2)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={ruleForm.timeSurgeMultiplier ?? ""}
                    onChange={(e) =>
                      setRuleForm((s) => ({
                        ...s,
                        timeSurgeMultiplier: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </>
            )}

            {ruleForm.ruleType === "SPECIAL_DAY" && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isWeekend"
                    aria-label="Weekend (Sat/Sun)"
                    checked={ruleForm.isWeekend ?? false}
                    onChange={(e) =>
                      setRuleForm((s) => ({ ...s, isWeekend: e.target.checked }))
                    }
                  />
                  <Label htmlFor="isWeekend">Weekend (Sat/Sun)</Label>
                </div>
                <div className="space-y-2">
                  <Label>Day of week (0=Sun … 6=Sat, optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={ruleForm.dayOfWeek ?? ""}
                    onChange={(e) =>
                      setRuleForm((s) => ({
                        ...s,
                        dayOfWeek: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Special day multiplier (e.g. 1.1)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={ruleForm.specialDayMultiplier ?? ""}
                    onChange={(e) =>
                      setRuleForm((s) => ({
                        ...s,
                        specialDayMultiplier: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={ruleSaving}>
              {ruleSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDeleteRule(deleteTarget)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
