import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AblySignatureGuard } from './ably-signature.guard.js';
import { DriverStatusService } from './driver-status.service.js';

// ── Ably presence action codes ──
const PRESENCE_ENTER = 2;
const PRESENCE_LEAVE = 3;

// ── Payload types for batched Ably webhooks ──

interface AblyPresenceMessage {
  clientId?: string;
  action: number;
  timestamp?: number;
  data?: unknown;
}

interface AblyWebhookItem {
  source?: string;
  name?: string;
  timestamp?: number;
  data?: {
    channelId?: string;
    presence?: AblyPresenceMessage[];
  };
}

interface AblyBatchedPayload {
  items?: AblyWebhookItem[];
}

/**
 * Receives Ably Reactor Webhook calls for presence events on the
 * `drivers:available` channel.
 *
 * - `enter` (action 2) → driver goes ONLINE
 * - `leave` (action 3) → driver goes OFFLINE
 *
 * Secured by {@link AblySignatureGuard} which verifies the HMAC-SHA256
 * signature Ably sends on every batched request.
 */
@Controller('webhooks/ably')
export class AblyWebhookController {
  private readonly logger = new Logger(AblyWebhookController.name);

  constructor(private readonly statusService: DriverStatusService) {}

  @Post('presence')
  @AllowAnonymous()
  @UseGuards(AblySignatureGuard)
  async handlePresence(@Body() payload: AblyBatchedPayload) {
    const items = payload.items ?? [];
    let processed = 0;

    for (const item of items) {
      // Only handle presence events
      if (item.source !== 'channel.presence') continue;

      const presenceList = item.data?.presence ?? [];

      for (const msg of presenceList) {
        const clientId = msg.clientId;
        if (!clientId) continue;

        if (msg.action === PRESENCE_ENTER) {
          await this.statusService.setStatusByUserId(clientId, 'ONLINE');
          processed++;
        } else if (msg.action === PRESENCE_LEAVE) {
          await this.statusService.setStatusByUserId(clientId, 'OFFLINE');
          processed++;
        }
      }
    }

    this.logger.log(
      `Processed ${processed} presence event(s) from ${items.length} item(s).`,
    );

    return { ok: true, processed };
  }
}
