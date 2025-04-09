import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, QueryRunner, Repository, EntityManager } from 'typeorm';
import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { EmailService } from '../email/email.service';
import { UserService } from '../user/user.service';
import { MailerService } from '@nestjs-modules/mailer';

// Mock bcrypt functions
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock uuid
jest.mock('uuid');
const mockedUuid = uuidv4 as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let emailService: EmailService;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let userService: UserService;
  let mailerService: MailerService;

  // Mock implementations
  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWalletRepository = {
    // No direct calls expected in AuthService tests, but needed for injection
  };
  
  // Mock EntityManager for transactions with explicitly typed Jest mocks
  const mockEntityManager = {
      findOne: jest.fn().mockImplementation((entity, options) => {
        if (entity === User) {
          return {
            id: 'user-id',
            email: 'test@example.com',
            password: 'hashedPassword',
            firstName: null,
            lastName: null,
            isEmailVerified: true,
            role: UserRole.USER,
            verificationToken: null,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            wallets: [],
            transactions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      }),
      create: jest.fn(),
      save: jest.fn(),
  };

  // Mock QueryRunner (reference the correctly typed EntityManager mock)
  const mockQueryRunner = {
    manager: mockEntityManager, // Now manager has correctly typed mocks
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  } as unknown as QueryRunner;

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUserService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    verifyEmail: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedUuid.mockReturnValue('mock-uuid-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository, // Provide mock Wallet repo
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    emailService = module.get<EmailService>(EmailService);
    jwtService = module.get<JwtService>(JwtService);
    dataSource = module.get<DataSource>(DataSource);
    userService = module.get<UserService>(UserService);
    mailerService = module.get<MailerService>(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Registration Tests --- 
  describe('register', () => {
    const registerDto = { email: 'test@example.com', password: 'password123' };
    const createdUser = {
        id: 'user-id',
        email: registerDto.email,
        password: 'hashedPassword',
        firstName: null,
        lastName: null,
        isEmailVerified: false,
        role: UserRole.USER,
        verificationToken: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        wallets: [],
        transactions: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
    };

    it('should successfully register a new user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(createdUser);
      mockUserRepository.save.mockResolvedValue(createdUser);

      await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: registerDto.email } });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        email: registerDto.email,
        password: 'hashedPassword',
        firstName: null,
        lastName: null,
        isEmailVerified: false,
        role: UserRole.USER,
        verificationToken: expect.any(String),
        resetPasswordToken: null,
        resetPasswordExpires: null,
      }));
      expect(mockUserRepository.save).toHaveBeenCalledWith(createdUser);
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(registerDto.email, expect.any(String));
    });

    it('should throw ConflictException if email is already registered and verified', async () => {
      const existingVerifiedUser = { ...createdUser, isEmailVerified: true };
      mockUserRepository.findOne.mockResolvedValue(existingVerifiedUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: registerDto.email } });
      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should resend verification email if email is registered but not verified', async () => {
        const existingUnverifiedUser = { ...createdUser, isEmailVerified: false };
        mockUserRepository.findOne.mockResolvedValue(existingUnverifiedUser);
        mockUserRepository.save.mockResolvedValue(existingUnverifiedUser); // For updating token
  
        await expect(service.register(registerDto)).rejects.toThrow(
          'Email already registered but not verified. Verification email resent.'
        );
  
        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: registerDto.email } });
        expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({
            ...existingUnverifiedUser,
            verificationToken: 'new-mock-token',
            verificationTokenExpires: expect.any(Date)
        }));
        expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(registerDto.email, 'new-mock-token');
        expect(mockUserRepository.create).not.toHaveBeenCalled();
      });

     it('should handle errors during user save', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockUserRepository.create.mockReturnValue(createdUser);
        mockUserRepository.save.mockRejectedValue(new Error('DB save error'));

        await expect(service.register(registerDto)).rejects.toThrow('Registration failed. Please try again later.');
        expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
     });
  });

  // --- Email Verification Tests --- 
  describe('verifyEmail', () => {
     const validToken = 'valid-token';
     const expiredToken = 'expired-token';
     const invalidToken = 'invalid-token';
     let mockUser: User;

     beforeEach(() => {
         const now = new Date();
         mockUser = {
             id: 'user-id', 
             email: 'verify@example.com', 
             password: 'hashed',
             firstName: '',
             lastName: '',
             isEmailVerified: false,
             role: UserRole.USER,
             verificationToken: null,
             resetPasswordToken: null,
             resetPasswordExpires: null,
             wallets: [],
             transactions: [],
             createdAt: now,
             updatedAt: now,
         };
     });

     it('should successfully verify email and create wallet if not exists', async () => {
        mockUserRepository.findOne.mockResolvedValue(mockUser);
        mockEntityManager.findOne.mockResolvedValue(null); 
        mockEntityManager.create.mockReturnValue({ id: 'wallet-id', userId: mockUser.id });
        mockEntityManager.save.mockImplementation(async (entityType, entity) => entity);

        await service.verifyEmail(validToken);

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { verificationToken: validToken } });
        expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockEntityManager.save).toHaveBeenCalledWith(User, expect.objectContaining({
            id: mockUser.id,
            isEmailVerified: true,
        }));
        expect(mockEntityManager.findOne).toHaveBeenCalledWith(Wallet, { where: { userId: mockUser.id } });
        expect(mockEntityManager.create).toHaveBeenCalledWith(Wallet, { userId: mockUser.id });
        expect(mockEntityManager.save).toHaveBeenCalledWith(Wallet, { id: 'wallet-id', userId: mockUser.id });
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    });
    
    it('should successfully verify email and NOT create wallet if it exists', async () => {
        mockUserRepository.findOne.mockResolvedValue(mockUser);
        mockEntityManager.findOne.mockResolvedValue({ id: 'existing-wallet-id', userId: mockUser.id });
        mockEntityManager.save.mockImplementation(async (entityType, entity) => entity);

        await service.verifyEmail(validToken);

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { verificationToken: validToken } });
        expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockEntityManager.save).toHaveBeenCalledWith(User, expect.objectContaining({ isEmailVerified: true }));
        expect(mockEntityManager.findOne).toHaveBeenCalledWith(Wallet, { where: { userId: mockUser.id } });
        expect(mockEntityManager.create).not.toHaveBeenCalledWith(Wallet, expect.anything());
        expect(mockEntityManager.save).toHaveBeenCalledWith(User, expect.objectContaining({ id: mockUser.id }));
        expect(mockEntityManager.save).not.toHaveBeenCalledWith(Wallet, expect.anything());
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null); // User not found

      await expect(service.verifyEmail(invalidToken)).rejects.toThrow(BadRequestException);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredUser = { ...mockUser, verificationTokenExpires: new Date(Date.now() - 1000) };
      mockUserRepository.findOne.mockResolvedValue(expiredUser);

      await expect(service.verifyEmail(validToken)).rejects.toThrow('Verification token has expired');
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });
    
    it('should return early if user is already verified', async () => {
        const alreadyVerifiedUser = { ...mockUser, isEmailVerified: true };
        mockUserRepository.findOne.mockResolvedValue(alreadyVerifiedUser);

        await service.verifyEmail(validToken);
        
        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { verificationToken: validToken } });
        expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
        expect(mockEntityManager.save).not.toHaveBeenCalled();
    });
    
     it('should rollback transaction on error during verification/wallet creation', async () => {
        mockUserRepository.findOne.mockResolvedValue(mockUser);
        mockEntityManager.findOne.mockRejectedValue(new Error('DB error finding wallet')); 
        mockEntityManager.save.mockImplementation(async (entityType, entity) => entity);

        await expect(service.verifyEmail(validToken)).rejects.toThrow('Email verification failed. Please try again.');

        expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockEntityManager.save).toHaveBeenCalledWith(User, expect.objectContaining({ isEmailVerified: true }));
        expect(mockEntityManager.findOne).toHaveBeenCalledWith(Wallet, { where: { userId: mockUser.id } });
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // --- Login Tests --- 
  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };
    const mockUser = {
        id: 'user-id', 
        email: loginDto.email, 
        password: 'hashedPassword',
        firstName: null,
        lastName: null,
        isEmailVerified: true, 
    };

    it('should successfully login a verified user', async () => {
      const mockUserWithRole = {
        ...mockUser,
        role: UserRole.USER
      };
      mockUserRepository.findOne.mockResolvedValue(mockUserWithRole);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mockAccessToken');

      const result = await service.login(loginDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ 
          where: { email: loginDto.email }, 
          select: ['id', 'email', 'password', 'isEmailVerified', 'role']
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUserWithRole.password);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: mockUserWithRole.id, email: mockUserWithRole.email, role: mockUserWithRole.role });
      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        user: {
            id: mockUserWithRole.id,
            email: mockUserWithRole.email,
            isEmailVerified: mockUserWithRole.isEmailVerified,
            role: mockUserWithRole.role,
        },
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unverified user', async () => {
      const unverifiedUser = { 
        id: 'user-id',
        email: loginDto.email,
        password: 'hashedPassword',
        firstName: null,
        lastName: null,
        isEmailVerified: false,
        role: UserRole.USER,
        verificationToken: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        wallets: [],
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepository.findOne.mockResolvedValue(unverifiedUser);
      await expect(service.login(loginDto)).rejects.toThrow('Please verify your email first');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const mockUser = { 
        id: 'user-id',
        email: loginDto.email,
        password: 'hashedPassword',
        firstName: null,
        lastName: null,
        isEmailVerified: true,
        role: UserRole.USER,
        verificationToken: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        wallets: [],
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- Password Reset Tests --- 
  describe('requestPasswordReset', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';
      const mockUser = { id: 1, email };

      mockUserService.findByEmail.mockResolvedValue(mockUser);
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.requestPasswordReset(email);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(email);
      expect(mockMailerService.sendMail).toHaveBeenCalled();
    });

    it('should not throw error if email not found', async () => {
      const email = 'nonexistent@example.com';

      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(service.requestPasswordReset(email)).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const token = 'valid.token';
      const newPassword = 'newpassword123';

      const mockUser = { id: 1, email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue({ sub: mockUser.id });
      mockUserService.updatePassword.mockResolvedValue(mockUser);

      await service.resetPassword(token, newPassword);

      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
      expect(mockUserService.updatePassword).toHaveBeenCalledWith(mockUser.id, newPassword);
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      const token = 'invalid.token';
      const newPassword = 'newpassword123';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(UnauthorizedException);
    });
  });
}); 