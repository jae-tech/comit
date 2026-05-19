import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

interface RequestWithUser {
  user?: { id: string; email: string; role: string };
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    return true;
  }
}
