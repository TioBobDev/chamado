export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400);
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso proibido') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    const response: { message: string; errors?: Record<string, string[]> } = {
      message: error.message,
    };
    if (error instanceof ValidationError && error.errors) {
      response.errors = error.errors;
    }
    return Response.json(response, { status: error.statusCode });
  }

  console.error('[ERRO INTERNO]:', error);
  return Response.json(
    { message: 'Ocorreu um erro interno no servidor.' },
    { status: 500 }
  );
}
