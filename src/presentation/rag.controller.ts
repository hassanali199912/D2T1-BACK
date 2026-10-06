import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RagService } from '../application/rag.service.js';
import { RetrieveDto } from './dto/retrieve.dto.js';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('retrieve')
  @HttpCode(200)
  retrieve(@Body() dto: RetrieveDto) {
    return this.ragService.retrieve(dto);
  }
}
