import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * NestJS Guard that verifies the Ably webhook HMAC-SHA256 signature.
 *
 * Ably sends two headers on batched webhook requests:
 *   - `X-Ably-Key`       — the key name (appId.keyId), e.g. "VoLs3g.3KOGzQ"
 *   - `X-Ably-Signature`  — base64-encoded HMAC-SHA256 of the raw body
 *
 * The HMAC is computed using the key **secret** (the portion after `:` in the
 * full API key stored in ABLY_API_KEY).
 */
@Injectable()
export class AblySignatureGuard implements CanActivate {
  private readonly logger = new Logger(AblySignatureGuard.name);
  private readonly keyName: string;
  private readonly keySecret: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ABLY_API_KEY') ?? '';
    const colonIdx = apiKey.indexOf(':');
    if (colonIdx === -1) {
      this.logger.error(
        'ABLY_API_KEY env var is missing or invalid (expected "keyName:keySecret").',
      );
      this.keyName = '';
      this.keySecret = '';
    } else {
      this.keyName = apiKey.slice(0, colonIdx); // e.g. "VoLs3g.3KOGzQ"
      this.keySecret = apiKey.slice(colonIdx + 1); // everything after ":"
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();

    // ── 1. Extract headers ──
    const headerKey = req.headers['x-ably-key'] as string | undefined;
    const headerSig = req.headers['x-ably-signature'] as string | undefined;

    if (!headerKey || !headerSig) {
      this.logger.warn('Ably webhook missing X-Ably-Key or X-Ably-Signature.');
      throw new ForbiddenException('Missing Ably signature headers.');
    }

    // ── 2. Validate key name matches ──
    // Ably may send the full key name ("appId.keyId") or just the keyId portion.
    const keyId = this.keyName.split('.').pop() ?? '';
    if (headerKey !== this.keyName && headerKey !== keyId) {
      this.logger.warn(
        `Ably key mismatch: expected "${this.keyName}" or "${keyId}", got "${headerKey}".`,
      );
      throw new ForbiddenException('Ably key mismatch.');
    }

    // ── 3. Read raw body ──
    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      this.logger.warn('No raw body available for signature verification.');
      throw new ForbiddenException('Cannot verify signature without raw body.');
    }

    // ── 4. Compute expected signature ──
    const expected = createHmac('sha256', this.keySecret)
      .update(rawBody)
      .digest('base64');

    // ── 5. Constant-time comparison ──
    const sigBuf = Buffer.from(headerSig, 'base64');
    const expectedBuf = Buffer.from(expected, 'base64');

    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      this.logger.warn('Ably webhook signature verification failed.');
      throw new ForbiddenException('Invalid Ably signature.');
    }

    return true;
  }
}
