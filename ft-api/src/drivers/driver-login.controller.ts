import { Body, Controller, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DriversService } from './drivers.service.js';

@Controller('driver')
export class DriverLoginController {
  constructor(private readonly driversService: DriversService) {}

  /**
   * Public endpoint – validates whether an email is eligible for driver login.
   * Called by the ft-driver app BEFORE sending an OTP to avoid wasting emails.
   *
   * Returns `{ eligible: true }` or throws 400 with a descriptive message.
   */
  @Post('validate-login')
  @AllowAnonymous()
  async validateLogin(@Body() body: { email: string }) {
    return this.driversService.validateLoginEmail(body.email);
  }
}
