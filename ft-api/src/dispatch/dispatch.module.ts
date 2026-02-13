import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';
import { AblySignatureGuard } from './ably-signature.guard.js';
import { AblyWebhookController } from './ably-webhook.controller.js';
import { AblyPublisherService } from './ably-publisher.service.js';
import { DriverStatusController } from './driver-status.controller.js';
import { DriverStatusService } from './driver-status.service.js';
import { MatchingService } from './matching.service.js';
import { RideDispatchService } from './ride-dispatch.service.js';
import { PenaltyService } from './penalty.service.js';
import { PricingModule } from '../pricing/pricing.module.js';

@Module({
  imports: [ConfigModule, PricingModule],
  controllers: [DriverStatusController, AblyWebhookController],
  providers: [
    PrismaService,
    DriverStatusService,
    MatchingService,
    AblySignatureGuard,
    AblyPublisherService,
    RideDispatchService,
    PenaltyService,
  ],
  exports: [
    DriverStatusService,
    MatchingService,
    AblyPublisherService,
    RideDispatchService,
    PenaltyService,
  ],
})
export class DispatchModule {}
