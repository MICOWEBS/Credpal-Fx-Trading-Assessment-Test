import { createLogger, format, transports } from 'winston';
import { ConfigService } from '@nestjs/config';

export const createWinstonLogger = (configService: ConfigService) => {
  return createLogger({
    level: configService.get('LOG_LEVEL') || 'info',
    format: format.combine(
      format.timestamp(),
      format.json(),
    ),
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          }),
        ),
      }),
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new transports.File({
        filename: 'logs/combined.log',
      }),
    ],
    exceptionHandlers: [
      new transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new transports.File({ filename: 'logs/rejections.log' }),
    ],
  });
}; 