import { useCallback, useEffect, useState } from "react";
import type { FormEvent, MutableRefObject } from "react";

import type {
  AuthMessageResponse,
  FieldErrors,
  ForgotPasswordResponse,
  RememberedLogin,
  Role,
  ScreenId,
  Session
} from "../shared/types/app";
import { focusFirstInlineErrorField, hasFieldErrors } from "../shared/utils/form-ui";
import {
  DEFAULT_TENANT,
  LOGIN_HINT_STORAGE_KEY,
  STRONG_PASSWORD_HINT
} from "./app-config";
import { isStrongPassword, parseError } from "./app-formatters";
import { ROLE_HOME_SCREEN } from "./navigation/screen-registry";

type UseAuthFlowsParams = {
  clearData: () => void;
  clearSession: () => void;
  ensureApiAvailable: (force?: boolean) => Promise<boolean>;
  markApiAvailable: () => void;
  markApiUnavailable: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onSyncNow: () => void;
  rememberedLogin: RememberedLogin | null;
  resolveApiUrl: (path: string) => string;
  saveSession: (session: Session) => void;
  sessionRef: MutableRefObject<Session | null>;
  setTab: (screen: ScreenId) => void;
};

export function useAuthFlows({
  clearData,
  clearSession,
  ensureApiAvailable,
  markApiAvailable,
  markApiUnavailable,
  onError,
  onNotice,
  onSyncNow,
  rememberedLogin,
  resolveApiUrl,
  saveSession,
  sessionRef,
  setTab
}: UseAuthFlowsParams) {
  const [loginForm, setLoginForm] = useState({
    username: rememberedLogin?.username || "",
    password: "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedLogin?.remember));
  const [authAssistMode, setAuthAssistMode] = useState<"none" | "forgot" | "first">("none");
  const [authAssistLoading, setAuthAssistLoading] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    token: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [firstConnectionForm, setFirstConnectionForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT,
    temporaryPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token")?.trim();
    if (!token) return;

    if (window.location.pathname.includes("reset-password")) {
      setResetPasswordForm((prev) => ({ ...prev, token }));
      setAuthAssistMode("forgot");
      return;
    }

    if (window.location.pathname.includes("activate")) {
      setFirstConnectionForm((prev) => ({ ...prev, temporaryPassword: token }));
      setAuthAssistMode("first");
    }
  }, []);

  const showLoginPanel = useCallback((): void => {
    setAuthAssistMode("none");
    onError(null);
    onNotice(null);
  }, [onError, onNotice]);

  const showForgotPasswordPanel = useCallback((): void => {
    setAuthAssistMode("forgot");
    onError(null);
    onNotice(null);
  }, [onError, onNotice]);

  const showFirstConnectionPanel = useCallback((): void => {
    setAuthAssistMode("first");
    onError(null);
    onNotice(null);
  }, [onError, onNotice]);

  const performPublicRequest = useCallback(
    async (
      path: string,
      init: RequestInit,
      options: { forceProbe?: boolean; suppressError?: boolean } = {}
    ): Promise<Response | null> => {
      const { forceProbe = true, suppressError = false } = options;
      const ready = await ensureApiAvailable(forceProbe);
      if (!ready) {
        if (!suppressError) {
          onError("API indisponible. Reconnexion...");
        }
        return null;
      }

      try {
        const response = await fetch(resolveApiUrl(path), init);
        markApiAvailable();
        return response;
      } catch {
        markApiUnavailable();
        if (!suppressError) {
          onError("API indisponible. Reconnexion...");
        }
        return null;
      }
    },
    [ensureApiAvailable, markApiAvailable, markApiUnavailable, onError, resolveApiUrl]
  );

  const requestForgotPasswordToken = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      onError(null);
      onNotice(null);

      if (!forgotPasswordForm.username.trim()) {
        onError("Renseignez votre identifiant pour recevoir le lien de réinitialisation.");
        return;
      }

      setAuthAssistLoading(true);
      try {
        const response = await performPublicRequest("/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: forgotPasswordForm.username.trim(),
            tenantId: DEFAULT_TENANT
          })
        });
        if (!response) return;
        if (!response.ok) {
          onError(await parseError(response));
          return;
        }

        const payload = (await response.json()) as ForgotPasswordResponse;
        onNotice(payload.message || "Si un compte correspond à ces informations, un email de réinitialisation a été envoyé.");
      } finally {
        setAuthAssistLoading(false);
      }
    },
    [forgotPasswordForm.username, onError, onNotice, performPublicRequest]
  );

  const submitResetPassword = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      onError(null);
      onNotice(null);

      if (!resetPasswordForm.token.trim()) {
        onError("Lien de réinitialisation invalide ou expiré.");
        return;
      }
      if (!isStrongPassword(resetPasswordForm.newPassword)) {
        onError(STRONG_PASSWORD_HINT);
        return;
      }
      if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
        onError("La confirmation du mot de passe ne correspond pas.");
        return;
      }

      setAuthAssistLoading(true);
      try {
        const response = await performPublicRequest("/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetPasswordForm.token.trim(),
            newPassword: resetPasswordForm.newPassword
          })
        });
        if (!response) return;
        if (!response.ok) {
          onError(await parseError(response));
          return;
        }

        const payload = (await response.json()) as AuthMessageResponse;
        onNotice(payload.message || "Mot de passe réinitialisé.");
        setLoginForm((prev) => ({
          ...prev,
          username: forgotPasswordForm.username.trim() || prev.username,
          tenantId: DEFAULT_TENANT,
          password: ""
        }));
        setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
        setAuthAssistMode("none");
        window.history.replaceState({}, "", "/");
      } finally {
        setAuthAssistLoading(false);
      }
    },
    [
      forgotPasswordForm.username,
      onError,
      onNotice,
      performPublicRequest,
      resetPasswordForm.confirmPassword,
      resetPasswordForm.newPassword,
      resetPasswordForm.token
    ]
  );

  const submitFirstConnection = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      onError(null);
      onNotice(null);

      const activationToken = firstConnectionForm.temporaryPassword.trim();
      if (!activationToken && !firstConnectionForm.username.trim()) {
        onError("Identifiant requis pour renvoyer le lien d’activation.");
        return;
      }
      if (!activationToken) {
        setAuthAssistLoading(true);
        try {
          const response = await performPublicRequest("/auth/resend-activation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: firstConnectionForm.username.trim(),
              tenantId: DEFAULT_TENANT
            })
          });
          if (!response) return;
          if (!response.ok) {
            onError(await parseError(response));
            return;
          }
          const payload = (await response.json()) as AuthMessageResponse;
          onNotice(payload.message || "Si un compte en attente correspond à ces informations, un email d’activation a été envoyé.");
        } finally {
          setAuthAssistLoading(false);
        }
        return;
      }
      if (!isStrongPassword(firstConnectionForm.newPassword)) {
        onError(STRONG_PASSWORD_HINT);
        return;
      }
      if (firstConnectionForm.newPassword !== firstConnectionForm.confirmPassword) {
        onError("La confirmation du mot de passe ne correspond pas.");
        return;
      }

      setAuthAssistLoading(true);
      try {
        const response = await performPublicRequest("/auth/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: activationToken,
            newPassword: firstConnectionForm.newPassword
          })
        });
        if (!response) return;
        if (!response.ok) {
          onError(await parseError(response));
          return;
        }

        const payload = (await response.json()) as AuthMessageResponse;
        onNotice(payload.message || "Compte activé. Vous pouvez maintenant vous connecter.");
        setLoginForm((prev) => ({
          ...prev,
          username: firstConnectionForm.username.trim(),
          tenantId: DEFAULT_TENANT,
          password: ""
        }));
        setFirstConnectionForm((prev) => ({
          ...prev,
          temporaryPassword: "",
          newPassword: "",
          confirmPassword: ""
        }));
        setAuthAssistMode("none");
        window.history.replaceState({}, "", "/");
      } finally {
        setAuthAssistLoading(false);
      }
    },
    [
      firstConnectionForm.confirmPassword,
      firstConnectionForm.newPassword,
      firstConnectionForm.temporaryPassword,
      firstConnectionForm.username,
      onError,
      onNotice,
      performPublicRequest
    ]
  );

  const login = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      onError(null);
      onNotice(null);
      const errors: FieldErrors = {};
      if (!loginForm.username.trim()) errors.username = "Nom utilisateur requis.";
      if (!loginForm.password || loginForm.password.length < 8) errors.password = "Minimum 8 caracteres.";
      setLoginErrors(errors);
      if (hasFieldErrors(errors)) {
        focusFirstInlineErrorField();
        return;
      }
      setLoadingAuth(true);
      try {
        const response = await performPublicRequest("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: loginForm.username.trim(),
            password: loginForm.password,
            tenantId: DEFAULT_TENANT
          })
        });
        if (!response) return;
        if (!response.ok) {
          onError(await parseError(response));
          return;
        }
        const payload = (await response.json()) as Omit<Session, "tenantId"> & { user: Session["user"] };
        const nextSession = { ...payload, tenantId: payload.user.tenantId || DEFAULT_TENANT };
        const role = (nextSession.user.role as Role) || "ADMIN";
        const cleanUsername = loginForm.username.trim();
        const cleanTenant = payload.user.tenantId || DEFAULT_TENANT;
        setLoginErrors({});
        saveSession(nextSession);
        onSyncNow();
        setAuthAssistMode("none");
        if (rememberMe) {
          localStorage.setItem(
            LOGIN_HINT_STORAGE_KEY,
            JSON.stringify({
              username: cleanUsername,
              tenantId: cleanTenant,
              remember: true
            } as RememberedLogin)
          );
        } else {
          localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
        }
        onNotice("Connexion reussie.");
        setTab(ROLE_HOME_SCREEN[role] || "dashboard");
      } finally {
        setLoadingAuth(false);
      }
    },
    [
      loginForm.password,
      loginForm.username,
      onError,
      onNotice,
      onSyncNow,
      performPublicRequest,
      rememberMe,
      saveSession,
      setTab
    ]
  );

  const logout = useCallback(async (): Promise<void> => {
    const current = sessionRef.current;
    if (current?.refreshToken && (await ensureApiAvailable())) {
      await performPublicRequest(
        "/auth/logout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken })
        },
        { forceProbe: false, suppressError: true }
      );
    }
    clearSession();
    setAuthAssistMode("none");
    setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
    clearData();
    onNotice("Deconnexion reussie.");
    onError(null);
  }, [clearData, clearSession, ensureApiAvailable, onError, onNotice, performPublicRequest, sessionRef]);

  return {
    authAssistLoading,
    authAssistMode,
    firstConnectionForm,
    forgotPasswordForm,
    loadingAuth,
    login,
    loginErrors,
    loginForm,
    logout,
    rememberMe,
    requestForgotPasswordToken,
    resetPasswordForm,
    setFirstConnectionForm,
    setForgotPasswordForm,
    setLoginForm,
    setRememberMe,
    setResetPasswordForm,
    showFirstConnectionPanel,
    showForgotPasswordPanel,
    showLoginPanel,
    submitFirstConnection,
    submitResetPassword
  };
}
