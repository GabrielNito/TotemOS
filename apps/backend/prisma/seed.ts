import { PrismaClient, Role, ModoIdentificacao } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco Neon PostgreSQL...');

  const pinDonoHash = await bcrypt.hash('1234', 10);
  const senhaAdminHash = await bcrypt.hash('senha123admin', 10);
  const senhaGerenteHash = await bcrypt.hash('senha123gerente', 10);

  const negocio = await prisma.negocio.upsert({
    where: { slug: 'lanchonete-teste' },
    update: {},
    create: {
      nome: 'Lanchonete TotemOS Teste',
      slug: 'lanchonete-teste',
      pinDonoHash,
      config: {
        create: {
          modoIdentificacao: ModoIdentificacao.OPCIONAL,
          tempoPadraoPreparo: 15,
          permitirPagamentoOffline: true,
          mensagemBoasVindas: 'Seja bem-vindo ao TotemOS!',
        },
      },
      usuarios: {
        create: [
          {
            nome: 'Admin Dono',
            email: 'admin@totemos.com.br',
            senhaHash: senhaAdminHash,
            role: Role.DONO,
          },
          {
            nome: 'Gerente Pedro',
            email: 'gerente@totemos.com.br',
            senhaHash: senhaGerenteHash,
            role: Role.GERENTE,
          },
        ],
      },
    },
    include: {
      usuarios: true,
      config: true,
    },
  });

  console.log('Seed concluído com sucesso!');
  console.log(`Negócio criado: ${negocio.nome} (ID: ${negocio.id})`);
  console.log('Usuários de teste:');
  console.log(
    ' - Admin Dono: admin@totemos.com.br / senha123admin (PIN: 1234)',
  );
  console.log(' - Gerente: gerente@totemos.com.br / senha123gerente');
}

main()
  .catch((e) => {
    console.error('Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
