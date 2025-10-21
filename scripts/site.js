(() => {
  const cache = new Map();

  async function fetchJson(path) {
    if (cache.has(path)) {
      return cache.get(path);
    }
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Impossible de charger ${path}`);
    }
    const json = await response.json();
    cache.set(path, json);
    return json;
  }

  function parsePrice(value) {
    if (!value) return 0;
    const normalised = value.toString().replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
    const numeric = parseFloat(normalised.replace(/[^0-9.]/g, ''));
    return Number.isNaN(numeric) ? 0 : numeric;
  }

  function bindAjaxForm(form, { onSuccess } = {}) {
    if (!form) return;
    if (onSuccess) {
      form.__onSuccess = onSuccess;
    } else if (form.__onSuccess === undefined) {
      form.__onSuccess = null;
    }
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    const status = form.querySelector('.form-status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (status) {
        status.textContent = 'Envoi en cours…';
        status.classList.remove('error', 'success');
      }

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: form.method || 'POST',
          headers: { 'Accept': 'application/json' },
          body: formData
        });

        if (response.ok) {
          if (status) {
            status.textContent = '✅ Merci ! Nous revenons vers toi sous 24 h.';
            status.classList.add('success');
          }
          if (form.dataset.store) {
            try {
              const payload = {};
              formData.forEach((value, key) => {
                if (key === '_gotcha') return;
                payload[key] = value;
              });
              const storeKey = form.dataset.store;
              const existing = JSON.parse(localStorage.getItem(storeKey) || '[]');
              existing.push({ ...payload, createdAt: new Date().toISOString() });
              localStorage.setItem(storeKey, JSON.stringify(existing));
            } catch (err) {
              console.warn('Impossible d\'enregistrer localement', err);
            }
          }
          const preserved = new Map();
          form.querySelectorAll('[data-preserve]').forEach((input) => preserved.set(input.name, input.value));
          form.reset();
          preserved.forEach((value, key) => {
            const field = form.querySelector(`[name="${CSS.escape(key)}"]`);
            if (field) field.value = value;
          });
          if (typeof form.__onSuccess === 'function') {
            form.__onSuccess();
          }
        } else {
          const data = await response.json().catch(() => ({}));
          if (status) {
            status.textContent = data.error || '❌ Une erreur est survenue. Merci de réessayer.';
            status.classList.add('error');
          }
        }
      } catch (error) {
        console.error(error);
        if (status) {
          status.textContent = '❌ Impossible d’envoyer le formulaire pour le moment.';
          status.classList.add('error');
        }
      }
    });
  }

  async function initServices() {
    const containers = document.querySelectorAll('[data-services]');
    if (!containers.length) return;

    try {
      const services = await fetchJson('data/services.json');
      containers.forEach((container) => {
        const variant = container.dataset.services || 'full';
        const limit = Number.parseInt(container.dataset.limit || '', 10);
        const list = Number.isInteger(limit) && limit > 0 ? services.slice(0, limit) : services;
        container.innerHTML = '';
        list.forEach((service) => {
          const card = document.createElement('article');
          card.className = `card service-card ${variant === 'preview' ? 'service-card--compact' : ''}`;
          card.innerHTML = `
            <h3>${service.title}</h3>
            <p>${variant === 'preview' ? service.excerpt : service.details}</p>
            <p class="service-price">${service.price}</p>
            <a class="button-secondary" href="${service.ctaLink}">${service.cta}</a>
          `;
          container.appendChild(card);
        });
        container.setAttribute('aria-busy', 'false');
      });
    } catch (error) {
      containers.forEach((container) => {
        container.innerHTML = '<p class="error">Impossible de charger les services pour le moment.</p>';
        container.setAttribute('aria-busy', 'false');
      });
      console.error(error);
    }
  }

  async function initProjects() {
    const grid = document.getElementById('projectsGrid');
    const homeGrid = document.getElementById('homeProjects');
    if (!grid && !homeGrid) return;

    try {
      const projects = await fetchJson('data/projects.json');

      if (homeGrid) {
        homeGrid.innerHTML = '';
        projects.slice(0, 3).forEach((project) => {
          const card = document.createElement('article');
          card.className = 'project-card';
          card.innerHTML = `
            <img src="${project.thumbnail}" alt="${project.title}" loading="lazy" onerror="this.src='images/doc.jpg'">
            <div class="card-body">
              <h3>${project.title}</h3>
              <p>${project.summary}</p>
              <span class="link-inline">Voir le projet</span>
            </div>
          `;
          card.addEventListener('click', () => {
            window.location.href = `projects.html?project=${encodeURIComponent(project.id)}`;
          });
          homeGrid.appendChild(card);
        });
        homeGrid.setAttribute('aria-busy', 'false');
      }

      if (grid) {
        grid.innerHTML = '';
        projects.forEach((project) => {
          const card = document.createElement('article');
          card.className = 'project-card';
          card.innerHTML = `
            <img src="${project.thumbnail}" alt="${project.title}" loading="lazy" onerror="this.src='images/doc.jpg'">
            <div class="card-body">
              <h3>${project.title}</h3>
              <p>${project.summary}</p>
              <button class="button-secondary" type="button">Voir le projet</button>
            </div>
          `;
          card.querySelector('button').addEventListener('click', () => openProjectModal(project));
          grid.appendChild(card);
        });
        grid.setAttribute('aria-busy', 'false');

        const params = new URLSearchParams(window.location.search);
        const requested = params.get('project');
        if (requested) {
          const project = projects.find((item) => item.id === requested);
          if (project) {
            openProjectModal(project);
          }
        }
      }
    } catch (error) {
      if (grid) {
        grid.innerHTML = '<p class="error">Impossible de charger les projets.</p>';
        grid.setAttribute('aria-busy', 'false');
      }
      if (homeGrid) {
        homeGrid.innerHTML = '<p class="error">Impossible d’afficher les projets.</p>';
        homeGrid.setAttribute('aria-busy', 'false');
      }
      console.error(error);
    }
  }

  function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    if (!modal) return;

    const gallery = modal.querySelector('#modalGallery');
    const title = modal.querySelector('#modalTitle');
    const summary = modal.querySelector('#modalSummary');
    const description = modal.querySelector('#modalDescription');
    const highlights = modal.querySelector('#modalHighlights');
    const services = modal.querySelector('#modalServices');
    const cta = modal.querySelector('#modalCta');

    title.textContent = project.title;
    summary.textContent = project.summary;
    description.textContent = project.description;

    gallery.innerHTML = '';
    (project.gallery || []).forEach((image, index) => {
      const img = document.createElement('img');
      img.src = image;
      img.alt = `${project.title} – visuel ${index + 1}`;
      img.loading = 'lazy';
      img.onerror = () => {
        img.src = 'images/doc.jpg';
      };
      gallery.appendChild(img);
    });
    if (!gallery.children.length) {
      const placeholder = document.createElement('img');
      placeholder.src = 'images/doc.jpg';
      placeholder.alt = project.title;
      gallery.appendChild(placeholder);
    }

    highlights.innerHTML = '';
    (project.highlights || []).forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      highlights.appendChild(li);
    });

    services.innerHTML = '';
    (project.services || []).forEach((service) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = service;
      services.appendChild(span);
    });

    if (cta) {
      cta.textContent = project.cta || 'Discuter de mon projet';
      cta.href = project.ctaLink || 'commandes.html';
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    const close = modal.querySelector('.close-button');
    const closeModal = (event) => {
      if (event.type === 'click' || event.key === 'Escape' || event.key === 'Esc') {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', closeModal);
      }
    };
    close.addEventListener('click', closeModal, { once: true });
    document.addEventListener('keydown', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(event);
      }
    }, { once: true });
  }

  async function initShop() {
    const productList = document.getElementById('productList');
    if (!productList) return;

    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const priceFilter = document.getElementById('priceFilter');
    const priceValue = document.getElementById('priceValue');
    const sortSelect = document.getElementById('sortSelect');

    try {
      const products = await fetchJson('data/products.json');
      const prices = products.map((product) => parsePrice(product.price));
      const maxPrice = Math.max(200, ...prices);
      priceFilter.max = Math.ceil(maxPrice / 10) * 10;
      priceFilter.value = priceFilter.max;
      priceValue.textContent = `${priceFilter.value} €`;

      function renderProducts(list) {
        productList.innerHTML = '';
        if (!list.length) {
          productList.innerHTML = '<p class="empty">Aucun produit ne correspond à ta recherche.</p>';
          return;
        }

        list.forEach((product) => {
          const card = document.createElement('article');
          card.className = 'product-card';
          const orderUrl = new URL('order.html', window.location.href);
          orderUrl.searchParams.set('ref', product.ref);
          orderUrl.searchParams.set('name', product.name);
          orderUrl.searchParams.set('price', product.price);
          orderUrl.searchParams.set('type', product.type);

          card.innerHTML = `
            <img src="${product.image || 'images/doc.jpg'}" alt="${product.name}" loading="lazy" onerror="this.src='images/doc.jpg'">
            <div class="card-body">
              <h3>${product.name}</h3>
              <p class="description">${product.description}</p>
              <p class="meta"><strong>Réf :</strong> ${product.ref} · <strong>Type :</strong> ${product.type}</p>
              <p class="price">${product.price || 'Sur devis'}</p>
              <div class="card-actions">
                <a class="cta-button" href="${orderUrl.toString()}">Commander ce fichier</a>
                ${product.link ? `<a class="button-tertiary" href="${product.link}">Contact direct</a>` : ''}
              </div>
            </div>
          `;
          productList.appendChild(card);
        });
      }

      function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedType = typeFilter.value;
        const max = parseFloat(priceFilter.value);
        const sort = sortSelect.value;

        let filtered = products.filter((product) => {
          const matchesSearch = [product.name, product.ref, product.description]
            .some((value) => value && value.toLowerCase().includes(searchTerm));
          const matchesType = selectedType === 'all' || product.type === selectedType;
          const price = parsePrice(product.price);
          const matchesPrice = Number.isNaN(max) ? true : price <= max || price === 0;
          return matchesSearch && matchesType && matchesPrice;
        });

        switch (sort) {
          case 'price-asc':
            filtered = filtered.slice().sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
            break;
          case 'price-desc':
            filtered = filtered.slice().sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
            break;
          case 'name':
            filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
            break;
          default:
            break;
        }

        renderProducts(filtered);
      }

      searchInput.addEventListener('input', applyFilters);
      typeFilter.addEventListener('change', applyFilters);
      priceFilter.addEventListener('input', () => {
        priceValue.textContent = `${priceFilter.value} €`;
        applyFilters();
      });
      sortSelect.addEventListener('change', applyFilters);

      renderProducts(products);
      productList.setAttribute('aria-busy', 'false');
    } catch (error) {
      productList.innerHTML = '<p class="error">Impossible de charger la boutique.</p>';
      productList.setAttribute('aria-busy', 'false');
      console.error(error);
    }
  }

  function initOrderForm() {
    const form = document.getElementById('orderForm');
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const data = {
      ref: params.get('ref') || '—',
      name: params.get('name') || 'Produit 3DPANNE',
      price: params.get('price') || 'Sur devis',
      type: params.get('type') || '—'
    };

    const refEl = document.getElementById('summaryRef');
    const nameEl = document.getElementById('summaryName');
    const priceEl = document.getElementById('summaryPrice');
    const typeEl = document.getElementById('summaryType');
    const hidden = document.getElementById('orderProduct');

    function populate() {
      refEl.textContent = data.ref;
      nameEl.textContent = data.name;
      priceEl.textContent = data.price;
      typeEl.textContent = data.type;
      hidden.value = `${data.ref} – ${data.name}`;
      hidden.dataset.preserve = 'true';
    }

    populate();
    bindAjaxForm(form, { onSuccess: populate });
  }

  function initCommandForm() {
    const form = document.getElementById('commandForm');
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type) {
      const select = form.querySelector('select[name="type"]');
      if (select) {
        Array.from(select.options).forEach((option) => {
          if (option.value.toLowerCase() === type.toLowerCase()) {
            option.selected = true;
          }
        });
      }
    }
    bindAjaxForm(form);
  }

  async function initFreebies() {
    const container = document.querySelector('[data-freebies]');
    if (!container) return;

    try {
      const freebies = await fetchJson('data/freebies.json');
      container.innerHTML = '';
      freebies.forEach((freebie) => {
        const card = document.createElement('article');
        card.className = 'freebie-card';
        card.innerHTML = `
          <img src="${freebie.preview || 'images/doc.jpg'}" alt="${freebie.title}" loading="lazy" onerror="this.src='images/doc.jpg'">
          <div class="card-body">
            <span class="tag tag--outline">${freebie.format}</span>
            <h3>${freebie.title}</h3>
            <p>${freebie.description}</p>
            <button class="button-secondary" type="button">Recevoir ce fichier</button>
          </div>
        `;
        card.querySelector('button').addEventListener('click', () => openFreebieModal(freebie));
        container.appendChild(card);
      });
      container.setAttribute('aria-busy', 'false');
    } catch (error) {
      container.innerHTML = '<p class="error">Impossible d’afficher les ressources gratuites.</p>';
      container.setAttribute('aria-busy', 'false');
      console.error(error);
    }
  }

  function openFreebieModal(freebie) {
    const modal = document.getElementById('freebieModal');
    if (!modal) return;
    const title = modal.querySelector('#freebieTitle');
    const desc = modal.querySelector('#freebieDescription');
    const preview = modal.querySelector('#freebiePreview');
    const slugInput = modal.querySelector('#freebieSlug');
    const form = modal.querySelector('form');

    title.textContent = freebie.title;
    desc.textContent = freebie.description;
    slugInput.value = freebie.slug;
    slugInput.dataset.preserve = 'true';
    preview.innerHTML = `<img src="${freebie.preview || 'images/doc.jpg'}" alt="${freebie.title}" loading="lazy" onerror="this.src='images/doc.jpg'">`;

    bindAjaxForm(form, {
      onSuccess: () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
    });

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    const close = modal.querySelector('.close-button');
    const closeModal = (event) => {
      if (event.type === 'click' || event.key === 'Escape' || event.key === 'Esc') {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', closeModal);
      }
    };
    close.addEventListener('click', closeModal, { once: true });
    document.addEventListener('keydown', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(event);
      }
    }, { once: true });
  }

  function initAjaxForms() {
    document.querySelectorAll('form[data-ajax-form]').forEach((form) => bindAjaxForm(form));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initServices();
    initProjects();
    initShop();
    initOrderForm();
    initCommandForm();
    initFreebies();
    initAjaxForms();
  });
})();
