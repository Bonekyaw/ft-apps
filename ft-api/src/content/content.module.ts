import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';
import { ImageService } from './image.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [ContentController],
  providers: [PrismaService, ImageService],
  exports: [ImageService],
})
export class ContentModule {}
