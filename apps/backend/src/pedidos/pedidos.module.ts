import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { AuthModule } from '../auth/auth.module';
import { PedidosDemoController } from './pedidos-demo.controller';
import { LiberacaoDemoService } from './liberacao-demo.service';
import { OperacaoPedidosService } from './operacao-pedidos.service';

@Module({
  imports: [AuthModule],
  controllers: [PedidosController, PedidosDemoController],
  providers: [PedidosService, LiberacaoDemoService, OperacaoPedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
