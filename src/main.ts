import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  // Create the Nest Express application instance
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
     origin: 'http://localhost:5002',
      credentials: true, 
  })

  // Serve static files from the "public" directory
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors();

  // Use PORT from .env or fallback to 3000
  const port = process.env.PORT ?? 3000;

  // Start listening on the specified port
  await app.listen(port);

  console.log(`Application is running on port: ${port}`);
}

bootstrap();
