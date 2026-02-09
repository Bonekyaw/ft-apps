import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { AutocompleteRequestBody } from './maps.service.js';
import { MapsService } from './maps.service.js';

@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(private readonly maps: MapsService) {}

  @Post('autocomplete')
  @HttpCode(HttpStatus.OK)
  @AllowAnonymous()
  async autocomplete(@Body() body: AutocompleteRequestBody) {
    this.logger.log(`Autocomplete request: ${JSON.stringify(body)}`);
    const suggestions = await this.maps.autocomplete(body);
    return { suggestions };
  }
}
