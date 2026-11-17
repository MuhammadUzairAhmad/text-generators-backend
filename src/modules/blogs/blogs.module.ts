import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { Niche, NicheSchema } from './schemas/niche.schema';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: Niche.name, schema: NicheSchema },
    ]),
    AiModule,
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService],
})
export class BlogsModule {}
