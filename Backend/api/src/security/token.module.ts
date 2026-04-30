import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { getJwtRuntimeConfig } from "./jwt-config.util";

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = getJwtRuntimeConfig(configService);
        return {
          global: true,
          secret: jwtConfig.secret,
          signOptions: {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
          }
        };
      }
    })
  ],
  exports: [JwtModule]
})
export class TokenModule {}
