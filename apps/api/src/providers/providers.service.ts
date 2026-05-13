import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { DrizzleService } from '../database/drizzle.service';
import { aiProviders, type AiProvider } from '../database/schema';
import { EncryptionService } from './encryption.service';
import { CreateProviderDto, ProviderResponse } from '@orbit/shared';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateProviderDto): Promise<ProviderResponse> {
    await this.validateApiKey(dto.provider, dto.apiKey);

    const { encryptedKey, iv } = this.encryption.encrypt(dto.apiKey);
    const [saved] = await this.drizzle.db
      .insert(aiProviders)
      .values({ userId, provider: dto.provider, encryptedKey, iv, model: dto.model })
      .returning();

    return this.toResponse(saved);
  }

  async findAll(userId: string): Promise<ProviderResponse[]> {
    const rows = await this.drizzle.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, userId));

    return rows.map(this.toResponse);
  }

  async update(userId: string, id: string, dto: Partial<CreateProviderDto>): Promise<ProviderResponse> {
    const provider = await this.findOneOrFail(userId, id);

    const patch: Partial<AiProvider> = {};
    if (dto.apiKey) {
      await this.validateApiKey(dto.provider ?? provider.provider, dto.apiKey);
      const { encryptedKey, iv } = this.encryption.encrypt(dto.apiKey);
      patch.encryptedKey = encryptedKey;
      patch.iv = iv;
    }
    if (dto.model) patch.model = dto.model;

    const [saved] = await this.drizzle.db
      .update(aiProviders)
      .set(patch)
      .where(eq(aiProviders.id, id))
      .returning();

    return this.toResponse(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneOrFail(userId, id);
    await this.drizzle.db
      .delete(aiProviders)
      .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)));
  }

  async getDecryptedKey(userId: string): Promise<{ apiKey: string; provider: string; model: string } | null> {
    const [provider] = await this.drizzle.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, userId))
      .limit(1);

    if (!provider) return null;
    const apiKey = this.encryption.decrypt(provider.encryptedKey, provider.iv);
    return { apiKey, provider: provider.provider, model: provider.model };
  }

  private async findOneOrFail(userId: string, id: string): Promise<AiProvider> {
    const [provider] = await this.drizzle.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.id, id))
      .limit(1);

    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.userId !== userId) throw new ForbiddenException();
    return provider;
  }

  private async validateApiKey(providerType: string, apiKey: string): Promise<void> {
    const timeout = 5000;
    try {
      if (providerType === 'openai') {
        const client = new OpenAI({ apiKey, timeout });
        await client.models.list();
      } else if (providerType === 'anthropic') {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });
        await client.models.list();
      } else if (providerType === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
        await Promise.race([
          model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
        ]);
      }
    } catch {
      throw new UnprocessableEntityException('API Key validation failed. Please check your key.');
    }
  }

  private toResponse(p: AiProvider): ProviderResponse {
    return {
      id: p.id,
      provider: p.provider as ProviderResponse['provider'],
      model: p.model,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
