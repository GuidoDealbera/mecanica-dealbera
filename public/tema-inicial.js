// Aplica el tema persistido antes del primer render, para que no se vea el
// parpadeo de colores. Tiene que coincidir con `ThemeProvider`.
//
// Vive en un archivo y no en línea en el HTML por la política de seguridad del
// renderer: un script en línea obligaría a `'unsafe-inline'` —que abre la
// puerta a todos— o a un hash en la política, que hay que acordarse de
// actualizar cada vez que se toca este código. Un archivo lo cubre `'self'`.
(function () {
  try {
    var t = localStorage.getItem("app-theme");
    if (t !== "light" && t !== "dark") t = "dark";
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
