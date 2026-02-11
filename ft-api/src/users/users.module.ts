import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [UsersController],
  providers: [PrismaService],
})
export class UsersModule {}
