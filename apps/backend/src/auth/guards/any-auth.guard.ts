import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private jwtAuthGuard: JwtAuthGuard,
    private deviceTokenGuard: DeviceTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.jwtAuthGuard.canActivate(context);
    } catch {
      return this.deviceTokenGuard.canActivate(context);
    }
  }
}
