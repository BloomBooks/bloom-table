import { attachAllTables } from "./utils/tableAttachment";

// Attach after DOMContentLoaded to ensure elements are present
window.addEventListener("DOMContentLoaded", () => {
  attachAllTables();
});
