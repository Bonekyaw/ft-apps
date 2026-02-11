import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma.service.js';
import { ImageService } from './image.service.js';

// ── Auth helpers ──

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];

function assertAdmin(session: UserSession | null): void {
  if (!session?.user) throw new UnauthorizedException('Unauthorized');
  const role = session.user.role;
  if (typeof role !== 'string' || !ADMIN_ROLES.includes(role.toUpperCase())) {
    throw new ForbiddenException('Admin access required');
  }
}

// ── DTOs ──

interface BannerBody {
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  priority?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

interface AnnouncementBody {
  title: string;
  titleMy?: string;
  body: string;
  bodyMy?: string;
  imageUrl?: string;
  linkUrl?: string;
  priority?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

@Controller()
export class ContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
  ) {}

  // ===================================================
  // IMAGE UPLOAD
  // ===================================================

  /**
   * POST /admin/upload-image
   * Accepts a multipart file, optimizes it (resize + WebP), uploads to Vercel Blob.
   * Query param `purpose` controls target dimensions: "banner" or "thumbnail".
   */
  @Post('admin/upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Session() session: UserSession | null,
    @UploadedFile() file: Express.Multer.File,
    @Body('purpose') purpose?: string,
  ) {
    assertAdmin(session);
    const url = await this.imageService.uploadOptimized(file, {
      purpose: (purpose as 'banner' | 'thumbnail') || 'banner',
    });
    return { url };
  }

  // ===================================================
  // PUBLIC ENDPOINTS (mobile app)
  // ===================================================

  /** GET /promotions/banners — active banners for the mobile app. */
  @Get('promotions/banners')
  @AllowAnonymous()
  async getPublicBanners() {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { priority: 'asc' },
      select: { id: true, title: true, imageUrl: true, linkUrl: true },
    });
    return { banners };
  }

  /** GET /announcements — active announcements for the mobile app. */
  @Get('announcements')
  @AllowAnonymous()
  async getPublicAnnouncements() {
    const now = new Date();
    const announcements = await this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        titleMy: true,
        body: true,
        bodyMy: true,
        imageUrl: true,
        linkUrl: true,
        createdAt: true,
      },
    });
    return { announcements };
  }

  // ===================================================
  // ADMIN — BANNERS CRUD
  // ===================================================

  /** GET /admin/banners — list ALL banners (including inactive). */
  @Get('admin/banners')
  async adminListBanners(@Session() session: UserSession | null) {
    assertAdmin(session);
    return this.prisma.banner.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** POST /admin/banners — create a new banner. */
  @Post('admin/banners')
  async adminCreateBanner(
    @Session() session: UserSession | null,
    @Body() body: BannerBody,
  ) {
    assertAdmin(session);
    return this.prisma.banner.create({
      data: {
        title: body.title ?? null,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl ?? null,
        priority: body.priority ?? 0,
        isActive: body.isActive ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
  }

  /** PUT /admin/banners/:id — update an existing banner. */
  @Put('admin/banners/:id')
  async adminUpdateBanner(
    @Session() session: UserSession | null,
    @Param('id') id: string,
    @Body() body: Partial<BannerBody>,
  ) {
    assertAdmin(session);

    // If imageUrl changed, delete old blob
    if (body.imageUrl) {
      const existing = await this.prisma.banner.findUnique({
        where: { id },
        select: { imageUrl: true },
      });
      if (existing?.imageUrl && existing.imageUrl !== body.imageUrl) {
        await this.imageService.deleteBlob(existing.imageUrl);
      }
    }

    return this.prisma.banner.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title ?? null }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl ?? null }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.startsAt !== undefined && {
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
        }),
        ...(body.endsAt !== undefined && {
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        }),
      },
    });
  }

  /** DELETE /admin/banners/:id — delete a banner and its blob. */
  @Delete('admin/banners/:id')
  async adminDeleteBanner(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertAdmin(session);
    const banner = await this.prisma.banner.delete({ where: { id } });
    if (banner.imageUrl) {
      await this.imageService.deleteBlob(banner.imageUrl);
    }
    return { success: true };
  }

  // ===================================================
  // ADMIN — ANNOUNCEMENTS CRUD
  // ===================================================

  /** GET /admin/announcements — list ALL announcements (including inactive). */
  @Get('admin/announcements')
  async adminListAnnouncements(@Session() session: UserSession | null) {
    assertAdmin(session);
    return this.prisma.announcement.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** POST /admin/announcements — create a new announcement. */
  @Post('admin/announcements')
  async adminCreateAnnouncement(
    @Session() session: UserSession | null,
    @Body() body: AnnouncementBody,
  ) {
    assertAdmin(session);
    return this.prisma.announcement.create({
      data: {
        title: body.title,
        titleMy: body.titleMy ?? null,
        body: body.body,
        bodyMy: body.bodyMy ?? null,
        imageUrl: body.imageUrl ?? null,
        linkUrl: body.linkUrl ?? null,
        priority: body.priority ?? 0,
        isActive: body.isActive ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
  }

  /** PUT /admin/announcements/:id — update an existing announcement. */
  @Put('admin/announcements/:id')
  async adminUpdateAnnouncement(
    @Session() session: UserSession | null,
    @Param('id') id: string,
    @Body() body: Partial<AnnouncementBody>,
  ) {
    assertAdmin(session);

    // If imageUrl changed, delete old blob
    if (body.imageUrl !== undefined) {
      const existing = await this.prisma.announcement.findUnique({
        where: { id },
        select: { imageUrl: true },
      });
      if (
        existing?.imageUrl &&
        body.imageUrl &&
        existing.imageUrl !== body.imageUrl
      ) {
        await this.imageService.deleteBlob(existing.imageUrl);
      }
      // If imageUrl is cleared, also delete old blob
      if (existing?.imageUrl && !body.imageUrl) {
        await this.imageService.deleteBlob(existing.imageUrl);
      }
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.titleMy !== undefined && { titleMy: body.titleMy || null }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.bodyMy !== undefined && { bodyMy: body.bodyMy || null }),
        ...(body.imageUrl !== undefined && {
          imageUrl: body.imageUrl ?? null,
        }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl ?? null }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.startsAt !== undefined && {
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
        }),
        ...(body.endsAt !== undefined && {
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        }),
      },
    });
  }

  /** DELETE /admin/announcements/:id — delete an announcement and its blob. */
  @Delete('admin/announcements/:id')
  async adminDeleteAnnouncement(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertAdmin(session);
    const announcement = await this.prisma.announcement.delete({
      where: { id },
    });
    if (announcement.imageUrl) {
      await this.imageService.deleteBlob(announcement.imageUrl);
    }
    return { success: true };
  }
}
