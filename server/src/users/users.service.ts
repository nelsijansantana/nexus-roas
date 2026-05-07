import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.users.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const now = new Date();
    const newUser = await this.prisma.users.create({
      data: {
        id: randomUUID(),
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Exclude password out of returned response
    const { password, ...result } = newUser;
    return result;
  }
}
