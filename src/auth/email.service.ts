import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Redis from 'redis';
import { createTransport } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private redisClient: Redis.RedisClientType;
  private readonly transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeRedisConnection();
    this.transporter = createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private async initializeRedisConnection() {
    this.redisClient = Redis.createClient({
      url: `redis://${this.configService.get('REDIS_HOST')}:${this.configService.get('REDIS_PORT')}`,
    });

    await this.redisClient.connect();

    this.redisClient.on('error', (err) => console.error('Redis Client Error', err));
  }

  async generateOTP(email: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${email}`;
    
    // Store OTP in Redis with 10 minutes expiration
    await this.redisClient.set(key, otp, {
      EX: 600, // 10 minutes in seconds
    });

    await this.sendVerificationEmail(email, otp);
    return otp;
  }

  async verifyOTP(email: string, otp: string): Promise<boolean> {
    const key = `otp:${email}`;
    const storedOTP = await this.redisClient.get(key);

    if (!storedOTP || storedOTP !== otp) {
      return false;
    }

    // Delete OTP after successful verification
    await this.redisClient.del(key);
    return true;
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'Verify your email address',
        html: `
          <h1>Email Verification</h1>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
        `,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'Reset your password',
        html: `
          <h1>Password Reset</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}: ${error.message}`);
      throw error;
    }
  }
} 