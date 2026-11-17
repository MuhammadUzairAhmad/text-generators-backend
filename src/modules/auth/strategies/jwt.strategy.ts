import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          if (req?.cookies?.admin_token) {
            return req.cookies.admin_token;
          }
          if (req?.headers?.cookie) {
            const match = req.headers.cookie.match(/admin_token=([^;]+)/);
            if (match) return decodeURIComponent(match[1]);
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-insecure-jwt-secret-replace-in-env-file-32-chars',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException('Invalid or expired token payload');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name || 'Admin',
    };
  }
}
