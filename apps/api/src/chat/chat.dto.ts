import { createZodDto } from 'nestjs-zod';
import { ChatQuerySchema } from '@comit/shared';

export class ChatQueryDto extends createZodDto(ChatQuerySchema) {}
