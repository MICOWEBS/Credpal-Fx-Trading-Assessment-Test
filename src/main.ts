import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  // Enable CORS with production settings
  app.enableCors({
    origin: isProduction ? configService.get('ALLOWED_ORIGINS')?.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Security middleware
  app.use(helmet());
  app.use(compression());
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    disableErrorMessages: isProduction,
  }));

  // Get Reflector instance
  const reflector = app.get(Reflector);

  // Global rate limit guard
  app.useGlobalGuards(new RateLimitGuard(app.get('CACHE_MANAGER'), reflector));

  // Swagger documentation setup (only in development)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('FX Trading App API')
      .setDescription('API documentation for the FX Trading App')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('wallet', 'Wallet management endpoints')
      .addTag('fx', 'Foreign exchange endpoints')
      .addTag('transactions', 'Transaction history endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  // Configure port
  const port = configService.get('PORT') || 3000;
  await app.listen(port);
}
bootstrap(); 