import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter.
 *
 * - ECONNABORTED / request.aborted: the webhook sender (e.g. CartPanda) closed
 *   the TCP connection before finishing the body transfer. This is a transient
 *   network issue on the sender side — they will retry. Log as WARN, not ERROR.
 *
 * - HttpException: standard NestJS HTTP errors (400, 401, 404, …).
 *
 * - Everything else: unexpected server errors — log as ERROR with full stack.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // ── Connection aborted by webhook sender ──────────────────────────────────
    // CartPanda (and other senders) occasionally open a TCP connection, send the
    // HTTP headers, then close the socket before writing the body. raw-body
    // throws with code='ECONNABORTED' / type='request.aborted'. Since the socket
    // is already closed at this point, we cannot send a response — just log it.
    const err = exception as any;
    if (
      err?.code === 'ECONNABORTED' ||
      err?.type === 'request.aborted' ||
      err?.message === 'request aborted'
    ) {
      this.logger.warn(
        `[${req?.method} ${req?.url}] Connection aborted by sender before body was received ` +
          `(expected=${err?.length ?? '?'} bytes, received=${err?.received ?? 0}). ` +
          `The sender will retry — no action needed.`,
      );
      // The connection is already closed; attempting to write a response will
      // cause a "write after end" error. Only write if the socket is still open.
      if (!res.headersSent && !req.socket?.destroyed) {
        res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'connection_aborted' });
      }
      return;
    }

    // ── Standard NestJS HTTP exceptions ───────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (!res.headersSent) {
        res.status(status).json(body);
      }
      return;
    }

    // ── Unexpected server errors ───────────────────────────────────────────────
    this.logger.error(
      `[${req?.method} ${req?.url}] Unhandled exception`,
      err?.stack ?? String(exception),
    );
    if (!res.headersSent) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }
}
