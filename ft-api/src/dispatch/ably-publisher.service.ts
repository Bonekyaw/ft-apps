import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ably from 'ably';

/**
 * Lightweight Ably REST publisher for server-to-client messages.
 * Uses the REST client (not Realtime) since the backend only publishes;
 * it never subscribes to channels.
 */
@Injectable()
export class AblyPublisherService implements OnModuleInit {
  private readonly logger = new Logger(AblyPublisherService.name);
  private client!: Ably.Rest;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const key = this.config.get<string>('ABLY_API_KEY') ?? '';
    if (!key) {
      this.logger.error('ABLY_API_KEY is not set — publishing will fail.');
    }
    this.client = new Ably.Rest({ key });
    this.logger.log('Ably REST publisher initialized.');
  }

  /**
   * Publish a message to an Ably channel.
   * Fire-and-forget with error logging — callers should not await in
   * the critical path (e.g. ride creation response).
   */
  async publish(
    channelName: string,
    eventName: string,
    data: unknown,
  ): Promise<void> {
    try {
      const channel = this.client.channels.get(channelName);
      await channel.publish(eventName, data);
      this.logger.debug(`Published "${eventName}" to ${channelName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish "${eventName}" to ${channelName}`,
        error,
      );
    }
  }
}
