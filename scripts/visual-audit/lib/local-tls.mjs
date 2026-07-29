const LOCAL_RC_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SPKI_SHA256_PATTERN = /^[A-Za-z0-9+/]{43}=$/u;

export const resolveChromiumLaunchOptions = ({
  mode,
  baseUrl,
  runtimeEnvironment,
  spkiSha256,
  hostResolverRules
}) => {
  const pin = String(spkiSha256 || "").trim();
  if (!pin) return { headless: true };

  const url = new URL(baseUrl);
  const localHost = LOCAL_RC_HOSTS.has(url.hostname) || url.hostname.endsWith(".local");
  if (
    mode !== "integrated" ||
    runtimeEnvironment !== "rc" ||
    url.protocol !== "https:" ||
    !localHost
  ) {
    throw new Error(
      "A local TLS certificate pin is allowed only for an integrated HTTPS RC on localhost or a .local host."
    );
  }
  if (!SPKI_SHA256_PATTERN.test(pin)) {
    throw new Error("VISUAL_AUDIT_LOCAL_TLS_SPKI_SHA256 must be one base64 SHA-256 SPKI pin.");
  }

  const args = [`--ignore-certificate-errors-spki-list=${pin}`];
  const resolverRules = String(hostResolverRules || "").trim();
  if (resolverRules) {
    if (!/^MAP [a-z0-9.-]+ 127\.0\.0\.1$/iu.test(resolverRules)) {
      throw new Error("VISUAL_AUDIT_HOST_RESOLVER_RULES contains an unsafe mapping.");
    }
    args.push(`--host-resolver-rules=${resolverRules}`);
  }
  return { headless: true, args };
};
