import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_MESSAGES } from "../../shared/i18n";
import { GlobalToastLayer } from "./global-toast-layer";

afterEach(cleanup);

describe("GlobalToastLayer", () => {
  it("rend la notification globale dans document.body et la ferme", () => {
    const onDismissNotice = vi.fn();
    const { container } = render(
      <main className="page">
        <header className="global-header-shell" />
        <GlobalToastLayer
          error={null}
          language="en"
          notice="Mode aperçu local activé : données de démonstration non persistées."
          onDismissError={vi.fn()}
          onDismissNotice={onDismissNotice}
        />
      </main>
    );

    const toastStack = screen.getByTestId("global-toast-stack");
    expect(toastStack.parentElement).toBe(document.body);
    expect(container.querySelector(".global-header-shell")?.contains(toastStack)).toBe(false);
    expect(toastStack).toHaveAttribute("data-global-toast-layer", "true");
    expect(toastStack).toHaveClass("global-toast-layer");
    expect(toastStack.style.position).toBe("fixed");
    expect(toastStack.style.zIndex).toBe("var(--shell-z-toast, 6500)");
    expect(screen.getByText("Information")).toBeInTheDocument();
    expect(screen.getByText(/Local preview mode enabled/u)).toBeInTheDocument();
    expect(screen.queryByText("Fermer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close notification" }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("traduit le toast en arabe sans texte source francais", () => {
    render(
      <GlobalToastLayer
        error={null}
        language="ar"
        notice="Mode aperçu local activé : données de démonstration non persistées."
        onDismissError={vi.fn()}
        onDismissNotice={vi.fn()}
      />
    );

    expect(screen.getByText("معلومة")).toBeInTheDocument();
    expect(screen.getByTestId("global-toast-stack")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText(/وضع المعاينة المحلية مفعل/u)).toBeInTheDocument();
    expect(screen.queryByText("Fermer")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mode aperçu local/u)).not.toBeInTheDocument();
  });

  it.each([
    ["fr", "Attention", "Fermer", "Fermer la notification d'erreur", "L'année scolaire ne peut pas être supprimée car elle est encore utilisée."],
    ["en", "Warning", "Close", "Close error notification", "The school year cannot be deleted because it is still in use."],
    ["ar", "تنبيه", "إغلاق", "إغلاق إشعار الخطأ", "لا يمكن حذف السنة الدراسية لأنها لا تزال مستخدمة."]
  ] as const)("rend une erreur centralisée en %s", (language, title, close, closeLabel, message) => {
    render(
      <GlobalToastLayer
        error={UI_MESSAGES.schoolYearInUse}
        language={language}
        notice={null}
        onDismissError={vi.fn()}
        onDismissNotice={vi.fn()}
      />
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText(close)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: closeLabel })).toBeInTheDocument();
    expect(screen.queryByText("School year cannot be deleted because it is still used.")).not.toBeInTheDocument();
  });
});
