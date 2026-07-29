export type FrontendCspOrigins = {
  apiOrigin: string | null;
  storageOrigin: string | null;
};

export function resolveFrontendCspOrigins(options: {
  apiBaseUrl?: string;
  storageAssetOrigin?: string;
  mode?: string;
}): FrontendCspOrigins;

export function buildFrontendCsp(
  options: FrontendCspOrigins & {
    includeFrameAncestors?: boolean;
    upgradeInsecureRequests?: boolean;
  }
): string;

export function frontendSecurityHeaders(csp: string): Record<string, string>;
