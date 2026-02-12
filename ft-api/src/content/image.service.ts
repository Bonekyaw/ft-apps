import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { put, del } from '@vercel/blob';

/** Max input file size before optimization: 10 MB. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Target dimensions for optimized images. */
const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 480;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 400;
const PICKUP_WIDTH = 800;
const PICKUP_HEIGHT = 600;
const DOCUMENT_WIDTH = 1200;
const DOCUMENT_HEIGHT = 900;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

interface OptimizeOptions {
  /** Purpose determines target dimensions. */
  purpose: 'banner' | 'thumbnail' | 'pickup' | 'document';
}

@Injectable()
export class ImageService {
  /**
   * Optimize an uploaded image buffer and upload to Vercel Blob.
   * Returns the public URL of the uploaded blob.
   */
  async uploadOptimized(
    file: Express.Multer.File,
    options: OptimizeOptions,
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF, AVIF`,
      );
    }

    if (file.size > MAX_INPUT_BYTES) {
      throw new BadRequestException(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB`,
      );
    }

    const { width, height } = this.getDimensions(options.purpose);

    // Optimize: resize, convert to WebP, compress
    const optimized = await sharp(file.buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Build a unique filename
    const timestamp = Date.now();
    const safeName = file.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const filename = `${options.purpose}/${timestamp}-${safeName}.webp`;

    // Upload to Vercel Blob
    const blob = await put(filename, optimized, {
      access: 'public',
      contentType: 'image/webp',
    });

    return blob.url;
  }

  /**
   * Delete a blob by its URL. Silently ignores errors (e.g. already deleted).
   */
  async deleteBlob(url: string): Promise<void> {
    try {
      await del(url);
    } catch {
      // Blob may already be deleted or URL may not be a blob URL
    }
  }

  private getDimensions(purpose: string): {
    width: number;
    height: number;
  } {
    switch (purpose) {
      case 'banner':
        return { width: BANNER_WIDTH, height: BANNER_HEIGHT };
      case 'thumbnail':
        return { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT };
      case 'pickup':
        return { width: PICKUP_WIDTH, height: PICKUP_HEIGHT };
      case 'document':
        return { width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT };
      default:
        return { width: BANNER_WIDTH, height: BANNER_HEIGHT };
    }
  }
}
