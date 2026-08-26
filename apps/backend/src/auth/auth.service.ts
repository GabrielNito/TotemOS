import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role, ModoIdentificacao } from '@prisma/client';
import { RegistrarDto } from './dto/registrar.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registrar(dto: RegistrarDto) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (usuarioExistente) {
      throw new ConflictException('E-mail já cadastrado na plataforma');
    }

    const negocioExistente = await this.prisma.negocio.findUnique({
      where: { slug: dto.slugNegocio },
    });

    if (negocioExistente) {
      throw new ConflictException('Slug do negócio já está em uso');
    }

    const pinDonoHash = await bcrypt.hash(dto.pinDono, 10);
    const senhaHash = await bcrypt.hash(dto.senhaPlana, 10);

    const negocio = await this.prisma.negocio.create({
      data: {
        nome: dto.nomeNegocio,
        slug: dto.slugNegocio,
        pinDonoHash,
        config: {
          create: {
            modoIdentificacao: ModoIdentificacao.OPCIONAL,
            tempoPadraoPreparo: 15,
            permitirPagamentoOffline: true,
            mensagemBoasVindas: `Seja bem-vindo ao ${dto.nomeNegocio}!`,
          },
        },
        usuarios: {
          create: {
            nome: dto.nomeUsuario,
            email: dto.email,
            senhaHash,
            role: Role.DONO,
          },
        },
      },
      include: {
        usuarios: true,
      },
    });

    const usuarioCriado = negocio.usuarios[0];

    const payload = {
      sub: usuarioCriado.id,
      email: usuarioCriado.email,
      negocioId: negocio.id,
      role: usuarioCriado.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id: usuarioCriado.id,
        nome: usuarioCriado.nome,
        email: usuarioCriado.email,
        role: usuarioCriado.role,
        negocioId: negocio.id,
        negocioNome: negocio.nome,
      },
    };
  }

  async login(email: string, senhaPlana: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { negocio: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(senhaPlana, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      negocioId: usuario.negocioId,
      role: usuario.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        negocioId: usuario.negocioId,
        negocioNome: usuario.negocio.nome,
      },
    };
  }

  async validarPinDono(
    usuarioNegocioId: string,
    payloadNegocioId: string,
    pin: string,
  ): Promise<boolean> {
    if (usuarioNegocioId !== payloadNegocioId) {
      throw new ForbiddenException(
        'Acesso negado: Você não possui permissão para validar ações neste estabelecimento',
      );
    }

    const negocio = await this.prisma.negocio.findUnique({
      where: { id: payloadNegocioId },
    });

    if (!negocio || !negocio.pinDonoHash) {
      throw new BadRequestException('PIN do dono não configurado');
    }

    const pinValido = await bcrypt.compare(pin, negocio.pinDonoHash);
    if (!pinValido) {
      throw new UnauthorizedException('PIN do dono incorreto');
    }

    return true;
  }
}
