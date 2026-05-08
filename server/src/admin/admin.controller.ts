import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
} from '../users/dto/admin-user.dto';

@Controller('api/v1/admin')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users')
  async createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('metrics')
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('users/:id/consumption')
  async getUserConsumption(@Param('id') id: string) {
    return this.adminService.getUserConsumption(id);
  }
}
