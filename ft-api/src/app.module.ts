import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import path from 'path';
import { fileURLToPath } from 'url';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth.js';
import { PrismaService } from './prisma.service.js';
import { MapsModule } from './maps/maps.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { UsersModule } from './users/users.module.js';
import { ContentModule } from './content/content.module.js';
import { RidesModule } from './rides/rides.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    AuthModule.forRoot({ auth }),
    UsersModule,
    MapsModule,
    PricingModule,
    ContentModule,
    RidesModule,
    DriversModule,
    DispatchModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
