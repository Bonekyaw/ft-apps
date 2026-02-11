import { Module } from '@nestjs/common';
import { RidePricingService } from './ride-pricing.service.js';
import { PricingCacheService } from './pricing-cache.service.js';
import { PricingController } from './pricing.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [PricingController],
  providers: [PrismaService, PricingCacheService, RidePricingService],
  exports: [RidePricingService, PricingCacheService],
})
export class PricingModule {}
