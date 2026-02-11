import { Controller, Get } from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import {
  Session,
  type UserSession,
  AllowAnonymous,
  OptionalAuth,
} from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UsersController {
  @Get('me')
  getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }

  @Get('public')
  @AllowAnonymous()
  getPublic(@I18n() i18n: I18nContext) {
    const message = i18n.t('common.publicRoute');
    return { message };
  }

  @Get('optional')
  @OptionalAuth() // Authentication is optional
  getOptional(@Session() session: UserSession) {
    return { authenticated: !!session };
  }
}
