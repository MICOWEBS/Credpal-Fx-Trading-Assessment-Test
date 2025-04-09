import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class RateLimitFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    if (status === 429) {
      return response.status(429).json({
        statusCode: 429,
        message: 'Too Many Requests',
        error: 'Rate limit exceeded. Please try again later.',
      });
    }

    return response.status(status).json({
      statusCode: status,
      message: exception.message,
    });
  }
} 