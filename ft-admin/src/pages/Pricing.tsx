import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
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
  getPricingConfig,
  putPricingConfig,
  getTownshipSurcharges,
  upsertTownshipSurcharge,
  deleteTownshipSurcharge,
  getDispatchConfig,
  putDispatchConfig,
  type PricingConfigDto,
  type DistanceBandDto,
  type SpecialDayRateDto,
  type TimeRuleDto,
  type TownshipSurchargeDto,
  type DispatchRoundDto,
} from "@/lib/pricing-api";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";

// ── Helpers ──

function toDateString(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// ── Constants ──

const VEHICLE_TYPES = [
  { value: "STANDARD", label: "pricing.configSheet.standard" },
  { value: "PLUS", label: "pricing.configSheet.plus" },
];

// ── Form types ──

interface ConfigForm {
  vehicleType: string;
  baseFare: number;
  perKmRate: number;
  timeRate: number;
  bookingFee: number;
  surgeMultiplier: number;
  currency: string;
  timeRules: TimeRuleDto[];
  distanceBands: DistanceBandDto[];
  specialDayRates: SpecialDayRateDto[];
}

const DEFAULT_FORM: ConfigForm = {
  vehicleType: "STANDARD",
  baseFare: 1500,
  perKmRate: 1000,
  timeRate: 0,
  bookingFee: 0,
  surgeMultiplier: 1.0,
  currency: "MMK",
  timeRules: [],
  distanceBands: [],
  specialDayRates: [],
};

// ── Component ──

export default function PricingPage() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<PricingConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfigDto | null>(
    null
  );
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Township surcharge state
  const [surcharges, setSurcharges] = useState<TownshipSurchargeDto[]>([]);
  const [surchargeLoading, setSurchargeLoading] = useState(true);
  const [surchargeSheetOpen, setSurchargeSheetOpen] = useState(false);
  const [editingSurcharge, setEditingSurcharge] =
    useState<TownshipSurchargeDto | null>(null);
  const [surchargeForm, setSurchargeForm] = useState({
    township: "",
    fixedCharge: 0,
  });
  const [savingSurcharge, setSavingSurcharge] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSurchargeId, setDeletingSurchargeId] = useState<string | null>(
    null
  );

  // Dispatch config state
  const [dispatchRounds, setDispatchRounds] = useState<DispatchRoundDto[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState(true);
  const [savingDispatch, setSavingDispatch] = useState(false);

  // ── Data loading ──

  async function loadConfigs() {
    setLoading(true);
    setError(null);
    try {
      setConfigs(await getPricingConfig());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("pricing.errors.loadConfigs")
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSurcharges() {
    setSurchargeLoading(true);
    try {
      setSurcharges(await getTownshipSurcharges());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("pricing.errors.loadSurcharges")
      );
    } finally {
      setSurchargeLoading(false);
    }
  }

  async function loadDispatch() {
    setDispatchLoading(true);
    try {
      setDispatchRounds(await getDispatchConfig());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("pricing.errors.loadDispatch")
      );
    } finally {
      setDispatchLoading(false);
    }
  }

  useEffect(() => {
    loadConfigs();
    loadSurcharges();
    loadDispatch();
  }, []);

  // ── Sheet open/close ──

  function openAdd() {
    setEditingConfig(null);
    setForm({ ...DEFAULT_FORM });
    setSheetOpen(true);
  }

  function openEdit(config: PricingConfigDto) {
    setEditingConfig(config);
    setForm({
      vehicleType: config.vehicleType,
      baseFare: config.baseFare,
      perKmRate: config.perKmRate,
      timeRate: config.timeRate,
      bookingFee: config.bookingFee,
      surgeMultiplier: config.surgeMultiplier,
      currency: config.currency,
      timeRules: Array.isArray(config.timeRules) ? config.timeRules : [],
      distanceBands: Array.isArray(config.distanceBands)
        ? config.distanceBands
        : [],
      specialDayRates: Array.isArray(config.specialDayRates)
        ? config.specialDayRates
        : [],
    });
    setSheetOpen(true);
  }

  // ── Save ──

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await putPricingConfig(form);
      setSheetOpen(false);
      loadConfigs();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pricing.errors.saveConfig"));
    } finally {
      setSaving(false);
    }
  }

  // ── Township surcharge sheet ──

  function openAddSurcharge() {
    setEditingSurcharge(null);
    setSurchargeForm({ township: "", fixedCharge: 0 });
    setSurchargeSheetOpen(true);
  }

  function openEditSurcharge(s: TownshipSurchargeDto) {
    setEditingSurcharge(s);
    setSurchargeForm({
      township: s.township,
      fixedCharge: s.fixedCharge,
    });
    setSurchargeSheetOpen(true);
  }

  async function handleSaveSurcharge() {
    setSavingSurcharge(true);
    setError(null);
    try {
      await upsertTownshipSurcharge(surchargeForm);
      setSurchargeSheetOpen(false);
      loadSurcharges();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("pricing.errors.saveSurcharge")
      );
    } finally {
      setSavingSurcharge(false);
    }
  }

  function confirmDeleteSurcharge(id: string) {
    setDeletingSurchargeId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteSurcharge() {
    if (!deletingSurchargeId) return;
    setError(null);
    try {
      await deleteTownshipSurcharge(deletingSurchargeId);
      setDeleteDialogOpen(false);
      setDeletingSurchargeId(null);
      loadSurcharges();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("pricing.errors.deleteSurcharge")
      );
    }
  }

  // ── Time rules CRUD ──

  function addTimeRule() {
    setForm((s) => ({
      ...s,
      timeRules: [...s.timeRules, { start: 7, end: 9, multiplier: 1.5 }],
    }));
  }
  function updateTimeRule(
    i: number,
    field: keyof TimeRuleDto,
    value: number
  ) {
    setForm((s) => {
      const arr = [...s.timeRules];
      arr[i] = { ...arr[i], [field]: value };
      return { ...s, timeRules: arr };
    });
  }
  function removeTimeRule(i: number) {
    setForm((s) => ({
      ...s,
      timeRules: s.timeRules.filter((_, idx) => idx !== i),
    }));
  }

  // ── Distance bands CRUD ──

  function addBand() {
    const last = form.distanceBands[form.distanceBands.length - 1];
    const nextMin = last ? (last.maxKm ?? last.minKm + 5) : 0;
    setForm((s) => ({
      ...s,
      distanceBands: [
        ...s.distanceBands,
        { minKm: nextMin, maxKm: null, perKmRate: s.perKmRate },
      ],
    }));
  }
  function updateBand(
    i: number,
    field: keyof DistanceBandDto,
    value: number | null
  ) {
    setForm((s) => {
      const arr = [...s.distanceBands];
      arr[i] = { ...arr[i], [field]: value } as DistanceBandDto;
      return { ...s, distanceBands: arr };
    });
  }
  function removeBand(i: number) {
    setForm((s) => ({
      ...s,
      distanceBands: s.distanceBands.filter((_, idx) => idx !== i),
    }));
  }

  // ── Special day rates CRUD ──

  function addSpecialDay() {
    setForm((s) => ({
      ...s,
      specialDayRates: [
        ...s.specialDayRates,
        {
          name: "",
          perKmRate: s.perKmRate,
          isWeekend: false,
          holidayDates: [],
        },
      ],
    }));
  }
  function updateSpecialDay(
    i: number,
    patch: Partial<SpecialDayRateDto>
  ) {
    setForm((s) => {
      const arr = [...s.specialDayRates];
      arr[i] = { ...arr[i], ...patch };
      return { ...s, specialDayRates: arr };
    });
  }
  function removeSpecialDay(i: number) {
    setForm((s) => ({
      ...s,
      specialDayRates: s.specialDayRates.filter((_, idx) => idx !== i),
    }));
  }

  // ── Render ──

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-muted-foreground">
          {t("pricing.description")}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Formula */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.fareFormula.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("pricing.fareFormula.total")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pricing.fareFormula.distanceFare")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pricing.fareFormula.specialDays")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pricing.fareFormula.townshipSurcharge")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pricing.fareFormula.surgeNote")}
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.configs.title")}</CardTitle>
          <CardDescription>
            {t("pricing.configs.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openAdd} className="mb-4">
            <PlusIcon className="mr-2 size-4" />
            {t("pricing.configs.addButton")}
          </Button>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : configs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("pricing.configs.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pricing.configs.type")}</TableHead>
                  <TableHead>{t("pricing.configs.base")}</TableHead>
                  <TableHead>{t("pricing.configs.perKm")}</TableHead>
                  <TableHead>{t("pricing.configs.perMin")}</TableHead>
                  <TableHead>{t("pricing.configs.bands")}</TableHead>
                  <TableHead>{t("pricing.configs.specialDays")}</TableHead>
                  <TableHead>{t("pricing.configs.surge")}</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => {
                  const bands = Array.isArray(c.distanceBands)
                    ? (c.distanceBands as DistanceBandDto[])
                    : [];
                  const specials = Array.isArray(c.specialDayRates)
                    ? (c.specialDayRates as SpecialDayRateDto[])
                    : [];
                  return (
                    <TableRow key={c.id ?? c.vehicleType}>
                      <TableCell>
                        <Badge variant="outline">{c.vehicleType}</Badge>
                      </TableCell>
                      <TableCell>
                        {Number(c.baseFare).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {Number(c.perKmRate).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {Number(c.timeRate).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {bands.length === 0
                          ? t("pricing.configs.default")
                          : bands.map((b, i) => (
                              <span key={i} className="block">
                                {b.minKm}&ndash;{b.maxKm ?? "∞"} km:{" "}
                                {b.perKmRate}
                              </span>
                            ))}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {specials.length === 0
                          ? t("pricing.configs.none")
                          : specials.map((s, i) => (
                              <span key={i} className="block">
                                {s.name || (s.isWeekend ? t("pricing.configs.weekend") : t("pricing.configs.holiday"))}
                                : {s.perKmRate}{t("pricing.configs.perKmSuffix")}
                              </span>
                            ))}
                      </TableCell>
                      <TableCell>{Number(c.surgeMultiplier)}x</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Township surcharge section ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.township.title")}</CardTitle>
          <CardDescription>
            {t("pricing.township.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openAddSurcharge} className="mb-4">
            <PlusIcon className="mr-2 size-4" />
            {t("pricing.township.addButton")}
          </Button>
          {surchargeLoading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : surcharges.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("pricing.township.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pricing.township.townshipCol")}</TableHead>
                  <TableHead>{t("pricing.township.fixedChargeCol")}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {surcharges.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.township}
                    </TableCell>
                    <TableCell>
                      {Number(s.fixedCharge).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditSurcharge(s)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDeleteSurcharge(s.id)}
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

      {/* ── Township surcharge Sheet ── */}
      <Sheet open={surchargeSheetOpen} onOpenChange={setSurchargeSheetOpen}>
        <SheetContent className="flex flex-col overflow-y-auto px-6 sm:max-w-md">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle>
              {editingSurcharge
                ? t("pricing.township.editTitle")
                : t("pricing.township.addTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 px-0">
            <div className="space-y-1.5">
              <Label>{t("pricing.township.townshipLabel")}</Label>
              <Input
                className="h-9"
                placeholder={t("pricing.township.townshipPlaceholder")}
                value={surchargeForm.township}
                onChange={(e) =>
                  setSurchargeForm((s) => ({
                    ...s,
                    township: e.target.value,
                  }))
                }
                disabled={!!editingSurcharge}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("pricing.township.fixedChargeLabel")}</Label>
              <Input
                type="number"
                min={0}
                step={100}
                className="h-9"
                value={surchargeForm.fixedCharge}
                onChange={(e) =>
                  setSurchargeForm((s) => ({
                    ...s,
                    fixedCharge: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t("pricing.township.helpText")}
            </p>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSurchargeSheetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveSurcharge}
              disabled={savingSurcharge || !surchargeForm.township.trim()}
              className="flex-1"
            >
              {savingSurcharge
                ? t("common.saving")
                : editingSurcharge
                  ? t("common.update")
                  : t("common.create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pricing.township.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pricing.township.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSurcharge}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dispatch config section ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.dispatch.title")}</CardTitle>
          <CardDescription>
            {t("pricing.dispatch.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dispatchLoading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : (
            <div className="space-y-4">
              {dispatchRounds.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("pricing.dispatch.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">{t("pricing.dispatch.round")}</TableHead>
                      <TableHead>{t("pricing.dispatch.radiusKm")}</TableHead>
                      <TableHead>{t("pricing.dispatch.intervalSec")}</TableHead>
                      <TableHead className="w-[48px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatchRounds.map((round, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0.1}
                            step={0.1}
                            className="h-8 w-28"
                            value={round.radiusMeters / 1000}
                            onChange={(e) => {
                              const km = Number(e.target.value) || 0.1;
                              setDispatchRounds((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, radiusMeters: Math.round(km * 1000) }
                                    : r
                                )
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={5}
                            step={5}
                            className="h-8 w-28"
                            value={round.intervalMs / 1000}
                            onChange={(e) => {
                              const sec = Number(e.target.value) || 5;
                              setDispatchRounds((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, intervalMs: Math.round(sec * 1000) }
                                    : r
                                )
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("pricing.dispatch.removeTooltip")}
                            onClick={() =>
                              setDispatchRounds((prev) =>
                                prev
                                  .filter((_, i) => i !== idx)
                                  .map((r, i) => ({ ...r, roundIndex: i }))
                              )
                            }
                          >
                            <Trash2Icon className="size-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDispatchRounds((prev) => [
                      ...prev,
                      {
                        roundIndex: prev.length,
                        radiusMeters: prev.length > 0
                          ? prev[prev.length - 1].radiusMeters + 500
                          : 800,
                        intervalMs: 20_000,
                      },
                    ])
                  }
                >
                  <PlusIcon className="mr-1 size-3.5" />
                  {t("pricing.dispatch.addRound")}
                </Button>

                <Button
                  size="sm"
                  disabled={savingDispatch}
                  onClick={async () => {
                    setSavingDispatch(true);
                    try {
                      const saved = await putDispatchConfig(
                        dispatchRounds.map((r, i) => ({
                          roundIndex: i,
                          radiusMeters: r.radiusMeters,
                          intervalMs: r.intervalMs,
                        }))
                      );
                      setDispatchRounds(saved);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : t("pricing.errors.saveDispatch")
                      );
                    } finally {
                      setSavingDispatch(false);
                    }
                  }}
                >
                  {savingDispatch
                    ? t("pricing.dispatch.saving")
                    : t("pricing.dispatch.save")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pricing config Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col overflow-y-auto px-6 sm:max-w-lg">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle>
              {editingConfig ? t("pricing.configSheet.editTitle") : t("pricing.configSheet.addTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 px-0">
            {/* Vehicle type */}
            <div className="space-y-1.5">
              <Label>{t("pricing.configSheet.vehicleTypeLabel")}</Label>
              <Select
                value={form.vehicleType}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, vehicleType: v }))
                }
                disabled={!!editingConfig}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>
                      {t(vt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Fare settings ── */}
            <Section title={t("pricing.configSheet.fareSettings")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumField
                  label={t("pricing.configSheet.baseFare")}
                  value={form.baseFare}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, baseFare: v }))
                  }
                />
                <NumField
                  label={t("pricing.configSheet.defaultPerKmRate")}
                  value={form.perKmRate}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, perKmRate: v }))
                  }
                />
                <NumField
                  label={t("pricing.configSheet.timeRate")}
                  value={form.timeRate}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, timeRate: v }))
                  }
                />
                <NumField
                  label={t("pricing.configSheet.bookingFee")}
                  value={form.bookingFee}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, bookingFee: v }))
                  }
                />
                <NumField
                  label={t("pricing.configSheet.surgeMultiplier")}
                  value={form.surgeMultiplier}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, surgeMultiplier: v }))
                  }
                  min={1}
                  step={0.1}
                />
              </div>
            </Section>

            {/* ── Distance bands ── */}
            <Section title={t("pricing.configSheet.distanceBands")}>
              <p className="text-muted-foreground text-xs">
                {t("pricing.configSheet.distanceBandsDesc")}
              </p>
              {form.distanceBands.map((band, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.fromKm")}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8"
                      value={band.minKm}
                      onChange={(e) =>
                        updateBand(idx, "minKm", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.toKm")}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8"
                      value={band.maxKm ?? ""}
                      placeholder={t("pricing.configSheet.toPlaceholder")}
                      onChange={(e) =>
                        updateBand(
                          idx,
                          "maxKm",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.rateLabel")}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8"
                      value={band.perKmRate}
                      onChange={(e) =>
                        updateBand(
                          idx,
                          "perKmRate",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeBand(idx)}
                  >
                    <Trash2Icon className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addBand}>
                <PlusIcon className="mr-1 size-3.5" />
                {t("pricing.configSheet.addBand")}
              </Button>
            </Section>

            {/* ── Special day rates ── */}
            <Section title={t("pricing.configSheet.specialDaysTitle")}>
              <p className="text-muted-foreground text-xs">
                {t("pricing.configSheet.specialDaysDesc")}
              </p>
              {form.specialDayRates.map((sd, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {t("pricing.configSheet.ruleLabel")} {idx + 1}
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeSpecialDay(idx)}
                    >
                      <Trash2Icon className="size-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("pricing.configSheet.nameLabel")}</Label>
                      <Input
                        className="h-8"
                        placeholder={t("pricing.configSheet.namePlaceholder")}
                        value={sd.name}
                        onChange={(e) =>
                          updateSpecialDay(idx, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("pricing.configSheet.perKmRateLabel")}</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8"
                        value={sd.perKmRate}
                        onChange={(e) =>
                          updateSpecialDay(idx, {
                            perKmRate: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="border-input size-4 rounded"
                      checked={sd.isWeekend}
                      onChange={(e) =>
                        updateSpecialDay(idx, {
                          isWeekend: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">{t("pricing.configSheet.weekendCheckbox")}</span>
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      {t("pricing.configSheet.holidayDatesLabel")}{" "}
                      {sd.holidayDates.length > 0 && (
                        <span className="text-muted-foreground">
                          ({sd.holidayDates.length} {t("pricing.configSheet.selectedCount")})
                        </span>
                      )}
                    </Label>
                    <Calendar
                      mode="multiple"
                      selected={sd.holidayDates.map(parseDateString)}
                      onSelect={(dates) =>
                        updateSpecialDay(idx, {
                          holidayDates: (dates ?? []).map(toDateString),
                        })
                      }
                      className="rounded-md border"
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSpecialDay}>
                <PlusIcon className="mr-1 size-3.5" />
                {t("pricing.configSheet.addSpecialDay")}
              </Button>
            </Section>

            {/* ── Peak-hour time rules ── */}
            <Section title={t("pricing.configSheet.timeRulesTitle")}>
              <p className="text-muted-foreground text-xs">
                {t("pricing.configSheet.timeRulesDesc")}
              </p>
              {form.timeRules.map((rule, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.startHour")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      className="h-8"
                      value={rule.start}
                      onChange={(e) =>
                        updateTimeRule(
                          idx,
                          "start",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.endHour")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      className="h-8"
                      value={rule.end}
                      onChange={(e) =>
                        updateTimeRule(
                          idx,
                          "end",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">{t("pricing.configSheet.multiplierLabel")}</Label>
                    <Input
                      type="number"
                      min={1}
                      step={0.1}
                      className="h-8"
                      value={rule.multiplier}
                      onChange={(e) =>
                        updateTimeRule(
                          idx,
                          "multiplier",
                          Number(e.target.value) || 1
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeTimeRule(idx)}
                  >
                    <Trash2Icon className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTimeRule}>
                <PlusIcon className="mr-1 size-3.5" />
                {t("pricing.configSheet.addTimeRule")}
              </Button>
            </Section>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSheetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? t("common.saving") : editingConfig ? t("common.update") : t("common.create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Small reusable pieces ──

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {title}
      </Label>
      {children}
    </section>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        className="h-9"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
