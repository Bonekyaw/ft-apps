import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsController } from './maps.controller.js';
import { MapsService } from './maps.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [MapsController],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
