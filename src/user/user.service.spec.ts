import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from './enums/user-role.enum';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        ...createUserDto,
        isEmailVerified: false,
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException if email already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'password123',
      };

      mockUserRepository.findOne.mockResolvedValue({ id: '1', email: createUserDto.email });

      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(mockUserRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = { email: 'updated@example.com' };
      const mockUser = { id: '1', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, ...updateUserDto });

      const result = await service.update('1', updateUserDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.email).toBe('updated@example.com');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.update('999', { email: 'updated@example.com' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('1');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockUserRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });
}); 