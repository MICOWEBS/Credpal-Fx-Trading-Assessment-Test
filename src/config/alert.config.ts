import { registerAs } from '@nestjs/config';

export interface AlertConfig {
  thresholds: {
    errorRate: number;
    responseTime: number;
    concurrentUsers: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    [key: string]: number;
  };
  channels: {
    email: string[];
    slack: string[];
    webhook?: string;
  };
  notification: {
    cooldown: number; // in minutes
    maxAlertsPerHour: number;
  };
}

export default registerAs('alert', (): AlertConfig => ({
  thresholds: {
    errorRate: 0.05, // 5% error rate
    responseTime: 1000, // 1 second
    concurrentUsers: 1000,
    memoryUsage: 0.8, // 80% memory usage
    cpuUsage: 0.7, // 70% CPU usage
    diskUsage: 0.9, // 90% disk usage
  },
  channels: {
    email: process.env.ALERT_EMAILS?.split(',') || ['admin@example.com'],
    slack: process.env.ALERT_SLACK_CHANNELS?.split(',') || ['#alerts'],
    webhook: process.env.ALERT_WEBHOOK_URL,
  },
  notification: {
    cooldown: 15, // 15 minutes
    maxAlertsPerHour: 10,
  },
})); 