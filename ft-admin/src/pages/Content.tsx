import { useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
  ImageIcon,
  XIcon,
  MegaphoneIcon,
} from "lucide-react";
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadImage,
  type BannerDto,
  type AnnouncementDto,
} from "@/lib/content-api";

// ── Helpers ──

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// =============================================
// IMAGE UPLOAD COMPONENT
// =============================================

function ImageUpload({
  value,
  onChange,
  purpose,
}: {
  value: string;
  onChange: (url: string) => void;
  purpose: "banner" | "thumbnail";
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, purpose);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("content.errors.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Preview"
            className="h-36 w-full rounded-md border object-cover"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-7 w-7 bg-background/80 backdrop-blur-sm"
            onClick={() => onChange("")}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/30"
        >
          {uploading ? (
            <span className="text-sm">{t("content.upload.uploading")}</span>
          ) : (
            <>
              <UploadIcon className="size-6" />
              <span className="text-sm">{t("content.upload.clickToUpload")}</span>
              <span className="text-xs">
                {t("content.upload.formats")}
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        aria-label="Upload image"
        onChange={handleFile}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// =============================================
// BANNER FORM
// =============================================

interface BannerForm {
  title: string;
  imageUrl: string;
  linkUrl: string;
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const DEFAULT_BANNER: BannerForm = {
  title: "",
  imageUrl: "",
  linkUrl: "",
  priority: 0,
  isActive: true,
  startsAt: "",
  endsAt: "",
};

// =============================================
// ANNOUNCEMENT FORM
// =============================================

interface AnnouncementForm {
  title: string;
  titleMy: string;
  body: string;
  bodyMy: string;
  imageUrl: string;
  linkUrl: string;
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const DEFAULT_ANNOUNCEMENT: AnnouncementForm = {
  title: "",
  titleMy: "",
  body: "",
  bodyMy: "",
  imageUrl: "",
  linkUrl: "",
  priority: 0,
  isActive: true,
  startsAt: "",
  endsAt: "",
};

// =============================================
// MAIN PAGE
// =============================================

export default function ContentPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("banners");

  // ── Banners state ──
  const [banners, setBanners] = useState<BannerDto[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [bannerSheetOpen, setBannerSheetOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerDto | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerForm>(DEFAULT_BANNER);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);

  // ── Announcements state ──
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementSheetOpen, setAnnouncementSheetOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<AnnouncementDto | null>(null);
  const [announcementForm, setAnnouncementForm] =
    useState<AnnouncementForm>(DEFAULT_ANNOUNCEMENT);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<
    string | null
  >(null);

  const [error, setError] = useState<string | null>(null);

  // ── Load data ──

  const loadBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      setBanners(await getBanners());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("content.errors.loadBanners"));
    } finally {
      setBannersLoading(false);
    }
  }, [t]);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      setAnnouncements(await getAnnouncements());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("content.errors.loadAnnouncements"),
      );
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBanners();
    loadAnnouncements();
  }, [loadBanners, loadAnnouncements]);

  // ── Banner sheet handlers ──

  function openAddBanner() {
    setEditingBanner(null);
    setBannerForm({ ...DEFAULT_BANNER });
    setBannerSheetOpen(true);
  }

  function openEditBanner(b: BannerDto) {
    setEditingBanner(b);
    setBannerForm({
      title: b.title ?? "",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "",
      priority: b.priority,
      isActive: b.isActive,
      startsAt: toInputDate(b.startsAt),
      endsAt: toInputDate(b.endsAt),
    });
    setBannerSheetOpen(true);
  }

  async function handleSaveBanner() {
    if (!bannerForm.imageUrl) {
      setError(t("content.errors.bannerImageRequired"));
      return;
    }
    setBannerSaving(true);
    setError(null);
    try {
      const payload = {
        title: bannerForm.title || undefined,
        imageUrl: bannerForm.imageUrl,
        linkUrl: bannerForm.linkUrl || undefined,
        priority: bannerForm.priority,
        isActive: bannerForm.isActive,
        startsAt: bannerForm.startsAt || undefined,
        endsAt: bannerForm.endsAt || undefined,
      };
      if (editingBanner) {
        await updateBanner(editingBanner.id, payload);
      } else {
        await createBanner(payload);
      }
      setBannerSheetOpen(false);
      loadBanners();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("content.errors.saveBanner"));
    } finally {
      setBannerSaving(false);
    }
  }

  async function handleDeleteBanner() {
    if (!deletingBannerId) return;
    try {
      await deleteBanner(deletingBannerId);
      loadBanners();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("content.errors.deleteBanner"));
    } finally {
      setDeletingBannerId(null);
    }
  }

  // ── Announcement sheet handlers ──

  function openAddAnnouncement() {
    setEditingAnnouncement(null);
    setAnnouncementForm({ ...DEFAULT_ANNOUNCEMENT });
    setAnnouncementSheetOpen(true);
  }

  function openEditAnnouncement(a: AnnouncementDto) {
    setEditingAnnouncement(a);
    setAnnouncementForm({
      title: a.title,
      titleMy: a.titleMy ?? "",
      body: a.body,
      bodyMy: a.bodyMy ?? "",
      imageUrl: a.imageUrl ?? "",
      linkUrl: a.linkUrl ?? "",
      priority: a.priority,
      isActive: a.isActive,
      startsAt: toInputDate(a.startsAt),
      endsAt: toInputDate(a.endsAt),
    });
    setAnnouncementSheetOpen(true);
  }

  async function handleSaveAnnouncement() {
    if (!announcementForm.title || !announcementForm.body) {
      setError(t("content.errors.titleBodyRequired"));
      return;
    }
    setAnnouncementSaving(true);
    setError(null);
    try {
      const payload = {
        title: announcementForm.title,
        titleMy: announcementForm.titleMy || undefined,
        body: announcementForm.body,
        bodyMy: announcementForm.bodyMy || undefined,
        imageUrl: announcementForm.imageUrl || undefined,
        linkUrl: announcementForm.linkUrl || undefined,
        priority: announcementForm.priority,
        isActive: announcementForm.isActive,
        startsAt: announcementForm.startsAt || undefined,
        endsAt: announcementForm.endsAt || undefined,
      };
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      setAnnouncementSheetOpen(false);
      loadAnnouncements();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("content.errors.saveAnnouncement"),
      );
    } finally {
      setAnnouncementSaving(false);
    }
  }

  async function handleDeleteAnnouncement() {
    if (!deletingAnnouncementId) return;
    try {
      await deleteAnnouncement(deletingAnnouncementId);
      loadAnnouncements();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("content.errors.deleteAnnouncement"),
      );
    } finally {
      setDeletingAnnouncementId(null);
    }
  }

  // ── Render ──

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">
          {t("content.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("content.description")}
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md bg-destructive/10 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setError(null)}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="banners" className="gap-1.5">
            <ImageIcon className="size-4" />
            {t("content.tabs.banners")}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <MegaphoneIcon className="size-4" />
            {t("content.tabs.announcements")}
          </TabsTrigger>
        </TabsList>

        {/* ─────────── BANNERS TAB ─────────── */}
        <TabsContent value="banners">
          <Card>
            <CardHeader>
              <CardTitle>{t("content.banners.title")}</CardTitle>
              <CardDescription>
                {t("content.banners.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={openAddBanner} className="mb-4">
                <PlusIcon className="mr-2 size-4" />
                {t("content.banners.addButton")}
              </Button>

              {bannersLoading ? (
                <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
              ) : banners.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("content.banners.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">{t("content.banners.image")}</TableHead>
                      <TableHead>{t("content.banners.titleCol")}</TableHead>
                      <TableHead>{t("content.banners.priority")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("content.banners.schedule")}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banners.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <img
                            src={b.imageUrl}
                            alt={b.title ?? t("content.banners.title")}
                            className="h-10 w-16 rounded object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {b.title || (
                            <span className="text-muted-foreground italic">
                              {t("content.banners.untitled")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{b.priority}</TableCell>
                        <TableCell>
                          <Badge
                            variant={b.isActive ? "default" : "secondary"}
                          >
                            {b.isActive ? t("common.active") : t("content.banners.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.startsAt || b.endsAt
                            ? `${fmtDate(b.startsAt)} → ${fmtDate(b.endsAt)}`
                            : t("content.banners.always")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditBanner(b)}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingBannerId(b.id)}
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
        </TabsContent>

        {/* ─────────── ANNOUNCEMENTS TAB ─────────── */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle>{t("content.announcements.title")}</CardTitle>
              <CardDescription>
                {t("content.announcements.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={openAddAnnouncement} className="mb-4">
                <PlusIcon className="mr-2 size-4" />
                {t("content.announcements.addButton")}
              </Button>

              {announcementsLoading ? (
                <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
              ) : announcements.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("content.announcements.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">{t("content.announcements.image")}</TableHead>
                      <TableHead>{t("content.announcements.titleCol")}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("content.announcements.body")}
                      </TableHead>
                      <TableHead>{t("content.announcements.priority")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcements.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.imageUrl ? (
                            <img
                              src={a.imageUrl}
                              alt={a.title}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                              <MegaphoneIcon className="size-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {a.title}
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-muted-foreground text-sm md:table-cell">
                          {a.body}
                        </TableCell>
                        <TableCell>{a.priority}</TableCell>
                        <TableCell>
                          <Badge
                            variant={a.isActive ? "default" : "secondary"}
                          >
                            {a.isActive ? t("common.active") : t("content.banners.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditAnnouncement(a)}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeletingAnnouncementId(a.id)
                              }
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
        </TabsContent>
      </Tabs>

      {/* ─────────── BANNER SHEET ─────────── */}
      <Sheet open={bannerSheetOpen} onOpenChange={setBannerSheetOpen}>
        <SheetContent className="flex flex-col overflow-y-auto px-6 sm:max-w-lg">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle>
              {editingBanner ? t("content.banners.editTitle") : t("content.banners.addTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 px-0">
            {/* Image */}
            <div className="space-y-1.5">
              <Label>
                {t("content.banners.imageLabel")} <span className="text-destructive">*</span>
              </Label>
              <ImageUpload
                value={bannerForm.imageUrl}
                onChange={(url) =>
                  setBannerForm((s) => ({ ...s, imageUrl: url }))
                }
                purpose="banner"
              />
              <p className="text-xs text-muted-foreground">
                {t("content.banners.imageHint")}
              </p>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>{t("content.banners.titleLabel")}</Label>
              <Input
                value={bannerForm.title}
                onChange={(e) =>
                  setBannerForm((s) => ({ ...s, title: e.target.value }))
                }
                placeholder={t("content.banners.titlePlaceholder")}
              />
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label>{t("content.banners.linkLabel")}</Label>
              <Input
                value={bannerForm.linkUrl}
                onChange={(e) =>
                  setBannerForm((s) => ({ ...s, linkUrl: e.target.value }))
                }
                placeholder={t("content.banners.linkPlaceholder")}
              />
            </div>

            {/* Priority + Active */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("content.banners.priorityLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={bannerForm.priority}
                  onChange={(e) =>
                    setBannerForm((s) => ({
                      ...s,
                      priority: Number(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("content.banners.priorityHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="banner-active"
                  aria-label="Banner active"
                  className="size-4 rounded"
                  checked={bannerForm.isActive}
                  onChange={(e) =>
                    setBannerForm((s) => ({
                      ...s,
                      isActive: e.target.checked,
                    }))
                  }
                />
                <Label htmlFor="banner-active">{t("content.banners.activeLabel")}</Label>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("content.banners.startsAt")}</Label>
                <Input
                  type="date"
                  value={bannerForm.startsAt}
                  onChange={(e) =>
                    setBannerForm((s) => ({
                      ...s,
                      startsAt: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("content.banners.endsAt")}</Label>
                <Input
                  type="date"
                  value={bannerForm.endsAt}
                  onChange={(e) =>
                    setBannerForm((s) => ({ ...s, endsAt: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setBannerSheetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveBanner}
              disabled={bannerSaving || !bannerForm.imageUrl}
              className="flex-1"
            >
              {bannerSaving
                ? t("common.saving")
                : editingBanner
                  ? t("common.update")
                  : t("common.create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─────────── ANNOUNCEMENT SHEET ─────────── */}
      <Sheet
        open={announcementSheetOpen}
        onOpenChange={setAnnouncementSheetOpen}
      >
        <SheetContent className="flex flex-col overflow-y-auto px-6 sm:max-w-lg">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle>
              {editingAnnouncement
                ? t("content.announcements.editTitle")
                : t("content.announcements.addTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 px-0">
            {/* English title + body */}
            <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <legend className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-wider">
                {t("content.announcements.englishLabel")}
              </legend>
              <div className="space-y-1.5">
                <Label>
                  {t("content.announcements.englishTitleLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={announcementForm.title}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      title: e.target.value,
                    }))
                  }
                  placeholder={t("content.announcements.englishTitlePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("content.announcements.englishBodyLabel")} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={announcementForm.body}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      body: e.target.value,
                    }))
                  }
                  placeholder={t("content.announcements.englishBodyPlaceholder")}
                  rows={3}
                />
              </div>
            </fieldset>

            {/* Myanmar title + body */}
            <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <legend className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-wider">
                {t("content.announcements.myanmarLabel")}
              </legend>
              <div className="space-y-1.5">
                <Label>{t("content.announcements.myanmarTitleLabel")}</Label>
                <Input
                  value={announcementForm.titleMy}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      titleMy: e.target.value,
                    }))
                  }
                  placeholder={t("content.announcements.myanmarTitlePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("content.announcements.myanmarBodyLabel")}</Label>
                <Textarea
                  value={announcementForm.bodyMy}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      bodyMy: e.target.value,
                    }))
                  }
                  placeholder={t("content.announcements.myanmarBodyPlaceholder")}
                  rows={3}
                />
              </div>
            </fieldset>

            {/* Thumbnail */}
            <div className="space-y-1.5">
              <Label>{t("content.announcements.thumbnailLabel")}</Label>
              <ImageUpload
                value={announcementForm.imageUrl}
                onChange={(url) =>
                  setAnnouncementForm((s) => ({ ...s, imageUrl: url }))
                }
                purpose="thumbnail"
              />
              <p className="text-xs text-muted-foreground">
                {t("content.announcements.thumbnailHint")}
              </p>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label>{t("content.announcements.linkLabel")}</Label>
              <Input
                value={announcementForm.linkUrl}
                onChange={(e) =>
                  setAnnouncementForm((s) => ({
                    ...s,
                    linkUrl: e.target.value,
                  }))
                }
                placeholder={t("content.announcements.linkPlaceholder")}
              />
            </div>

            {/* Priority + Active */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("content.announcements.priorityLabel")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={announcementForm.priority}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      priority: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="ann-active"
                  aria-label="Announcement active"
                  className="size-4 rounded"
                  checked={announcementForm.isActive}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      isActive: e.target.checked,
                    }))
                  }
                />
                <Label htmlFor="ann-active">{t("content.announcements.activeLabel")}</Label>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("content.announcements.startsAt")}</Label>
                <Input
                  type="date"
                  value={announcementForm.startsAt}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      startsAt: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("content.announcements.endsAt")}</Label>
                <Input
                  type="date"
                  value={announcementForm.endsAt}
                  onChange={(e) =>
                    setAnnouncementForm((s) => ({
                      ...s,
                      endsAt: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAnnouncementSheetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveAnnouncement}
              disabled={
                announcementSaving ||
                !announcementForm.title ||
                !announcementForm.body
              }
              className="flex-1"
            >
              {announcementSaving
                ? t("common.saving")
                : editingAnnouncement
                  ? t("common.update")
                  : t("common.create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─────────── DELETE BANNER DIALOG ─────────── */}
      <AlertDialog
        open={!!deletingBannerId}
        onOpenChange={(open) => !open && setDeletingBannerId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("content.banners.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("content.banners.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBanner}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─────────── DELETE ANNOUNCEMENT DIALOG ─────────── */}
      <AlertDialog
        open={!!deletingAnnouncementId}
        onOpenChange={(open) => !open && setDeletingAnnouncementId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("content.announcements.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("content.announcements.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAnnouncement}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
