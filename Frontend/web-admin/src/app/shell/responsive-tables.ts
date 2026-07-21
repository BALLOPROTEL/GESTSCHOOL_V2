// Temporary compatibility for screens that have not yet moved column labels into React.
export const decorateLegacyResponsiveTables = (root: ParentNode): void => {
  const tables = root.querySelectorAll<HTMLTableElement>(".table-wrap table");

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
      (header) => header.textContent?.replace(/\s+/g, " ").trim() || ""
    );

    if (table.dataset.responsiveTable !== "true") {
      table.dataset.responsiveTable = "true";
    }

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        if (cell.colSpan > 1) {
          if (cell.hasAttribute("data-label")) {
            cell.removeAttribute("data-label");
          }
          return;
        }

        const label = headers[index];
        if (label && cell.dataset.label !== label) {
          cell.dataset.label = label;
        } else if (!label && cell.hasAttribute("data-label")) {
          cell.removeAttribute("data-label");
        }
      });
    });
  });
};
