import { createZodDto } from 'nestjs-zod';
import { CreateProviderSchema, UpdateProviderSchema } from '@comit/shared';

export class CreateProviderDto extends createZodDto(CreateProviderSchema) {}
export class UpdateProviderDto extends createZodDto(UpdateProviderSchema) {}
