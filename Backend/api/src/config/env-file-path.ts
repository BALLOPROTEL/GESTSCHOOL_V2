export const resolveEnvFilePath = (): string[] => {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();

  if (nodeEnv === "production") {
    return [".env", "../../.env"];
  }

  return [".env", ".env.example", "../../.env", "../../.env.example"];
};
