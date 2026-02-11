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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  getPricingConfig,
  putPricingConfig,
  type PricingConfigDto,
  type DistanceBandDto,
  type SpecialDayRateDto,
  type TimeRuleDto,
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
  { value: "STANDARD", label: "Standard" },
  { value: "PLUS", label: "Plus (+20%)" },
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
  const [configs, setConfigs] = useState<PricingConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfigDto | null>(
    null
  );
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // ── Data loading ──

  async function loadConfigs() {
    setLoading(true);
    setError(null);
    try {
      setConfigs(await getPricingConfig());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load pricing configs"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfigs();
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
      setError(e instanceof Error ? e.message : "Failed to save config");
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold tracking-tight">Pricing Engine</h1>
        <p className="text-muted-foreground">
          Configure fares, distance-based per-km rates, special day overrides,
          and peak-hour surges per vehicle type.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Formula */}
      <Card>
        <CardHeader>
          <CardTitle>Fare formula</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <strong>Total</strong> = Base Fare + Distance Fare + (Duration min
            &times; Time Rate) + Booking Fee
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Distance Fare</strong>: Each km uses the per-km rate of the
            distance band it falls into. If no bands are set, the default per-km
            rate is used for the entire trip.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Special Days</strong>: On weekends or selected holidays, the
            special day per-km rate replaces distance bands entirely.
          </p>
          <p className="text-sm text-muted-foreground">
            Surge &amp; Plus premium are applied on top. Result is rounded to
            the nearest 100 MMK.
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing configs</CardTitle>
          <CardDescription>
            One config per vehicle type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openAdd} className="mb-4">
            <PlusIcon className="mr-2 size-4" />
            Add config
          </Button>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : configs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No pricing configs yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Per km</TableHead>
                  <TableHead>Per min</TableHead>
                  <TableHead>Bands</TableHead>
                  <TableHead>Special days</TableHead>
                  <TableHead>Surge</TableHead>
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
                          ? "Default"
                          : bands.map((b, i) => (
                              <span key={i} className="block">
                                {b.minKm}&ndash;{b.maxKm ?? "∞"} km:{" "}
                                {b.perKmRate}
                              </span>
                            ))}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {specials.length === 0
                          ? "None"
                          : specials.map((s, i) => (
                              <span key={i} className="block">
                                {s.name || (s.isWeekend ? "Weekend" : "Holiday")}
                                : {s.perKmRate}/km
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

      {/* ── Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col overflow-y-auto px-6 sm:max-w-lg">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle>
              {editingConfig ? "Edit pricing config" : "Add pricing config"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 px-0">
            {/* Vehicle type */}
            <div className="space-y-1.5">
              <Label>Vehicle type</Label>
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
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Fare settings ── */}
            <Section title="Fare settings">
              <div className="grid gap-3 sm:grid-cols-2">
                <NumField
                  label="Base fare (MMK)"
                  value={form.baseFare}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, baseFare: v }))
                  }
                />
                <NumField
                  label="Default per km rate (MMK)"
                  value={form.perKmRate}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, perKmRate: v }))
                  }
                />
                <NumField
                  label="Time rate (MMK / min)"
                  value={form.timeRate}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, timeRate: v }))
                  }
                />
                <NumField
                  label="Booking fee (MMK)"
                  value={form.bookingFee}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, bookingFee: v }))
                  }
                />
                <NumField
                  label="Surge multiplier"
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
            <Section title="Distance-based per-km rate">
              <p className="text-muted-foreground text-xs">
                Each km of the trip uses the rate of the band it falls into. Leave empty to use the default per-km rate for all distances.
              </p>
              {form.distanceBands.map((band, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">From (km)</Label>
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
                    <Label className="text-xs">To (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8"
                      value={band.maxKm ?? ""}
                      placeholder="No limit"
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
                    <Label className="text-xs">Rate (MMK)</Label>
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
                Add distance band
              </Button>
            </Section>

            {/* ── Special day rates ── */}
            <Section title="Special day per-km rates">
              <p className="text-muted-foreground text-xs">
                On matching days the special per-km rate replaces distance bands
                entirely. Enable &quot;Weekend&quot; and/or pick holiday dates from the
                calendar.
              </p>
              {form.specialDayRates.map((sd, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Rule {idx + 1}
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
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8"
                        placeholder="e.g. Weekend, Thingyan"
                        value={sd.name}
                        onChange={(e) =>
                          updateSpecialDay(idx, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Per km rate (MMK)</Label>
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
                    <span className="text-sm">Apply on weekends (Sat &amp; Sun)</span>
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Holiday dates{" "}
                      {sd.holidayDates.length > 0 && (
                        <span className="text-muted-foreground">
                          ({sd.holidayDates.length} selected)
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
                Add special day rule
              </Button>
            </Section>

            {/* ── Peak-hour time rules ── */}
            <Section title="Peak-hour surge rules">
              <p className="text-muted-foreground text-xs">
                Time windows where a higher surge multiplier applies.
              </p>
              {form.timeRules.map((rule, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">Start hour</Label>
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
                    <Label className="text-xs">End hour</Label>
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
                    <Label className="text-xs">Multiplier</Label>
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
                Add time rule
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
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Saving..." : editingConfig ? "Update" : "Create"}
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
