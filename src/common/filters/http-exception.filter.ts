import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const error = typeof exceptionResponse === 'string'
      ? { message: exceptionResponse }
      : (exceptionResponse as object);

    const errorResponse = {
      ...error,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
    };

    this.logger.error(`HTTP Exception:`, JSON.stringify(errorResponse));

    response
      .status(status)
      .json(errorResponse);
  }
}