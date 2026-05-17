import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DemoChatSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

export const DemoSettingsSchema = z.object({
  personaName: z.string().max(100).optional(),
  systemPrompt: z.string().max(4000).optional(),
});

export const AddPersonaSchema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
});

export class DemoChatDto extends createZodDto(DemoChatSchema) {}
export class DemoSettingsDto extends createZodDto(DemoSettingsSchema) {}
export class AddPersonaDto extends createZodDto(AddPersonaSchema) {}
