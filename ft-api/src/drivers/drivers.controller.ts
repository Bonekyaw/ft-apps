import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DriversService } from './drivers.service.js';
import { ImageService } from '../content/image.service.js';

// ── Auth helpers ──

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];
const ELEVATED_ROLES = ['SUPERADMIN', 'MANAGER', 'OPERATION'];

function assertAdmin(session: UserSession | null): void {
  if (!session?.user) throw new UnauthorizedException('Unauthorized');
  const role = session.user.role;
  if (typeof role !== 'string' || !ADMIN_ROLES.includes(role.toUpperCase())) {
    throw new ForbiddenException('Admin access required');
  }
}

function assertElevated(session: UserSession | null): void {
  assertAdmin(session);
  const role = (session!.user.role as string).toUpperCase();
  if (!ELEVATED_ROLES.includes(role)) {
    throw new ForbiddenException(
      'Only superadmin, manager, or operation roles can perform this action',
    );
  }
}

interface CreateDriverDto {
  name: string;
  email: string;
}

interface UpdateDriverDto {
  licenseNumber?: string;
  licenseExpiry?: string;
  nationalId?: string;
}

@Controller('admin/drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly imageService: ImageService,
  ) {}

  /** Create a new driver user + Driver record. */
  @Post()
  async create(
    @Session() session: UserSession | null,
    @Body() dto: CreateDriverDto,
  ) {
    assertAdmin(session);
    return this.driversService.createDriver(dto.name, dto.email);
  }

  /** List all drivers with their user info. */
  @Get()
  async list(@Session() session: UserSession | null) {
    assertAdmin(session);
    return this.driversService.listDrivers();
  }

  /** Get a single driver with details. */
  @Get(':id')
  async getOne(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertAdmin(session);
    return this.driversService.getDriver(id);
  }

  /** Approve a driver. */
  @Patch(':id/approve')
  async approve(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertElevated(session);
    return this.driversService.setApprovalStatus(id, 'APPROVED');
  }

  /** Reject a driver. */
  @Patch(':id/reject')
  async reject(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertElevated(session);
    return this.driversService.setApprovalStatus(id, 'REJECTED');
  }

  /** Suspend a driver. */
  @Patch(':id/suspend')
  async suspend(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertElevated(session);
    return this.driversService.setApprovalStatus(id, 'SUSPENDED');
  }

  /** Update driver details (license, NRC, etc.). */
  @Patch(':id')
  async update(
    @Session() session: UserSession | null,
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    assertElevated(session);
    return this.driversService.updateDriver(id, dto);
  }

  /** Delete driver account. */
  @Delete(':id')
  async remove(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertElevated(session);
    return this.driversService.deleteDriver(id);
  }

  /** Revoke all sessions for a driver. */
  @Post(':id/revoke-sessions')
  async revokeSessions(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertElevated(session);
    return this.driversService.revokeSessions(id);
  }

  /** Upload a document image (NRC front/back, license, etc.). */
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Session() session: UserSession | null,
    @Param('id') id: string,
    @Body() body: { field: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertElevated(session);

    const allowedFields = ['licenseImageUrl', 'nationalIdImageUrl'];
    if (!allowedFields.includes(body.field)) {
      throw new ForbiddenException(
        `Invalid document field: ${body.field}. Allowed: ${allowedFields.join(', ')}`,
      );
    }

    const url = await this.imageService.uploadOptimized(file, {
      purpose: 'document',
    });
    return this.driversService.updateDriverDocument(id, body.field, url);
  }
}
