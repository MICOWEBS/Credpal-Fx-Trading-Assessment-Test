import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.userRepository.query('SELECT 1');
      return {
        [key]: {
          status: 'up',
        },
      };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        [key]: {
          status: 'down',
          error: error.message,
        },
      });
    }
  }
} 