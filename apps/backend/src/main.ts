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

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem header Origin (totens locais, KDS, mobile apps, Postman)
      if (!origin) return callback(null, true);

      // Em desenvolvimento, permite origens locais
      if (!isProduction) return callback(null, true);

      const allowedOrigins = allowedOriginsEnv
        ? allowedOriginsEnv.split(',').map((o) => o.trim())
        : [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://totem-os-dashboard.vercel.app',
          ];

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed.includes('*')) {
          const regex = new RegExp(`^${allowed.replace(/\*/g, '.*')}$`);
          return regex.test(origin);
        }
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origem ${origin} não permitida por CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend TotemOS rodando na porta ${port}`);
  console.log(
    `Scalar API Reference disponível em http://localhost:${port}/reference`,
  );
}

void bootstrap();
