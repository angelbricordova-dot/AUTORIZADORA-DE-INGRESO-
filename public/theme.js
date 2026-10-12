// Aplica el tema (claro u oscuro) antes de pintar la página, para que no parpadee.
(function () {
  var t = null;
  try {
    t = localStorage.getItem('tudia-tema');
  } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
