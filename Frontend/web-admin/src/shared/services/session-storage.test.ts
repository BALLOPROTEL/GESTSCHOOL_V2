import { beforeEach, describe, expect, it } from "vitest";

import { LOCAL_PREVIEW_ACCESS_TOKEN } from "./local-preview-session";
import { persistSession, readStoredSession } from "./session-storage";
import type { Session } from "../types/app";

const createSession = (accessToken: string, refreshToken = accessToken): Session => ({
  accessToken,
  refreshToken,
  tenantId: "00000000-0000-0000-0000-000000000001",
  user: {
    role: "ADMIN",
    tenantId: "00000000-0000-0000-0000-000000000001",
    username: "admin@example.local"
  }
});

describe("session-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("ne restaure jamais une session aperçu local persistée", () => {
    persistSession(createSession(LOCAL_PREVIEW_ACCESS_TOKEN));

    expect(readStoredSession()).toBeNull();
    expect(window.sessionStorage.getItem("gestschool.web-admin.session")).toBeNull();
  });

  it("restaure une vraie session applicative", () => {
    const token = "a".repeat(64);
    const session = createSession(token, "b".repeat(64));

    persistSession(session);

    expect(readStoredSession()).toEqual(session);
  });

  it("conserve les informations d’affichage du compte dont l’avatar", () => {
    const token = "a".repeat(64);
    const session: Session = {
      ...createSession(token, "b".repeat(64)),
      user: {
        id: "user-1",
        username: "admin@example.local",
        role: "ADMIN",
        tenantId: "00000000-0000-0000-0000-000000000001",
        email: "admin@example.local",
        phone: "+22370000000",
        displayName: "Admin GestSchool",
        avatarUrl: "https://storage.example/avatar.png",
        accountType: "STAFF",
        status: "ACTIVE"
      }
    };

    persistSession(session);

    expect(readStoredSession()).toEqual(session);
  });
});
