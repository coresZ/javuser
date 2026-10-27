var THEME_KEY = "ppk.theme";
function readTheme() {
  const v = gm.getValue(THEME_KEY, "light");
  return v === "dark" ? "dark" : "light";
}
function applyThemeClass() {
  const dark = readTheme() === "dark";
  if (uiHost) uiHost.classList.toggle("cores-ppk-theme-dark", dark);
}
function toggleTheme() {
  gm.setValue(THEME_KEY, readTheme() === "dark" ? "light" : "dark");
  applyThemeClass();
}
