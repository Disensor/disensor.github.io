document.addEventListener("DOMContentLoaded", () => {
  const includes = document.querySelectorAll('[data-include]');

  includes.forEach(el => {
    const file = el.getAttribute('data-include');
    fetch(file)
      .then(response => {
        if (!response.ok) throw new Error("Fichier introuvable : " + file);
        return response.text();
      })
      .then(data => {
        el.innerHTML = data;

        // Si c’est le header, initialise le menu responsive
        if (file.includes("header")) {
          const script = document.createElement("script");
          script.textContent = `
            function toggleMenu() {
              document.querySelector('header nav').classList.toggle('show');
            }
          `;
          document.body.appendChild(script);
        }
      })
      .catch(err => {
        el.innerHTML = '<p style="color:red">Erreur de chargement : ' + err.message + '</p>';
        console.error(err);
      });
  });
});
