import { useI18n } from "../i18n-context";

type ResponsivePaginationProps = {
  currentPage: number;
  onNext: () => void;
  onPrevious: () => void;
  totalPages: number;
};

export function ResponsivePagination({
  currentPage,
  onNext,
  onPrevious,
  totalPages
}: ResponsivePaginationProps): JSX.Element {
  const { t } = useI18n();
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);

  return (
    <nav className="responsive-pagination" aria-label={t("Pagination")}>
      <button
        type="button"
        className="button-ghost"
        disabled={safeCurrent <= 1}
        aria-label={t("Page précédente")}
        onClick={onPrevious}
      >
        <span aria-hidden="true">‹</span>
        <span className="responsive-pagination-label">{t("Précédent")}</span>
      </button>
      <span className="responsive-pagination-status" aria-live="polite">
        {t("Page")} <strong>{safeCurrent}</strong> / {safeTotal}
      </span>
      <button
        type="button"
        className="button-ghost"
        disabled={safeCurrent >= safeTotal}
        aria-label={t("Page suivante")}
        onClick={onNext}
      >
        <span className="responsive-pagination-label">{t("Suivant")}</span>
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}
