export interface LogMeta {
  userId?: string;
  companyId?: string;
  action?: string;
  executionTimeMs?: number;
  [key: string]: any;
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
        ...meta,
      })
    );
  },

  warn(message: string, meta?: LogMeta) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message,
        ...meta,
      })
    );
  },

  error(message: string, error?: unknown, meta?: LogMeta) {
    let errorDetails = '';
    if (error instanceof Error) {
      errorDetails = error.stack || error.message;
    } else if (error) {
      errorDetails = JSON.stringify(error);
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message,
        error: errorDetails,
        ...meta,
      })
    );
  },

  /**
   * Monitora o tempo de execução de uma função assíncrona.
   */
  async profile<T>(
    label: string,
    fn: () => Promise<T>,
    meta?: Omit<LogMeta, 'executionTimeMs'>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const end = performance.now();
      const duration = Math.round(end - start);
      this.info(`[TIMER] ${label}`, { ...meta, executionTimeMs: duration });
    }
  },
};
