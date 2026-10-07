export function postgresCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const record = error as { code?: string; driverError?: { code?: string } };
  return record.driverError?.code ?? record.code;
}
