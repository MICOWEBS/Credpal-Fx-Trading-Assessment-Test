import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  async register(registerDto: { email: string; password: string }): Promise<void> {
    const { email, password } = registerDto;
    this.logger.log(`Registration attempt for email: ${email}`);

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
         this.logger.warn(`Registration attempt for unverified email: ${email}. Resending verification.`);
         await this.resendVerificationEmail(existingUser);
         throw new ConflictException('Email already registered but not verified. Verification email resent.');
      }
      this.logger.warn(`Registration failed: Email ${email} already exists and is verified.`);
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: '',
      lastName: '',
      isEmailVerified: false,
      role: UserRole.USER,
      verificationToken,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      wallets: [],
      transactions: [],
    });

    try {
      const savedUser = await this.userRepository.save(user);
      this.logger.log(`User ${email} registered successfully (ID: ${savedUser.id}), sending verification email.`);
      await this.emailService.sendVerificationEmail(email, verificationToken);
    } catch (error: any) {
        this.logger.error(`Error during user registration or email sending for ${email}: ${error.message}`, error.stack);
        throw new Error('Registration failed. Please try again later.');
    }
  }

  private async resendVerificationEmail(user: User): Promise<void> {
      user.verificationToken = uuidv4();
      
      try {
          await this.userRepository.save(user); // Update user with new token
          await this.emailService.sendVerificationEmail(user.email, user.verificationToken);
          this.logger.log(`Resent verification email to ${user.email}`);
      } catch (error: any) {
           this.logger.error(`Failed to resend verification email to ${user.email}: ${error.message}`, error.stack);
      }
  }

  async verifyEmail(token: string): Promise<void> {
     this.logger.log(`Attempting email verification with token: ${token}`);
     
     const user = await this.userRepository.findOne({
       where: { verificationToken: token },
     });

     if (!user) {
       this.logger.warn(`Verification failed: Invalid token ${token}`);
       throw new BadRequestException('Invalid or expired verification token');
     }
     
     if (user.isEmailVerified) {
        this.logger.log(`Email ${user.email} is already verified.`);
        return;
     }

     const queryRunner = this.dataSource.createQueryRunner();
     await queryRunner.connect();
     await queryRunner.startTransaction();

     try {
         user.isEmailVerified = true;
         user.verificationToken = null;
         await queryRunner.manager.save(User, user);
         this.logger.log(`User ${user.email} marked as verified.`);

         await this.walletService.getWalletBalances(user.id);
         this.logger.log(`Wallet created for verified user ${user.email}`);

         await queryRunner.commitTransaction();
         this.logger.log(`Email verification and wallet creation completed successfully for ${user.email}.`);

     } catch (error: any) {
         await queryRunner.rollbackTransaction();
         this.logger.error(`Verification transaction failed for user ${user.email}: ${error.message}`, error.stack);
         throw new Error('Email verification failed. Please try again.');
     } finally {
         await queryRunner.release();
     }
  }

  async login(loginDto: { email: string; password: string }): Promise<{ accessToken: string; user: Partial<User> }> {
    const { email, password } = loginDto;
    this.logger.log(`Login attempt for email: ${email}`);

    const user = await this.userRepository.findOne({ 
        where: { email }, 
        select: ['id', 'email', 'password', 'isEmailVerified', 'role']
    });
    if (!user) {
      this.logger.warn(`Login failed: User not found for email ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password for email ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
       this.logger.warn(`Login failed: Email not verified for ${email}`);
      throw new UnauthorizedException('Please verify your email first');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    this.logger.log(`Login successful for email: ${email}`);

    const userToReturn: Partial<User> = {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role
    };

    return {
      accessToken,
      user: userToReturn,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
     const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return; 
    }
    
    if (!user.isEmailVerified) {
        this.logger.warn(`Password reset requested for unverified email: ${email}`);
        throw new BadRequestException('Account must be verified before resetting password.');
    }

    const resetToken = uuidv4();
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour expiry

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    
    try {
        await this.userRepository.save(user); 
        this.logger.log(`Password reset token generated and saved for ${email}`);
        await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch(error: any) {
        this.logger.error(`Failed to save reset token or send email for ${email}: ${error.message}`, error.stack);
        throw new Error('Failed to initiate password reset. Please try again.');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
     this.logger.log(`Attempting password reset with token: ${token}`);
     const user = await this.userRepository.findOne({
       where: { resetPasswordToken: token },
     });
     
     if (!user) {
        this.logger.warn(`Password reset failed: Invalid token ${token}`);
        throw new BadRequestException('Invalid or expired reset token');
     }

     if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
       this.logger.warn(`Password reset failed: Token expired for user ${user.email}`);
       user.resetPasswordToken = null;
       user.resetPasswordExpires = null;
       await this.userRepository.save(user);
       throw new BadRequestException('Reset token has expired');
     }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    try {
        await this.userRepository.save(user);
        this.logger.log(`Password successfully reset for user ${user.email}`);
    } catch (error: any) {
         this.logger.error(`Failed to save new password for user ${user.email}: ${error.message}`, error.stack);
         throw new Error('Failed to reset password. Please try again.');
    }
  }
}