import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { phTime } from '../utils';
import { ThrottlerException } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';
import { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Service temporarily unavailable. Contact MSWDO.';
    let stack: string | undefined;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Rate limit exceeded. Try again later.';
    } else if (exception instanceof WsException) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message || 'WebSocket error';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${typeof message === 'string' ? message : (message as any).message || 'Unknown error'}`,
      stack,
    );

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message || message,
      timestamp: phTime(),
      path: request.url,
    });
  }
}
