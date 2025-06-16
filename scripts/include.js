document.addEventListener("DOMContentLoaded", function () {
  const includes = document.querySelectorAll('[data-include]');
  includes.forEach(el => {
    const file = el.getAttribute('data-include');
    fetch(file)
      .then(res => res.text())
      .then(data => {
        el.innerHTML = data;
        if (file.includes("header")) {
          const script = document.createElement("script");
          script.textContent = `
            function toggleMenu() {
              const nav = document.getElementById('mainNav');
              nav.classList.toggle('show');
            }
          `;
          document.body.appendChild(script);
        }
      })
      .catch(err => {
        el.innerHTML = "<p style='color:red'>Erreur de chargement : " + file + "</p>";
        console.error(err);
      });
  });
});
