import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/** Padroniza respostas de erro e traduz erros conhecidos do Prisma. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Erro interno';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // getResponse() pode ser string ou objeto { statusCode, message, error }.
      // O 'message' interno pode ser string OU array (class-validator).
      // Normalizamos SEMPRE para uma string — senão o cliente recebe um objeto
      // e exibe "[object Object]".
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        message = resBody;
      } else {
        const inner = (resBody as { message?: unknown; error?: unknown }).message;
        message = Array.isArray(inner)
          ? inner.join('; ')
          : typeof inner === 'string'
            ? inner
            : ((resBody as { error?: unknown }).error ?? 'Erro');
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Registro já existe (violação de unicidade).';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Registro não encontrado.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Erro de banco (${exception.code}).`;
      }
    } else if (exception instanceof Error) {
      // NÃO vazar o detalhe interno (URLs da SEFAZ, erros de conexão, IDs) ao cliente.
      // O detalhe vai SÓ para o log; o cliente recebe mensagem genérica.
      this.logger.error(exception.message, exception.stack);
      message = 'Erro interno ao processar a solicitação. Tente novamente.';
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      message,
    });
  }
}
