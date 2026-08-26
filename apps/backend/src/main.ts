import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('TotemOS Backend API')
    .setDescription(
      'Documentação interativa das rotas do backend TotemOS com Schemas Zod',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const fastifyInstance = app.getHttpAdapter().getInstance();

  fastifyInstance.get('/swagger-json', (request, reply) => {
    void reply.type('application/json').send(document);
  });

  fastifyInstance.get('/reference', (request, reply) => {
    const html = `<!doctype html>
<html>
  <head>
    <title>TotemOS Backend API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/swagger-json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
    void reply.type('text/html').send(html);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend TotemOS rodando na porta ${port}`);
  console.log(
    `Scalar API Reference disponível em http://localhost:${port}/reference`,
  );
}

void bootstrap();
