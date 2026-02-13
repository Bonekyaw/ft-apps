import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/auth-client";
import {
  listDrivers,
  createDriver,
  approveDriver,
  rejectDriver,
  suspendDriver,
  deleteDriver,
  revokeDriverSessions,
  updateDriver,
  uploadDriverDocument,
  upsertVehicle,
  getDriver,
  type Driver,
} from "@/lib/drivers-api";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  LogOutIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PauseCircleIcon,
  EyeIcon,
  UploadIcon,
} from "lucide-react";

// ── Helpers ──

const ELEVATED_ROLES = ["SUPERADMIN", "MANAGER", "OPERATION"];

function isElevated(role: string | undefined | null): boolean {
  return ELEVATED_ROLES.includes((role ?? "").toUpperCase());
}

function approvalVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "PENDING":
      return "secondary";
    case "REJECTED":
      return "destructive";
    case "SUSPENDED":
      return "outline";
    default:
      return "secondary";
  }
}

function driverStatusKey(status: string): string {
  switch (status) {
    case "ON_TRIP":
      return "onTrip";
    default:
      return status.toLowerCase();
  }
}

// ── Create Driver Dialog ──

function CreateDriverDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDriver(name.trim(), email.trim());
      setName("");
      setEmail("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("drivers.errors.failedToCreate"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("drivers.create.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.create.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="driver-name">
                {t("drivers.create.nameLabel")}
              </Label>
              <Input
                id="driver-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("drivers.create.namePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-email">
                {t("drivers.create.emailLabel")}
              </Label>
              <Input
                id="driver-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("drivers.create.emailPlaceholder")}
                required
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !email.trim()}
            >
              {saving
                ? t("drivers.create.creating")
                : t("drivers.create.createButton")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Driver Detail Sheet ──

function DriverDetailSheet({
  driverId,
  onClose,
  onUpdated,
  canEdit,
}: {
  driverId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Vehicle form state
  const [vehicleEditing, setVehicleEditing] = useState(false);
  const [vType, setVType] = useState("ECONOMY");
  const [vFuelType, setVFuelType] = useState("");
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState("");
  const [vColor, setVColor] = useState("");
  const [vPlate, setVPlate] = useState("");
  const [vCapacity, setVCapacity] = useState("4");
  const [petFriendly, setPetFriendly] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  const loadDriver = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const d = await getDriver(driverId);
      setDriver(d);
      setLicenseNumber(d.licenseNumber ?? "");
      setLicenseExpiry(d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : "");
      setNationalId(d.nationalId ?? "");
      // Populate vehicle form
      const v = d.vehicle;
      if (v) {
        setVType(v.type ?? "ECONOMY");
        setVFuelType(v.fuelType ?? "");
        setVMake(v.make ?? "");
        setVModel(v.model ?? "");
        setVYear(String(v.year ?? ""));
        setVColor(v.color ?? "");
        setVPlate(v.plateNumber ?? "");
        setVCapacity(String(v.capacity ?? 4));
      } else {
        setVType("ECONOMY"); setVFuelType(""); setVMake(""); setVModel("");
        setVYear(""); setVColor(""); setVPlate(""); setVCapacity("4");
      }
      setPetFriendly(d.petFriendly ?? false);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (driverId) loadDriver();
  }, [driverId, loadDriver]);

  async function handleSaveInfo() {
    if (!driverId) return;
    setSaving(true);
    try {
      await updateDriver(driverId, {
        licenseNumber: licenseNumber || undefined,
        licenseExpiry: licenseExpiry || undefined,
        nationalId: nationalId || undefined,
      });
      setEditing(false);
      await loadDriver();
      onUpdated();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(
    field: "licenseImageUrl" | "nationalIdImageUrl",
    file: File,
  ) {
    if (!driverId) return;
    setUploading(field);
    try {
      await uploadDriverDocument(driverId, field, file);
      await loadDriver();
      onUpdated();
    } catch {
      // silent
    } finally {
      setUploading(null);
    }
  }

  async function handleSaveVehicle() {
    if (!driverId || !vMake.trim() || !vModel.trim() || !vPlate.trim() || !vYear.trim()) return;
    setSavingVehicle(true);
    try {
      await upsertVehicle(driverId, {
        type: vType,
        fuelType: vFuelType || null,
        make: vMake.trim(),
        model: vModel.trim(),
        year: Number(vYear),
        color: vColor.trim(),
        plateNumber: vPlate.trim(),
        capacity: Number(vCapacity) || 4,
      });
      // Also save petFriendly on driver
      await updateDriver(driverId, { petFriendly });
      setVehicleEditing(false);
      await loadDriver();
      onUpdated();
    } catch {
      // silent
    } finally {
      setSavingVehicle(false);
    }
  }

  return (
    <Sheet open={!!driverId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("drivers.detail.title")}</SheetTitle>
          <SheetDescription>{driver?.email ?? ""}</SheetDescription>
        </SheetHeader>

        {loading || !driver ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : (
          <div className="mt-6 space-y-6 px-3">
            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-semibold">
                {t("drivers.detail.personalInfo")}
              </h3>
              <Separator className="my-2" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.name")}
                  </dt>
                  <dd>{driver.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.email")}
                  </dt>
                  <dd>{driver.email}</dd>
                </div>
                {driver.phone && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t("drivers.detail.phone")}
                    </dt>
                    <dd>{driver.phone}</dd>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.approvalStatus")}
                  </dt>
                  <dd>
                    <Badge variant={approvalVariant(driver.approvalStatus)}>
                      {t(
                        `drivers.approval.${driver.approvalStatus.toLowerCase()}`,
                      )}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.driverStatus")}
                  </dt>
                  <dd>
                    <Badge variant="outline">
                      {t(
                        `drivers.driverStatus.${driverStatusKey(driver.status)}`,
                      )}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("drivers.detail.documents")}
                </h3>
                {canEdit && !editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    {t("drivers.detail.editInfo")}
                  </Button>
                )}
              </div>
              <Separator className="my-2" />

              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-license">
                      {t("drivers.detail.licenseNumber")}
                    </Label>
                    <Input
                      id="edit-license"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder={t("drivers.detail.licenseNumberPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-expiry">
                      {t("drivers.detail.licenseExpiry")}
                    </Label>
                    <Input
                      id="edit-expiry"
                      type="date"
                      value={licenseExpiry}
                      onChange={(e) => setLicenseExpiry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-nrc">
                      {t("drivers.detail.nationalId")}
                    </Label>
                    <Input
                      id="edit-nrc"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder={t("drivers.detail.nationalIdPlaceholder")}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveInfo}
                      disabled={saving}
                    >
                      {saving ? t("common.saving") : t("common.update")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t("drivers.detail.licenseNumber")}
                    </dt>
                    <dd>{driver.licenseNumber ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t("drivers.detail.licenseExpiry")}
                    </dt>
                    <dd>
                      {driver.licenseExpiry
                        ? new Date(driver.licenseExpiry).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t("drivers.detail.nationalId")}
                    </dt>
                    <dd>{driver.nationalId ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </div>

            {/* Document Images */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                {t("drivers.detail.licenseImage")}
              </h3>
              {driver.licenseImageUrl ? (
                <img
                  src={driver.licenseImageUrl}
                  alt="License"
                  className="w-full max-h-48 object-contain rounded border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("drivers.detail.noImage")}
                </p>
              )}
              {canEdit && (
                <label className="mt-2 inline-flex items-center gap-1 cursor-pointer text-sm text-primary hover:underline">
                  <UploadIcon className="size-4" />
                  {uploading === "licenseImageUrl"
                    ? t("common.loading")
                    : t("drivers.detail.uploadImage")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload license image"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload("licenseImageUrl", file);
                    }}
                    disabled={!!uploading}
                  />
                </label>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">
                {t("drivers.detail.nationalIdImage")}
              </h3>
              {driver.nationalIdImageUrl ? (
                <img
                  src={driver.nationalIdImageUrl}
                  alt="National ID"
                  className="w-full max-h-48 object-contain rounded border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("drivers.detail.noImage")}
                </p>
              )}
              {canEdit && (
                <label className="mt-2 inline-flex items-center gap-1 cursor-pointer text-sm text-primary hover:underline">
                  <UploadIcon className="size-4" />
                  {uploading === "nationalIdImageUrl"
                    ? t("common.loading")
                    : t("drivers.detail.uploadImage")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload national ID image"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload("nationalIdImageUrl", file);
                    }}
                    disabled={!!uploading}
                  />
                </label>
              )}
            </div>

            {/* Vehicle Details */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("drivers.detail.vehicleDetails")}
                </h3>
                {canEdit && !vehicleEditing && (
                  <Button variant="outline" size="sm" onClick={() => setVehicleEditing(true)}>
                    {driver.vehicle ? t("common.update") : t("drivers.detail.addVehicle")}
                  </Button>
                )}
              </div>
              <Separator className="my-2" />

              {vehicleEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.vehicleType")}</Label>
                      <select
                        aria-label="Vehicle type"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={vType}
                        onChange={(e) => setVType(e.target.value)}
                      >
                        {["STANDARD", "PLUS", "ECONOMY", "COMFORT", "PREMIUM", "XL", "MOTORBIKE"].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.fuelType")}</Label>
                      <select
                        aria-label="Fuel type"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={vFuelType}
                        onChange={(e) => setVFuelType(e.target.value)}
                      >
                        <option value="">—</option>
                        {["CNG", "PETROL", "ELECTRIC", "DIESEL", "HYBRID"].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.make")}</Label>
                      <Input value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="Toyota" />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.model")}</Label>
                      <Input value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="Camry" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.year")}</Label>
                      <Input type="number" value={vYear} onChange={(e) => setVYear(e.target.value)} placeholder="2022" />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.color")}</Label>
                      <Input value={vColor} onChange={(e) => setVColor(e.target.value)} placeholder="White" />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("drivers.detail.capacity")}</Label>
                      <Input type="number" value={vCapacity} onChange={(e) => setVCapacity(e.target.value)} min={1} max={20} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("drivers.detail.plateNumber")}</Label>
                    <Input value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="1A/1234" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="petFriendly" title="Pet friendly" checked={petFriendly} onChange={(e) => setPetFriendly(e.target.checked)} className="h-4 w-4 rounded border-input" />
                    <Label htmlFor="petFriendly">{t("drivers.detail.petFriendly")}</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveVehicle} disabled={savingVehicle || !vMake.trim() || !vPlate.trim()}>
                      {savingVehicle ? t("common.saving") : t("common.update")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setVehicleEditing(false)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : driver.vehicle ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.vehicleType")}</dt>
                    <dd>{driver.vehicle.type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.fuelType")}</dt>
                    <dd>{driver.vehicle.fuelType ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.make")}</dt>
                    <dd>{driver.vehicle.make}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.model")}</dt>
                    <dd>{driver.vehicle.model}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.year")}</dt>
                    <dd>{driver.vehicle.year}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.color")}</dt>
                    <dd>{driver.vehicle.color}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.plateNumber")}</dt>
                    <dd>{driver.vehicle.plateNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.capacity")}</dt>
                    <dd>{driver.vehicle.capacity}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("drivers.detail.petFriendly")}</dt>
                    <dd>{driver.petFriendly ? "Yes" : "No"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">{t("drivers.detail.noVehicle")}</p>
              )}
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-sm font-semibold">
                {t("drivers.detail.stats")}
              </h3>
              <Separator className="my-2" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.totalRides")}
                  </dt>
                  <dd>{driver.totalRides}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("drivers.detail.averageRating")}
                  </dt>
                  <dd>{Number(driver.averageRating).toFixed(1)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──

export default function DriversPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentRole = (session?.user?.role as string | undefined) ?? "";
  const canEdit = isElevated(currentRole);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Driver | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Driver | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Driver | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDrivers();
      setDrivers(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("drivers.errors.failedToLoad"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  async function handleApprove(id: string) {
    try {
      await approveDriver(id);
      setApproveTarget(null);
      await loadDrivers();
    } catch {
      // silent
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectDriver(id);
      setRejectTarget(null);
      await loadDrivers();
    } catch {
      // silent
    }
  }

  async function handleSuspend(id: string) {
    try {
      await suspendDriver(id);
      setSuspendTarget(null);
      await loadDrivers();
    } catch {
      // silent
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDriver(id);
      setDeleteTarget(null);
      await loadDrivers();
    } catch {
      // silent
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeDriverSessions(id);
      setRevokeTarget(null);
      await loadDrivers();
    } catch {
      // silent
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-4 text-2xl font-bold tracking-tight">
            {t("drivers.title")}
          </h1>
          <p className="text-muted-foreground">{t("drivers.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          {t("drivers.createButton")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("drivers.cardTitle")}</CardTitle>
          <CardDescription>
            {t("drivers.cardDescription", { count: drivers.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-muted-foreground text-sm">
              {t("common.loading")}
            </p>
          ) : drivers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("drivers.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("drivers.table.name")}</TableHead>
                  <TableHead>{t("drivers.table.email")}</TableHead>
                  <TableHead>{t("drivers.table.approval")}</TableHead>
                  <TableHead>{t("drivers.table.status")}</TableHead>
                  <TableHead>{t("drivers.table.rides")}</TableHead>
                  <TableHead>{t("drivers.table.rating")}</TableHead>
                  <TableHead>{t("drivers.table.created")}</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.email}</TableCell>
                    <TableCell>
                      <Badge variant={approvalVariant(d.approvalStatus)}>
                        {t(
                          `drivers.approval.${d.approvalStatus.toLowerCase()}`,
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`drivers.driverStatus.${driverStatusKey(d.status)}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.totalRides}</TableCell>
                    <TableCell>{Number(d.averageRating).toFixed(1)}</TableCell>
                    <TableCell>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(d.id)}>
                            <EyeIcon className="mr-2 size-4" />
                            {t("drivers.actions.viewDetails")}
                          </DropdownMenuItem>
                          {canEdit && (
                            <>
                              <DropdownMenuSeparator />
                              {d.approvalStatus !== "APPROVED" && (
                                <DropdownMenuItem
                                  onClick={() => setApproveTarget(d)}
                                >
                                  <CheckCircle2Icon className="mr-2 size-4 text-green-600" />
                                  {t("drivers.actions.approve")}
                                </DropdownMenuItem>
                              )}
                              {d.approvalStatus !== "REJECTED" && (
                                <DropdownMenuItem
                                  onClick={() => setRejectTarget(d)}
                                >
                                  <XCircleIcon className="mr-2 size-4 text-red-600" />
                                  {t("drivers.actions.reject")}
                                </DropdownMenuItem>
                              )}
                              {d.approvalStatus !== "SUSPENDED" && (
                                <DropdownMenuItem
                                  onClick={() => setSuspendTarget(d)}
                                >
                                  <PauseCircleIcon className="mr-2 size-4 text-yellow-600" />
                                  {t("drivers.actions.suspend")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRevokeTarget(d)}
                              >
                                <LogOutIcon className="mr-2 size-4" />
                                {t("drivers.actions.revokeSessions")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(d)}
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                {t("drivers.actions.deleteDriver")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Driver Dialog */}
      <CreateDriverDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadDrivers}
      />

      {/* Driver Detail Sheet */}
      <DriverDetailSheet
        driverId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={loadDrivers}
        canEdit={canEdit}
      />

      {/* Approve Dialog */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={() => setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("drivers.dialogs.approveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.dialogs.approveMessage", {
                name: approveTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveTarget && handleApprove(approveTarget.id)}
            >
              {t("drivers.actions.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={() => setRejectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("drivers.dialogs.rejectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.dialogs.rejectMessage", {
                name: rejectTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectTarget && handleReject(rejectTarget.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {t("drivers.actions.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Dialog */}
      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={() => setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("drivers.dialogs.suspendTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.dialogs.suspendMessage", {
                name: suspendTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendTarget && handleSuspend(suspendTarget.id)}
            >
              {t("drivers.actions.suspend")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("drivers.dialogs.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.dialogs.deleteMessage", {
                name: deleteTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Sessions Dialog */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("drivers.dialogs.revokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("drivers.dialogs.revokeMessage", {
                name: revokeTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && handleRevoke(revokeTarget.id)}
            >
              {t("common.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
