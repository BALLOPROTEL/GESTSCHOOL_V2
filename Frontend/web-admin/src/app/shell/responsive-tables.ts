export const decorateResponsiveTables = (root: ParentNode): void => {
  const tables = root.querySelectorAll<HTMLTableElement>(".table-wrap table");

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
      (header) => header.textContent?.replace(/\s+/g, " ").trim() || ""
    );

    table.dataset.responsiveTable = "true";

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        if (cell.colSpan > 1) {
          cell.removeAttribute("data-label");
          return;
        }

        const label = headers[index];
        if (label) {
          cell.dataset.label = label;
        } else {
          cell.removeAttribute("data-label");
        }
      });
    });
  });
};
