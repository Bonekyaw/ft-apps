import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

/** Row returned by the nearby-drivers PostGIS query. */
export interface NearbyDriver {
  driverId: string;
  userId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  distanceMeters: number;
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
   * Optionally filters by vehicle type, fuel type, pet-friendly, and
   * minimum capacity (for extra passengers).
   */
  async findNearbyDrivers(
    pickupLat: number,
    pickupLng: number,
    radiusM: number = DEFAULT_RADIUS_METERS,
    limit: number = DEFAULT_LIMIT,
    filters: DriverMatchFilters = {},
  ): Promise<NearbyDriver[]> {
    const needsVehicleJoin =
      (filters.vehicleType && filters.vehicleType !== 'ANY') ||
      (filters.fuelType && filters.fuelType !== 'ANY') ||
      filters.extraPassengers;

    // Build dynamic WHERE clauses and params
    const params: unknown[] = [pickupLng, pickupLat, pickupLng, pickupLat, radiusM];
    let paramIdx = params.length; // next $N index (1-based: $6, $7, ...)

    const extraWhere: string[] = [];
    const extraJoin: string[] = [];

    if (needsVehicleJoin) {
      extraJoin.push('JOIN vehicle v ON v."driverId" = d.id AND v."isActive" = true');
    }

    if (filters.vehicleType && filters.vehicleType !== 'ANY') {
      paramIdx++;
      params.push(filters.vehicleType);
      extraWhere.push(`AND v.type = $${paramIdx}::\"VehicleType\"`);
    }

    if (filters.fuelType && filters.fuelType !== 'ANY') {
      paramIdx++;
      params.push(filters.fuelType);
      extraWhere.push(`AND v."fuelType" = $${paramIdx}::\"FuelType\"`);
    }

    if (filters.petFriendly) {
      extraWhere.push('AND d."petFriendly" = true');
    }

    if (filters.extraPassengers) {
      if (!needsVehicleJoin) {
        // Vehicle join wasn't added yet; add it now
        extraJoin.push('JOIN vehicle v ON v."driverId" = d.id AND v."isActive" = true');
      }
      extraWhere.push('AND v.capacity >= 5');
    }

    paramIdx++;
    params.push(limit);

    const sql = `
      SELECT
        d.id                          AS "driverId",
        d."userId"                    AS "userId",
        u.name                        AS "driverName",
        dl.latitude::float            AS "latitude",
        dl.longitude::float           AS "longitude",
        dl.heading::float             AS "heading",
        ST_Distance(
          dl.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::float                      AS "distanceMeters"
      FROM driver_location dl
      JOIN driver d  ON d.id  = dl."driverId"
      JOIN "user"  u ON u.id  = d."userId"
      ${extraJoin.join('\n      ')}
      WHERE d.status           = 'ONLINE'
        AND d."approvalStatus" = 'APPROVED'
        AND dl.location IS NOT NULL
        AND ST_DWithin(
              dl.location,
              ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
              $5
            )
        ${extraWhere.join('\n        ')}
      ORDER BY "distanceMeters" ASC
      LIMIT $${paramIdx}
    `;

    const rows = await this.prisma.$queryRawUnsafe<NearbyDriver[]>(sql, ...params);

    this.logger.log(
      `Found ${rows.length} online driver(s) within ${radiusM}m of (${pickupLat}, ${pickupLng}) [filters: ${JSON.stringify(filters)}]`,
    );

    return rows;
  }
}
