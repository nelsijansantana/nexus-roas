import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { PixelEventsController } from './pixel-events.controller';
import { PixelEventsService } from './pixel-events.service';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [PixelEventsController],
  providers: [PixelEventsService],
  exports: [PixelEventsService],
})
export class PixelEventsModule {}
