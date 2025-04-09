import { Controller, Get, Post, Body, UseGuards, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { FxService } from './fx.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';

@ApiTags('FX')
@Controller('fx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current FX rates for a base currency (default: NGN)' })
  @ApiResponse({ status: 200, description: 'Returns current FX rates' })
  async getRates(@Query('base') baseCurrency?: string) {
    return this.fxService.getRates(baseCurrency || 'NGN');
  }

  @Post('convert')
  @ApiOperation({ summary: 'Get a quote for currency conversion' })
  @ApiBody({ type: ConvertCurrencyDto })
  @ApiResponse({ status: 200, description: 'Returns the conversion rate and calculated amount' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 503, description: 'Exchange rate not available' })
  async getConversionQuote(
    @Body() convertDto: ConvertCurrencyDto
  ) {
    return this.fxService.convertCurrency(
      convertDto.fromCurrency,
      convertDto.toCurrency,
      convertDto.amount
    );
  }
} 