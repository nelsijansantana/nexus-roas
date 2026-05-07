import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PixelEventsService } from './pixel-events.service';
import { CreatePixelEventDto, UpdatePixelEventDto } from './dto/pixel-event.dto';

@Controller('api/v1/projects/:projectId/pixel-events')
export class PixelEventsController {
  constructor(
    private readonly pixelEvents: PixelEventsService,
    private readonly authService: AuthService,
  ) {}

  private _auth(authHeader: string) {
    if (!authHeader) throw new UnauthorizedException();
    return this.authService.verifyToken(authHeader.replace('Bearer ', ''));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePixelEventDto,
    @Headers('authorization') auth: string,
  ) {
    const caller = this._auth(auth);
    return this.pixelEvents.create(projectId, dto, caller);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Headers('authorization') auth: string,
  ) {
    const caller = this._auth(auth);
    return this.pixelEvents.findAll(projectId, caller);
  }

  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePixelEventDto,
    @Headers('authorization') auth: string,
  ) {
    const caller = this._auth(auth);
    return this.pixelEvents.update(projectId, id, dto, caller);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ) {
    const caller = this._auth(auth);
    return this.pixelEvents.remove(projectId, id, caller);
  }
}
