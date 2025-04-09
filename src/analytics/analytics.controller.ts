import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { AnalyticsService } from './analytics.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Analytics')
@Controller('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('trades')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Get trade analytics for authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns trade analytics' })
  async getTradeAnalytics(@Request() req: AuthenticatedRequest) {
    return this.analyticsService.getTradeAnalytics(req.user.id);
  }

  @Get('activity')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Get user activity analytics' })
  @ApiResponse({ status: 200, description: 'Returns user activity analytics' })
  async getUserActivity(@Request() req: AuthenticatedRequest) {
    return this.analyticsService.getUserActivity(req.user.id);
  }

  @Get('fx-trends')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get FX market trends (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns FX market trends' })
  async getFxTrends() {
    return this.analyticsService.getFxTrends();
  }
} 