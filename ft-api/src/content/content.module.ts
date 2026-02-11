import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [ContentController],
  providers: [PrismaService],
})
export class ContentModule {}
