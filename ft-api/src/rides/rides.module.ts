import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller.js';
import { RidesService } from './rides.service.js';
import { ImageService } from '../content/image.service.js';
import { PrismaService } from '../prisma.service.js';
import { DispatchModule } from '../dispatch/dispatch.module.js';

@Module({
  imports: [DispatchModule],
  controllers: [RidesController],
  providers: [RidesService, ImageService, PrismaService],
})
export class RidesModule {}
