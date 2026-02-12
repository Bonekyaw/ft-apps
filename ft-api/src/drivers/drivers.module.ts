import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller.js';
import { DriverLoginController } from './driver-login.controller.js';
import { DriversService } from './drivers.service.js';
import { PrismaService } from '../prisma.service.js';
import { ContentModule } from '../content/content.module.js';

@Module({
  imports: [ContentModule],
  controllers: [DriversController, DriverLoginController],
  providers: [PrismaService, DriversService],
})
export class DriversModule {}
