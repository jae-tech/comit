import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { users, type User } from '../database/schema';
import { RegisterDto, LoginDto, AuthTokens } from '@orbit/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const [existing] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const [user] = await this.drizzle.db
      .insert(users)
      .values({ email: dto.email, passwordHash })
      .returning();

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const blocked = await this.redis.get(`rt_block:${refreshToken}`);
    if (blocked) throw new UnauthorizedException('Token revoked');

    let payload: { sub: string; email: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) throw new UnauthorizedException('User not found');

    await this.revokeRefreshToken(refreshToken);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(refreshToken);
  }

  private async revokeRefreshToken(token: string): Promise<void> {
    const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES', '7d');
    const ttlSeconds = this.parseDurationToSeconds(refreshExpires);
    await this.redis.set(`rt_block:${token}`, '1', 'EX', ttlSeconds);
  }

  private issueTokens(user: User): AuthTokens {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600;
    const val = parseInt(match[1]);
    const unit = match[2];
    const map: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return val * map[unit];
  }
}
