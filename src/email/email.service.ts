import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');

    if (!apiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable');
    }
    if (!frontendUrl) {
       this.logger.warn('Missing FRONTEND_URL environment variable. Email links may not work.');
    }
    if (!fromEmail) {
      throw new Error('Missing RESEND_FROM_EMAIL environment variable');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
    this.frontendUrl = frontendUrl || ''; // Use empty string if missing, links will be relative
  }

  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
    this.logger.log(`Sending verification email to ${email} with link: ${verificationUrl}`);

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Verify your CredPal account',
        html: `
          <h1>Welcome to CredPal!</h1>
          <p>Please click the link below to verify your email address:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This link will expire in 60 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
        `,
      });
       this.logger.log(`Successfully sent verification email to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message}`, error.stack);
      throw error; 
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
     this.logger.log(`Sending password reset email to ${email} with link: ${resetUrl}`);

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Reset your CredPal password',
        html: `
          <h1>Password Reset Request</h1>
          <p>Please click the link below to reset your password:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        `,
      });
       this.logger.log(`Successfully sent password reset email to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send password reset email to ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendTransactionNotification(
    email: string,
    transactionType: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    this.logger.log(`Sending transaction notification (${transactionType}) to ${email}`);
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `Transaction Notification - ${transactionType}`,
        html: `
          <h1>Transaction Notification</h1>
          <p>Type: ${transactionType}</p>
          <p>Amount: ${amount} ${currency}</p>
          <p>Time: ${new Date().toLocaleString()}</p>
          <p>If you didn't make this transaction, please contact support immediately.</p>
        `,
      });
       this.logger.log(`Successfully sent transaction notification to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send transaction notification to ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 