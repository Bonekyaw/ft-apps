import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma.service.js';

@Controller()
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /promotions/banners
   * Returns active banners ordered by priority (lowest first).
   * Filters out banners whose schedule has not started or has ended.
   */
  @Get('promotions/banners')
  @AllowAnonymous()
  async getBanners() {
    const now = new Date();

    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { priority: 'asc' },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        linkUrl: true,
      },
    });

    return { banners };
  }

  /**
   * GET /announcements
   * Returns active announcements ordered by priority then newest first.
   */
  @Get('announcements')
  @AllowAnonymous()
  async getAnnouncements() {
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
        body: true,
        imageUrl: true,
        linkUrl: true,
        createdAt: true,
      },
    });

    return { announcements };
  }
}
