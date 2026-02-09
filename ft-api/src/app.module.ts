import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth.js'; // Your Better Auth instance
import { PrismaService } from './prisma.service.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [ConfigModule.forRoot(), AuthModule.forRoot({ auth }), UsersModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
