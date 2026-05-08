import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { AuthService, JwtPayload } from '../auth/auth.service';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  create(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateProjectDto,
  ) {
    const user = this.extractUser(authHeader);
    // Projects are always owned by the account owner, not the member
    dto.userId = user.ownerId ?? user.userId;
    return this.projectsService.create(dto, user);
  }

  @Get()
  findAll(@Headers('authorization') authHeader: string) {
    const user = this.extractUser(authHeader);
    return this.projectsService.findAllByUser(user);
  }

  @Get(':id')
  findOne(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const user = this.extractUser(authHeader);
    return this.projectsService.findOne(id, user);
  }

  @Get(':id/worker/download')
  async downloadWorker(
    @Param('id') id: string,
    @Res() res: Response,
    @Body() body: any,
    @Param() params: any,
    @Body('_user') user: any,
  ) {
    const buffer = await this.projectsService.getWorkerBundle(id, user);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="nexus-worker-${id.substring(0, 8)}.zip"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Patch(':id')
  update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateProjectDto,
  ) {
    const user = this.extractUser(authHeader);
    return this.projectsService.update(id, updateDto, user);
  }

  @Delete(':id')
  remove(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const user = this.extractUser(authHeader);
    return this.projectsService.remove(id, user);
  }

  private extractUser(authHeader: string): JwtPayload {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    return this.authService.verifyToken(authHeader.replace('Bearer ', ''));
  }
}
