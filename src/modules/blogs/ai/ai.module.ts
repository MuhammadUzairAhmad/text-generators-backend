import { Module } from '@nestjs/common';
import { GeminiTranslateService } from './gemini-translate.service';

@Module({
  providers: [GeminiTranslateService],
  exports: [GeminiTranslateService],
})
export class AiModule {}
