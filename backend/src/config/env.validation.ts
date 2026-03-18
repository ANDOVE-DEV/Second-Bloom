export interface Env {
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL?: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const portRaw = config.PORT as string | undefined;
  const port = Number(portRaw ?? '3000');

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return {
    PORT: port,
    DATABASE_URL: required('DATABASE_URL', config.DATABASE_URL as string | undefined),
    REDIS_URL: config.REDIS_URL as string | undefined,
    JWT_ACCESS_SECRET: required(
      'JWT_ACCESS_SECRET',
      config.JWT_ACCESS_SECRET as string | undefined,
    ),
    JWT_REFRESH_SECRET: required(
      'JWT_REFRESH_SECRET',
      config.JWT_REFRESH_SECRET as string | undefined,
    ),
    JWT_ACCESS_EXPIRES_IN:
      (config.JWT_ACCESS_EXPIRES_IN as string | undefined) ?? '15m',
    JWT_REFRESH_EXPIRES_IN:
      (config.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? '30d',
  };
}
