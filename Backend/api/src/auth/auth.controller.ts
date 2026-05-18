import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../security/public.decorator";
import { RateLimit } from "../security/rate-limit.decorator";
import { ActivateAccountDto } from "./dto/activate-account.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResendActivationDto } from "./dto/resend-activation.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { FirstConnectionDto } from "./dto/first-connection.dto";
import {
  AuthService,
  type AuthTokensResponse,
  type ForgotPasswordResponse,
  type MessageResponse,
  type TokenStatusResponse
} from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @RateLimit({ bucket: "auth-login", max: 5, windowMs: 60_000 })
  @ApiOperation({ summary: "JWT login endpoint" })
  async login(@Body() body: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(body);
  }

  @Public()
  @Post("refresh")
  @RateLimit({ bucket: "auth-refresh", max: 20, windowMs: 60_000 })
  @ApiOperation({ summary: "Refresh access token using refresh token rotation" })
  async refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ bucket: "auth-logout", max: 20, windowMs: 60_000 })
  @ApiOperation({ summary: "Revoke refresh token (logout)" })
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @RateLimit({ bucket: "auth-forgot-password", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Generate a password reset token" })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post("reset-password")
  @RateLimit({ bucket: "auth-reset-password", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Reset user password with reset token" })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(body);
  }

  @Public()
  @Post("activate")
  @RateLimit({ bucket: "auth-activate", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Activate account and set definitive password" })
  async activate(@Body() body: ActivateAccountDto): Promise<MessageResponse> {
    return this.authService.activateAccount(body);
  }

  @Public()
  @Post("resend-activation")
  @RateLimit({ bucket: "auth-resend-activation", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Resend account activation email when eligible" })
  async resendActivation(@Body() body: ResendActivationDto): Promise<ForgotPasswordResponse> {
    return this.authService.resendActivation(body);
  }

  @Public()
  @Get("activation-status")
  @RateLimit({ bucket: "auth-activation-status", max: 30, windowMs: 60_000 })
  @ApiOperation({ summary: "Check account activation token status" })
  async activationStatus(@Query("token") token = ""): Promise<TokenStatusResponse> {
    return this.authService.activationStatus(token);
  }

  @Public()
  @Get("reset-status")
  @RateLimit({ bucket: "auth-reset-status", max: 30, windowMs: 60_000 })
  @ApiOperation({ summary: "Check password reset token status" })
  async resetStatus(@Query("token") token = ""): Promise<TokenStatusResponse> {
    return this.authService.resetStatus(token);
  }

  @Public()
  @Post("first-connection")
  @RateLimit({ bucket: "auth-first-connection", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Complete first connection with temporary password" })
  async completeFirstConnection(@Body() body: FirstConnectionDto): Promise<MessageResponse> {
    return this.authService.completeFirstConnection(body);
  }
}
