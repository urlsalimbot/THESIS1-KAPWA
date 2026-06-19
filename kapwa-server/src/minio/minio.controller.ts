import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { MinioService } from './minio.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('MinIO')
@Controller('minio')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class MinioController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Upload file to MinIO bucket' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const signedUrl = await this.minioService.uploadFile(
      'documents',
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    return { url: signedUrl };
  }

  @Get('signed-url/:bucket/:fileName')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get presigned GET URL for a file' })
  async getSignedUrl(
    @Param('bucket') bucket: string,
    @Param('fileName') fileName: string,
  ) {
    const url = await this.minioService.getSignedUrl(bucket, fileName);
    return { url };
  }
}
