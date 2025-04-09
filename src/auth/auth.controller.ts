import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from '@nestjs/common';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async register(@Body() registerDto: RegisterDto) {
    await this.authService.register(registerDto);
    return { message: 'Registration successful. Please check your email for verification.' };
  }

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify email with OTP' })
  @ApiResponse({
    status: 200,
    description: 'Email successfully verified',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid OTP or user not found',
  })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or email not verified',
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    await this.authService.requestPasswordReset(email);
    return { message: 'If your email is registered, you will receive password reset instructions.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Password reset successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
} 