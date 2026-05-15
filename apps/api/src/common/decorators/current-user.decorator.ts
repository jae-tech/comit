import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return ctx.switchToHttp().getRequest().user as {
      id: string;
      email: string;
    };
  },
);
