import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AiProvider } from '../database/entities/ai-provider.entity';
import { EncryptionService } from './encryption.service';
import { CreateProviderDto, ProviderResponse } from '@orbit/shared';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(AiProvider)
    private readonly providerRepo: Repository<AiProvider>,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateProviderDto): Promise<ProviderResponse> {
    // 등록 전 API Key 유효성 검증 (live test call)
    await this.validateApiKey(dto.provider, dto.apiKey);

    const { encryptedKey, iv } = this.encryption.encrypt(dto.apiKey);

    const provider = this.providerRepo.create({
      userId,
      provider: dto.provider,
      encryptedKey,
      iv,
      model: dto.model,
    });

    const saved = await this.providerRepo.save(provider);
    return this.toResponse(saved);
  }

  async findAll(userId: string): Promise<ProviderResponse[]> {
    const providers = await this.providerRepo.findBy({ userId });
    return providers.map(this.toResponse);
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<CreateProviderDto>,
  ): Promise<ProviderResponse> {
    const provider = await this.findOneOrFail(userId, id);

    if (dto.apiKey) {
      await this.validateApiKey(dto.provider ?? provider.provider, dto.apiKey);
      const { encryptedKey, iv } = this.encryption.encrypt(dto.apiKey);
      provider.encryptedKey = encryptedKey;
      provider.iv = iv;
    }
    if (dto.model) provider.model = dto.model;

    const saved = await this.providerRepo.save(provider);
    return this.toResponse(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    const provider = await this.findOneOrFail(userId, id);
    await this.providerRepo.remove(provider);
  }

  /** 내부용: 복호화된 API Key 반환 (채팅/임베딩에서 사용) */
  async getDecryptedKey(userId: string): Promise<{ apiKey: string; provider: string; model: string } | null> {
    const provider = await this.providerRepo.findOneBy({ userId });
    if (!provider) return null;

    const apiKey = this.encryption.decrypt(provider.encryptedKey, provider.iv);
    return { apiKey, provider: provider.provider, model: provider.model };
  }

  private async findOneOrFail(userId: string, id: string): Promise<AiProvider> {
    const provider = await this.providerRepo.findOneBy({ id });
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
        // Anthropic SDK 간단 검증: models.list
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
      throw new UnprocessableEntityException(
        'API Key validation failed. Please check your key.',
      );
    }
  }

  private toResponse(p: AiProvider): ProviderResponse {
    return {
      id: p.id,
      provider: p.provider,
      model: p.model,
      createdAt: p.createdAt.toISOString(),
      // encryptedKey, iv 절대 포함하지 않음
    };
  }
}
