import { SetMetadata } from '@nestjs/common';
import { TipoDispositivo } from '@prisma/client';

export const DEVICE_TYPES_KEY = 'deviceTypes';
export const DeviceTypes = (...types: TipoDispositivo[]) =>
  SetMetadata(DEVICE_TYPES_KEY, types);
