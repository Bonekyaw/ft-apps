import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';
import { AblySignatureGuard } from './ably-signature.guard.js';
import { AblyWebhookController } from './ably-webhook.controller.js';
import { DriverStatusController } from './driver-status.controller.js';
import { DriverStatusService } from './driver-status.service.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [DriverStatusController, AblyWebhookController],
  providers: [
    PrismaService,
    DriverStatusService,
    MatchingService,
    AblySignatureGuard,
  ],
  exports: [DriverStatusService, MatchingService],
})
export class DispatchModule {}
