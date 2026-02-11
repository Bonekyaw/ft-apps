import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import type { AutocompleteRequestBody } from './maps.service.js';
import { MapsService } from './maps.service.js';
import {
  RouteQuoteService,
  type RouteQuoteInput,
} from './route-quote.service.js';

@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(
    private readonly maps: MapsService,
    private readonly routeQuote: RouteQuoteService,
  ) {}

  /** Requires valid session (Bearer or cookie). Revoked sessions get 401; mobile app signs out on 401. */
  @Post('autocomplete')
  @HttpCode(HttpStatus.OK)
  async autocomplete(@Body() body: AutocompleteRequestBody) {
    this.logger.log(`Autocomplete request: ${JSON.stringify(body)}`);
    const suggestions = await this.maps.autocomplete(body);
    return { suggestions };
  }

  /**
   * Compute route (Google Routes API), calculate fare (RidePricingService), save RouteQuote, return polyline + fares.
   * Mobile sends pickup and destination coordinates; server returns encodedPolyline and Standard / Taxi Plus prices.
   */
  @Post('route')
  @HttpCode(HttpStatus.OK)
  async getRouteQuote(@Body() body: RouteQuoteInput) {
    this.logger.log(`Route quote request: ${JSON.stringify(body)}`);
    const result = await this.routeQuote.getQuote(body);
    return result;
  }
}
