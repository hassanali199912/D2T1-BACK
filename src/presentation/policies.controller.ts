import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PoliciesService } from '../application/policies.service.js';
import { files } from '../infrastructure/files.js';
import { CreatePolicyDto } from './dto/create-policy.dto.js';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @UseInterceptors(files.interceptor('document'))
  create(@Body() dto: CreatePolicyDto, @UploadedFile() document: Express.Multer.File) {
    return this.policiesService.create(dto, document);
  }

  @Get()
  findAll() {
    return this.policiesService.findAll();
  }

  @Get('options')
  listOptions() {
    return this.policiesService.listOptions();
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.remove(id);
  }
}
