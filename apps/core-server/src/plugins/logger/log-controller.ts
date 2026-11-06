/**
 * The server's log controller: Fastify's own extension point for the lines it writes per
 * request. Fastify's defaults log the raw URL ("incoming request", "Route GET:/x?y not found")
 * and an error's message; this controller writes one line per request with the fields of SR-49
 * and logs a failure by its code (SR-48).
 */
import { LogController, type FastifyReply, type FastifyRequest } from 'fastify';
import { requestLogLine } from './request-log';

export class CoreLogController extends LogController {
  /** No line when a request arrives: the one line is written when it completes. */
  override incomingRequest(): void {}

  /** method, route pattern, status, duration, principal reference; the request ID is a binding. */
  override requestCompleted(error: Error | null | undefined, request: FastifyRequest, reply: FastifyReply): void {
    const line = requestLogLine(request, reply);
    if (error) {
      reply.log.error({ ...line, err: error }, 'request errored');
    } else {
      reply.log.info(line, 'request completed');
    }
  }

  /** Only reached if Fastify's default error handler runs; the server installs its own. */
  override defaultErrorLog(error: Error, _request: FastifyRequest, reply: FastifyReply): void {
    reply.log.error({ err: error, statusCode: reply.statusCode }, 'request failed');
  }

  /** The not-found handler of the error envelope answers; the request line records the 404. */
  override routeNotFound(): void {}

  override writeHeadError(error: Error, _request: FastifyRequest, reply: FastifyReply): void {
    reply.log.warn({ err: error }, 'response headers could not be written');
  }
}
