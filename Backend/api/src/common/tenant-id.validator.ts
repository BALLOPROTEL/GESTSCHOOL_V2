import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions
} from "class-validator";

export const LEGACY_DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const VERSIONED_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAllowedTenantId(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const tenantId = value.trim();
  if (VERSIONED_UUID_PATTERN.test(tenantId)) {
    return true;
  }

  return (
    tenantId === LEGACY_DEFAULT_TENANT_ID &&
    String(env.ALLOW_LEGACY_DEFAULT_TENANT_ID || "").trim().toLowerCase() === "true"
  );
}

export function IsAllowedTenantId(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: "isAllowedTenantId",
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isAllowedTenantId(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid versioned UUID.`
      }
    });
  };
}
