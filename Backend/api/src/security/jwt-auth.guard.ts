import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../database/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { type AuthenticatedUser } from "./authenticated-user.interface";
import { getJwtRuntimeConfig } from "./jwt-config.util";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();

    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing Authorization Bearer token.");
    }

    const jwtConfig = getJwtRuntimeConfig(this.configService);
    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: jwtConfig.secret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }

    if (!payload.sid || !payload.sub || !payload.tenantId) {
      throw new UnauthorizedException("Session identifier is missing.");
    }

    let currentUser: {
      tenantId: string;
      username: string;
      role: string;
    } | null;
    try {
      const now = new Date();
      currentUser = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
          status: "ACTIVE",
          isActive: true,
          deletedAt: null,
          refreshTokens: {
            some: {
              id: payload.sid,
              tenantId: payload.tenantId,
              revokedAt: null,
              expiresAt: { gt: now }
            }
          }
        },
        select: {
          tenantId: true,
          username: true,
          role: true
        }
      });
    } catch {
      throw new ServiceUnavailableException(
        "Authentication state is temporarily unavailable."
      );
    }

    if (!currentUser) {
      throw new UnauthorizedException("Session is no longer active.");
    }

    request.user = {
      ...payload,
      username: currentUser.username,
      role: currentUser.role as AuthenticatedUser["role"],
      tenantId: currentUser.tenantId
    };
    return true;
  }

  private extractBearerToken(
    authorizationHeader: string | string[] | undefined
  ): string | null {
    const header = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return null;
    }

    return token;
  }
}
