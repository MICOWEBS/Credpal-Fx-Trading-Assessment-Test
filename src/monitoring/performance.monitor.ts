import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

@Injectable()
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  private metrics: Map<string, Metric[]> = new Map();

  constructor(private configService: ConfigService) {}

  trackMetric(name: string, value: number, tags?: Record<string, string>) {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)?.push(metric);
    this.logger.debug(`Tracked metric: ${name} = ${value}`);

    // Check if metric exceeds threshold
    const threshold = this.configService.get<number>(`METRIC_THRESHOLD_${name.toUpperCase()}`);
    if (threshold && value > threshold) {
      this.alert(name, value, threshold);
    }
  }

  getMetrics(name?: string): Metric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }

    return Array.from(this.metrics.values()).flat();
  }

  getMetricStats(name: string): {
    min: number;
    max: number;
    avg: number;
    count: number;
  } {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  private alert(name: string, value: number, threshold: number) {
    const message = `Alert: Metric ${name} exceeded threshold. Value: ${value}, Threshold: ${threshold}`;
    this.logger.warn(message);

    // TODO: Implement alert notification (email, Slack, etc.)
    // This could be integrated with a notification service
  }

  clearMetrics(name?: string) {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
} 