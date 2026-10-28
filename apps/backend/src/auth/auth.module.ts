import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DeviceTokenGuard } from './guards/device-token.guard';
import { AnyAuthGuard } from './guards/any-auth.guard';
import { DeviceTypeGuard } from './guards/device-type.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error(
            'Configuração crítica de segurança: Variável de ambiente JWT_SECRET não configurada.',
          );
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    DeviceTokenGuard,
    AnyAuthGuard,
    DeviceTypeGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    DeviceTokenGuard,
    AnyAuthGuard,
    DeviceTypeGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
