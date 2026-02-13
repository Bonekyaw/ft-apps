import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service.js';

/**
 * Manages the driver penalty & silence system.
 *
 * Rules:
 * - VIP drivers are **exempt** from all penalties.
 * - Non-VIP: every 3rd rejection/skip → escalating silence (5, 10, 15… min).
 * - Non-VIP: cancels an accepted ride → immediate 5-min silence + 0.1 rating deduction.
 * - Daily midnight cron resets all rejection counts to 0.
 * - Penalties are applied silently — drivers are NOT notified.
 */
@Injectable()
export class PenaltyService {
  private readonly logger = new Logger(PenaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Rejection / Skip ────────────────────────────────────────

  /**
   * Record a driver rejection (explicit skip).
   * VIP drivers are exempt. For non-VIP drivers, increments
   * `rejectionCount`. Every 3rd rejection triggers an escalating
   * silence period.
   */
  async recordRejection(driverUserId: string): Promise<void> {
    try {
      // Check VIP status first — VIP drivers are exempt
      const existing = await this.prisma.driver.findUnique({
        where: { userId: driverUserId },
        select: { isVip: true },
      });

      if (!existing) return;
      if (existing.isVip) {
        this.logger.log(
          `Driver ${driverUserId}: VIP — skip penalty exempt`,
        );
        return;
      }

      // Atomically increment and return the updated count
      const driver = await this.prisma.driver.update({
        where: { userId: driverUserId },
        data: { rejectionCount: { increment: 1 } },
        select: { userId: true, rejectionCount: true },
      });

      const count = driver.rejectionCount;

      if (count % 3 === 0) {
        // Escalating penalty: 5, 10, 15, 20… minutes
        const penaltyMinutes = 5 + (count / 3 - 1) * 5;
        const penaltyUntil = new Date(Date.now() + penaltyMinutes * 60_000);

        await this.prisma.driver.update({
          where: { userId: driverUserId },
          data: {
            penaltyUntil,
            lastPenaltyMinutes: penaltyMinutes,
          },
        });

        this.logger.warn(
          `Driver ${driverUserId}: ${count} rejections → silenced for ${penaltyMinutes} min (until ${penaltyUntil.toISOString()})`,
        );
      } else {
        this.logger.log(
          `Driver ${driverUserId}: rejection count now ${count} (next penalty at ${Math.ceil(count / 3) * 3})`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to record rejection for driver ${driverUserId}: ${err}`,
      );
    }
  }

  // ── Driver Cancellation ────────────────────────────────────

  /**
   * Penalise a driver who cancels an already-accepted ride.
   * VIP drivers are exempt. For non-VIP drivers: immediate
   * 5-minute silence + 0.1 rating deduction.
   */
  async recordCancellation(driverUserId: string): Promise<void> {
    try {
      const driver = await this.prisma.driver.findUnique({
        where: { userId: driverUserId },
        select: { isVip: true, averageRating: true },
      });

      if (!driver) {
        this.logger.warn(
          `recordCancellation: driver not found for userId ${driverUserId}`,
        );
        return;
      }

      if (driver.isVip) {
        this.logger.log(
          `Driver ${driverUserId}: VIP — cancellation penalty exempt`,
        );
        return;
      }

      const currentRating = Number(driver.averageRating);
      const newRating = Math.max(0, parseFloat((currentRating - 0.1).toFixed(1)));
      const penaltyMinutes = 5;
      const penaltyUntil = new Date(Date.now() + penaltyMinutes * 60_000);

      await this.prisma.driver.update({
        where: { userId: driverUserId },
        data: {
          penaltyUntil,
          lastPenaltyMinutes: penaltyMinutes,
          averageRating: newRating,
        },
      });

      this.logger.warn(
        `Driver ${driverUserId}: cancelled accepted ride → silenced ${penaltyMinutes} min, rating ${currentRating} → ${newRating}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to record cancellation penalty for driver ${driverUserId}: ${err}`,
      );
    }
  }

  // ── Daily Cron Reset ───────────────────────────────────────

  /**
   * Reset all non-VIP drivers' rejectionCount to 0 at midnight every day.
   * VIP drivers never accumulate rejections, so this only affects non-VIPs.
   */
  @Cron('0 0 * * *')
  async resetAllRejectionCounts(): Promise<void> {
    try {
      const result = await this.prisma.driver.updateMany({
        where: { rejectionCount: { gt: 0 }, isVip: false },
        data: { rejectionCount: 0 },
      });

      this.logger.log(
        `Daily reset: cleared rejectionCount for ${result.count} driver(s)`,
      );
    } catch (err: unknown) {
      this.logger.error(`Daily rejection reset failed: ${err}`);
    }
  }
}
