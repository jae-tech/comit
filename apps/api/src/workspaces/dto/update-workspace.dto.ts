import { createZodDto } from 'nestjs-zod';
import { UpdateWorkspaceSchema, SetActiveProviderSchema } from '@comit/shared';

export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceSchema) {}
export class SetActiveProviderDto extends createZodDto(
  SetActiveProviderSchema,
) {}
