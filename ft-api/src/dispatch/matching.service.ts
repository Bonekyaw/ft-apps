import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

/** Row returned by the nearby-drivers PostGIS query. */
export interface NearbyDriver {
  driverId: string;
  userId: string;
  driverName: string;
  driverImage: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  distanceMeters: number;
  isVip: boolean;
}

/** Optional rider-preference filters for driver matching. */
export interface DriverMatchFilters {
  vehicleType?: string | null;
  fuelType?: string | null;
  petFriendly?: boolean;
  extraPassengers?: boolean;
}

/** Default search radius in metres (5 km). */
const DEFAULT_RADIUS_METERS = 5_000;

/** Default maximum number of drivers to return. */
const DEFAULT_LIMIT = 5;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find the closest ONLINE, APPROVED drivers within a given radius of
   * a pickup point using PostGIS `ST_DWithin` (geography — metres).
   *
   * Uses denormalized fields on the Driver table (vehicleType, fuelType,
   * maxPassengers, petFriendly) so no JOIN on vehicle is needed.
   *
   * Results are ranked by a 5-tier priority hierarchy:
   *   P1: VIP drivers first
   *   P2: Among VIPs, "Taxi Plus" vehicle type first
   *   P3: Higher rating first
   *   P4: Earlier registration (seniority) first
   *   P5: More completed rides first
   *
   * Drivers currently under penalty are excluded.
   */
  async findNearbyDrivers(
    pickupLat: number,
    pickupLng: number,
    radiusM: number = DEFAULT_RADIUS_METERS,
    limit: number = DEFAULT_LIMIT,
    filters: DriverMatchFilters = {},
  ): Promise<NearbyDriver[]> {
    // Build dynamic WHERE clauses and params
    // $1=lng, $2=lat (for ST_Distance), $3=lng, $4=lat (for ST_DWithin), $5=radius
    const params: unknown[] = [pickupLng, pickupLat, pickupLng, pickupLat, radiusM];
    let paramIdx = params.length; // next $N is paramIdx+1

    const extraWhere: string[] = [];

    // Vehicle type filter (denormalized on driver)
    if (filters.vehicleType && filters.vehicleType !== 'ANY') {
      paramIdx++;
      params.push(filters.vehicleType);
      extraWhere.push(`AND d."vehicleType" = $${paramIdx}::"VehicleType"`);
    }

    // Fuel type filter (denormalized on driver)
    if (filters.fuelType && filters.fuelType !== 'ANY') {
      paramIdx++;
      params.push(filters.fuelType);
      extraWhere.push(`AND d."fuelType" = $${paramIdx}::"FuelType"`);
    }

    // Pet-friendly filter
    if (filters.petFriendly) {
      extraWhere.push('AND d."petFriendly" = true');
    }

    // Extra passengers filter (denormalized maxPassengers on driver)
    if (filters.extraPassengers) {
      extraWhere.push('AND d."maxPassengers" >= 5');
    }

    // Penalty filter — exclude drivers currently under penalty
    extraWhere.push('AND (d."penaltyUntil" IS NULL OR d."penaltyUntil" < NOW())');

    paramIdx++;
    params.push(limit);

    const sql = `
      SELECT
        d.id                          AS "driverId",
        d."userId"                    AS "userId",
        u.name                        AS "driverName",
        u.image                       AS "driverImage",
        dl.latitude::float            AS "latitude",
        dl.longitude::float           AS "longitude",
        dl.heading::float             AS "heading",
        d."isVip"                     AS "isVip",
        ST_Distance(
          dl.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::float                      AS "distanceMeters"
      FROM driver_location dl
      JOIN driver d  ON d.id  = dl."driverId"
      JOIN "user"  u ON u.id  = d."userId"
      WHERE d.status           = 'ONLINE'
        AND d."approvalStatus" = 'APPROVED'
        AND dl.location IS NOT NULL
        AND ST_DWithin(
              dl.location,
              ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
              $5
            )
        ${extraWhere.join('\n        ')}
      ORDER BY
        d."isVip" DESC,
        CASE WHEN d."isVip" THEN (CASE WHEN d."vehicleType" = 'PLUS' THEN 0 ELSE 1 END) ELSE 2 END ASC,
        d."averageRating" DESC,
        d."createdAt" ASC,
        d."totalRides" DESC
      LIMIT $${paramIdx}
    `;

    const rows = await this.prisma.$queryRawUnsafe<NearbyDriver[]>(sql, ...params);

    this.logger.log(
      `Found ${rows.length} online driver(s) within ${radiusM}m of (${pickupLat}, ${pickupLng}) [filters: ${JSON.stringify(filters)}]`,
    );

    return rows;
  }
}
