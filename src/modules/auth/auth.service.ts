import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto/user-management.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdminIfEmpty();
  }

  async seedDefaultAdminIfEmpty() {
    try {
      const count = await this.userModel.countDocuments();
      if (count === 0) {
        const defaultEmail = this.configService.get<string>('DEFAULT_ADMIN_EMAIL') || 'admin@textgenerators.net';
        const defaultPassword = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') || 'mIcCavn6wb0Hfude8s';
        const defaultName = this.configService.get<string>('DEFAULT_ADMIN_NAME') || 'Super Admin';

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        await this.userModel.create({
          name: defaultName,
          email: defaultEmail.toLowerCase().trim(),
          passwordHash,
          role: 'super_admin',
          isActive: true,
        });

        this.logger.log(`Initialized default super admin account for: ${defaultEmail}`);
      }
    } catch (err: unknown) {
      this.logger.error(`Error checking/seeding default admin: ${(err as Error).message}`);
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+passwordHash');

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = this.jwtService.sign(payload);

    return {
      success: true,
      token,
      accessToken: token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User session is invalid or user is inactive');
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.avatar !== undefined) user.avatar = dto.avatar as any;

    await user.save();
    return {
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    this.logger.log(`Password successfully updated for user: ${user.email}`);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  // ===================== Admin Users Management =====================

  async findAllUsers() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).lean().exec();
    const formatted = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
    return { items: formatted, total: formatted.length };
  }

  async createUser(dto: CreateUserDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ email: normalizedEmail }).lean().exec();
    if (existing) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = new this.userModel({
      name: dto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: dto.role || 'admin',
      isActive: true,
    });

    await user.save();
    return {
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid user ID: ${id}`);
    }

    const user = await this.userModel.findById(id).select('+passwordHash');
    if (!user) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password && dto.password.trim()) {
      const salt = await bcrypt.genSalt(12);
      user.passwordHash = await bcrypt.hash(dto.password, salt);
    }

    await user.save();
    return {
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async deleteUser(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid user ID: ${id}`);
    }

    const res = await this.userModel.findByIdAndDelete(id).exec();
    if (!res) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    return { success: true, id };
  }
}
