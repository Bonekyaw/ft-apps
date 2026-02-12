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
   * @param pickupLat  Latitude of the pickup point
   * @param pickupLng  Longitude of the pickup point
   * @param radiusM    Search radius in metres (default 5 000)
   * @param limit      Maximum drivers to return (default 5)
   */
  async findNearbyDrivers(
    pickupLat: number,
    pickupLng: number,
    radiusM: number = DEFAULT_RADIUS_METERS,
    limit: number = DEFAULT_LIMIT,
  ): Promise<NearbyDriver[]> {
    // ST_MakePoint takes (longitude, latitude)
    const rows = await this.prisma.$queryRaw<NearbyDriver[]>`
      SELECT
        d.id                          AS "driverId",
        d."userId"                    AS "userId",
        u.name                        AS "driverName",
        dl.latitude::float            AS "latitude",
        dl.longitude::float           AS "longitude",
        dl.heading::float             AS "heading",
        ST_Distance(
          dl.location,
          ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography
        )::float                      AS "distanceMeters"
      FROM driver_location dl
      JOIN driver d  ON d.id  = dl."driverId"
      JOIN "user"  u ON u.id  = d."userId"
      WHERE d.status           = 'ONLINE'
        AND d."approvalStatus" = 'APPROVED'
        AND dl.location IS NOT NULL
        AND ST_DWithin(
              dl.location,
              ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography,
              ${radiusM}
            )
      ORDER BY "distanceMeters" ASC
      LIMIT ${limit}
    `;

    this.logger.log(
      `Found ${rows.length} online driver(s) within ${radiusM}m of (${pickupLat}, ${pickupLng})`,
    );

    return rows;
  }
}
