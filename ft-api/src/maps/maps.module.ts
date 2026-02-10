import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsController } from './maps.controller.js';
import { MapsService } from './maps.service.js';
import { RouteQuoteService } from './route-quote.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
@Module({
  imports: [ConfigModule, PricingModule],
  controllers: [MapsController],
  providers: [MapsService, RouteQuoteService],
  exports: [MapsService, RouteQuoteService],
})
export class MapsModule {}
