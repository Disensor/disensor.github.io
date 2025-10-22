(() => {
  const repoOwner = 'Disensor';
  const repoName = 'disensor.github.io';
  const apiRoot = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/`;

  let githubToken = '';

  const state = {
    products: { data: [], sha: null, editIndex: null },
    projects: { data: [], sha: null, editIndex: null },
    freebies: { data: [], sha: null, editIndex: null },
    services: { data: [], sha: null, editIndex: null },
    testimonials: { data: [], sha: null, editIndex: null },
    settings: {
      data: {
        featuredProject: '',
        testimonialRotation: true,
        testimonialInterval: 8000
      },
      sha: null
    }
  };

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const elements = {
    authForm: document.getElementById('authForm'),
    authStatus: document.getElementById('authStatus'),
    authPanel: document.getElementById('authPanel'),
    adminContent: document.getElementById('adminContent'),

    productForm: document.getElementById('productForm'),
    productStatus: document.getElementById('productStatus'),
    productList: document.getElementById('productList'),
    productCancel: document.getElementById('productCancel'),

    projectForm: document.getElementById('projectForm'),
    projectStatus: document.getElementById('projectStatus'),
    projectList: document.getElementById('projectList'),
    projectCancel: document.getElementById('projectCancel'),

    freebieForm: document.getElementById('freebieForm'),
    freebieStatus: document.getElementById('freebieStatus'),
    freebieList: document.getElementById('freebieList'),
    freebieCancel: document.getElementById('freebieCancel'),

    serviceForm: document.getElementById('serviceForm'),
    serviceStatus: document.getElementById('serviceStatus'),
    serviceList: document.getElementById('serviceList'),
    serviceCancel: document.getElementById('serviceCancel'),

    testimonialForm: document.getElementById('testimonialForm'),
    testimonialStatus: document.getElementById('testimonialStatus'),
    testimonialList: document.getElementById('testimonialList'),
    testimonialCancel: document.getElementById('testimonialCancel'),

    settingsForm: document.getElementById('settingsForm'),
    settingsStatus: document.getElementById('settingsStatus'),
    settingsCancel: document.getElementById('settingsCancel'),
    featuredSelect: document.getElementById('featuredProject'),
    testimonialRotation: document.getElementById('testimonialRotation'),
    testimonialInterval: document.getElementById('testimonialInterval')
  };

  function toBase64(text) {
    const bytes = textEncoder.encode(text);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function fromBase64(base64) {
    const clean = base64.replace(/\n/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return textDecoder.decode(bytes);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Lecture du fichier impossible.'));
          return;
        }
        const [, base64] = reader.result.split(',');
        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error('Impossible de lire le fichier fourni.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function setStatus(element, message, type = '') {
    if (!element) return;
    element.textContent = message || '';
    element.classList.remove('show', 'error', 'success');
    if (message) {
      element.classList.add('show');
      if (type) element.classList.add(type);
    }
  }

  function clearStatus(element) {
    setStatus(element, '');
  }

  function toggleFormDisabled(form, disabled) {
    if (!form) return;
    const controls = form.querySelectorAll('input, textarea, select, button');
    controls.forEach((control) => {
      control.disabled = disabled;
    });
    form.setAttribute('aria-busy', disabled ? 'true' : 'false');
  }

  async function fetchFile(path) {
    const response = await fetch(apiRoot + path, {
      headers: { Authorization: `Bearer ${githubToken}` }
    });
    if (!response.ok) {
      throw new Error(`Erreur lors du chargement de ${path}`);
    }
    const payload = await response.json();
    return {
      data: JSON.parse(fromBase64(payload.content)),
      sha: payload.sha
    };
  }

  async function updateFile(path, content, sha, message) {
    const json = JSON.stringify(content, null, 2);
    const body = {
      message,
      content: toBase64(json)
    };
    if (sha) {
      body.sha = sha;
    }
    const response = await fetch(apiRoot + path, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Impossible de mettre à jour ${path}`);
    }
    return response.json();
  }

  async function uploadBinaryFile(path, base64, message) {
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json'
    };
    let sha = null;
    try {
      const existing = await fetch(apiRoot + path, { headers });
      if (existing.ok) {
        const json = await existing.json();
        sha = json.sha;
      } else if (existing.status !== 404) {
        const error = await existing.json().catch(() => ({}));
        throw new Error(error.message || `Impossible de vérifier ${path}`);
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(`Impossible de vérifier ${path}`);
    }

    const response = await fetch(apiRoot + path, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message,
        content: base64,
        ...(sha ? { sha } : {})
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Impossible de téléverser ${path}`);
    }
    return response.json();
  }

  function renderProductList() {
    if (!elements.productList) return;
    elements.productList.innerHTML = '';
    if (!state.products.data.length) {
      elements.productList.textContent = 'Aucun produit enregistré.';
      return;
    }

    state.products.data.forEach((product, index) => {
      const card = document.createElement('article');
      card.className = 'admin-card';

      const title = document.createElement('strong');
      title.textContent = product.name || 'Produit sans nom';
      card.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${product.ref || '—'} · ${product.type || 'Type inconnu'} · ${product.price || 'Sur devis'}`;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button-tertiary';
      editButton.textContent = '✏️ Modifier';
      editButton.addEventListener('click', () => editProduct(index));
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button-tertiary';
      deleteButton.textContent = '🗑️ Supprimer';
      deleteButton.addEventListener('click', () => deleteProduct(index));
      actions.appendChild(deleteButton);

      card.appendChild(actions);
      elements.productList.appendChild(card);
    });
  }

  function renderProjectList() {
    if (!elements.projectList) return;
    elements.projectList.innerHTML = '';
    if (!state.projects.data.length) {
      elements.projectList.textContent = 'Aucun projet enregistré.';
      return;
    }

    state.projects.data.forEach((project, index) => {
      const card = document.createElement('article');
      card.className = 'admin-card';

      const title = document.createElement('strong');
      title.textContent = project.title || 'Projet sans titre';
      card.appendChild(title);

      if (state.settings.data.featuredProject === project.id) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '⭐ À la une';
        card.appendChild(badge);
      }

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${project.id || '—'} · ${project.summary || '—'}`;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button-tertiary';
      editButton.textContent = '✏️ Modifier';
      editButton.addEventListener('click', () => editProject(index));
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button-tertiary';
      deleteButton.textContent = '🗑️ Supprimer';
      deleteButton.addEventListener('click', () => deleteProject(index));
      actions.appendChild(deleteButton);

      card.appendChild(actions);
      elements.projectList.appendChild(card);
    });
  }

  function renderFreebieList() {
    if (!elements.freebieList) return;
    elements.freebieList.innerHTML = '';
    if (!state.freebies.data.length) {
      elements.freebieList.textContent = 'Aucune ressource disponible.';
      return;
    }

    state.freebies.data.forEach((freebie, index) => {
      const card = document.createElement('article');
      card.className = 'admin-card';
      const title = document.createElement('strong');
      title.textContent = freebie.title || 'Ressource sans titre';
      card.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${freebie.slug || '—'} · ${freebie.format || 'Format inconnu'}`;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button-tertiary';
      editButton.textContent = '✏️ Modifier';
      editButton.addEventListener('click', () => editFreebie(index));
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button-tertiary';
      deleteButton.textContent = '🗑️ Supprimer';
      deleteButton.addEventListener('click', () => deleteFreebie(index));
      actions.appendChild(deleteButton);

      card.appendChild(actions);
      elements.freebieList.appendChild(card);
    });
  }

  function renderServiceList() {
    if (!elements.serviceList) return;
    elements.serviceList.innerHTML = '';
    if (!state.services.data.length) {
      elements.serviceList.textContent = 'Aucun service enregistré.';
      return;
    }

    state.services.data.forEach((service, index) => {
      const card = document.createElement('article');
      card.className = 'admin-card';

      const title = document.createElement('strong');
      title.textContent = service.title || 'Service sans titre';
      card.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${service.slug || '—'} · ${service.price || 'Tarif sur devis'}`;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button-tertiary';
      editButton.textContent = '✏️ Modifier';
      editButton.addEventListener('click', () => editService(index));
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button-tertiary';
      deleteButton.textContent = '🗑️ Supprimer';
      deleteButton.addEventListener('click', () => deleteService(index));
      actions.appendChild(deleteButton);

      card.appendChild(actions);
      elements.serviceList.appendChild(card);
    });
  }

  function renderTestimonialList() {
    if (!elements.testimonialList) return;
    elements.testimonialList.innerHTML = '';
    if (!state.testimonials.data.length) {
      elements.testimonialList.textContent = 'Aucun témoignage enregistré.';
      return;
    }

    state.testimonials.data.forEach((testimonial, index) => {
      const card = document.createElement('article');
      card.className = 'admin-card';

      const quote = document.createElement('p');
      quote.className = 'meta';
      quote.textContent = `« ${testimonial.quote?.slice(0, 120) || 'Témoignage'}${testimonial.quote && testimonial.quote.length > 120 ? '…' : ''} »`;
      card.appendChild(quote);

      const author = document.createElement('strong');
      author.textContent = `${testimonial.author || 'Anonyme'}${testimonial.role ? ` · ${testimonial.role}` : ''}`;
      card.appendChild(author);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button-tertiary';
      editButton.textContent = '✏️ Modifier';
      editButton.addEventListener('click', () => editTestimonial(index));
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button-tertiary';
      deleteButton.textContent = '🗑️ Supprimer';
      deleteButton.addEventListener('click', () => deleteTestimonial(index));
      actions.appendChild(deleteButton);

      card.appendChild(actions);
      elements.testimonialList.appendChild(card);
    });
  }

  async function loadProducts() {
    if (!elements.productList) return;
    elements.productList.textContent = 'Chargement…';
    try {
      const file = await fetchFile('data/products.json');
      state.products.data = Array.isArray(file.data) ? file.data : [];
      state.products.sha = file.sha;
      renderProductList();
    } catch (error) {
      console.error(error);
      elements.productList.textContent = '❌ Erreur lors du chargement des produits.';
    }
  }

  async function loadProjects() {
    if (!elements.projectList) return;
    elements.projectList.textContent = 'Chargement…';
    try {
      const file = await fetchFile('data/projects.json');
      state.projects.data = Array.isArray(file.data) ? file.data : [];
      state.projects.sha = file.sha;
      renderProjectList();
      updateFeaturedOptions();
    } catch (error) {
      console.error(error);
      elements.projectList.textContent = '❌ Erreur lors du chargement des projets.';
    }
  }

  async function loadFreebies() {
    if (!elements.freebieList) return;
    elements.freebieList.textContent = 'Chargement…';
    try {
      const file = await fetchFile('data/freebies.json');
      state.freebies.data = Array.isArray(file.data) ? file.data : [];
      state.freebies.sha = file.sha;
      renderFreebieList();
    } catch (error) {
      console.error(error);
      elements.freebieList.textContent = '❌ Erreur lors du chargement des ressources.';
    }
  }

  async function loadServices() {
    if (!elements.serviceList) return;
    elements.serviceList.textContent = 'Chargement…';
    try {
      const file = await fetchFile('data/services.json');
      state.services.data = Array.isArray(file.data) ? file.data : [];
      state.services.sha = file.sha;
      renderServiceList();
    } catch (error) {
      console.error(error);
      elements.serviceList.textContent = '❌ Erreur lors du chargement des services.';
    }
  }

  async function loadTestimonials() {
    if (!elements.testimonialList) return;
    elements.testimonialList.textContent = 'Chargement…';
    try {
      const file = await fetchFile('data/testimonials.json');
      state.testimonials.data = Array.isArray(file.data) ? file.data : [];
      state.testimonials.sha = file.sha;
      renderTestimonialList();
    } catch (error) {
      console.error(error);
      elements.testimonialList.textContent = '❌ Erreur lors du chargement des témoignages.';
    }
  }

  async function loadSettings() {
    if (!elements.settingsForm) return;
    try {
      const file = await fetchFile('data/settings.json');
      const defaults = state.settings.data;
      state.settings.data = { ...defaults, ...(file.data || {}) };
      state.settings.sha = file.sha;
    } catch (error) {
      console.warn('Impossible de charger les options, utilisation des valeurs par défaut.', error);
      state.settings.data = { ...state.settings.data };
      state.settings.sha = null;
    }
    applySettingsForm();
    renderProjectList();
  }

  function resetProductForm() {
    if (!elements.productForm) return;
    elements.productForm.reset();
    state.products.editIndex = null;
    clearStatus(elements.productStatus);
  }

  function resetProjectForm() {
    if (!elements.projectForm) return;
    elements.projectForm.reset();
    state.projects.editIndex = null;
    clearStatus(elements.projectStatus);
  }

  function resetFreebieForm() {
    if (!elements.freebieForm) return;
    elements.freebieForm.reset();
    state.freebies.editIndex = null;
    clearStatus(elements.freebieStatus);
  }

  function resetServiceForm() {
    if (!elements.serviceForm) return;
    elements.serviceForm.reset();
    state.services.editIndex = null;
    clearStatus(elements.serviceStatus);
  }

  function resetTestimonialForm() {
    if (!elements.testimonialForm) return;
    elements.testimonialForm.reset();
    state.testimonials.editIndex = null;
    clearStatus(elements.testimonialStatus);
  }

  function applySettingsForm() {
    if (!elements.settingsForm) return;
    const data = state.settings.data || {};
    if (elements.featuredSelect) {
      elements.featuredSelect.value = data.featuredProject || '';
    }
    if (elements.testimonialRotation) {
      elements.testimonialRotation.checked = data.testimonialRotation !== false;
    }
    if (elements.testimonialInterval) {
      elements.testimonialInterval.value = data.testimonialInterval || 8000;
    }
    clearStatus(elements.settingsStatus);
  }

  function updateFeaturedOptions() {
    if (!elements.featuredSelect) return;
    const current = state.settings.data?.featuredProject || '';
    const select = elements.featuredSelect;
    const previous = select.value;
    select.innerHTML = '<option value="">— Choisir un projet —</option>';
    state.projects.data.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id || '';
      option.textContent = project.title || project.id || 'Projet';
      select.appendChild(option);
    });
    select.value = current || previous || '';
  }

  function editProduct(index) {
    const product = state.products.data[index];
    if (!product) return;
    state.products.editIndex = index;
    elements.productForm.productRef.value = product.ref || '';
    elements.productForm.productName.value = product.name || '';
    elements.productForm.productType.value = product.type || 'STL';
    elements.productForm.productPrice.value = product.price || '';
    elements.productForm.productDescription.value = product.description || '';
    elements.productForm.productImage.value = '';
    elements.productForm.productImagePath.value = product.image || '';
    elements.productForm.productLink.value = product.link || '';
    setStatus(elements.productStatus, '✏️ Produit chargé pour édition. Enregistre pour appliquer les modifications.');
  }

  function editProject(index) {
    const project = state.projects.data[index];
    if (!project) return;
    state.projects.editIndex = index;
    elements.projectForm.projectId.value = project.id || '';
    elements.projectForm.projectTitle.value = project.title || '';
    elements.projectForm.projectSummary.value = project.summary || '';
    elements.projectForm.projectThumbnail.value = project.thumbnail || '';
    elements.projectForm.projectDescription.value = project.description || '';
    elements.projectForm.projectHighlights.value = (project.highlights || []).join('\n');
    elements.projectForm.projectServices.value = (project.services || []).join(', ');
    elements.projectForm.projectGallery.value = (project.gallery || []).join(', ');
    elements.projectForm.projectCta.value = project.cta || '';
    elements.projectForm.projectCtaLink.value = project.ctaLink || '';
    setStatus(elements.projectStatus, '✏️ Projet chargé pour édition.');
  }

  function editFreebie(index) {
    const freebie = state.freebies.data[index];
    if (!freebie) return;
    state.freebies.editIndex = index;
    elements.freebieForm.freebieSlug.value = freebie.slug || '';
    elements.freebieForm.freebieTitle.value = freebie.title || '';
    elements.freebieForm.freebieFormat.value = freebie.format || 'STL';
    elements.freebieForm.freebieDescription.value = freebie.description || '';
    elements.freebieForm.freebiePreview.value = '';
    elements.freebieForm.freebiePreviewPath.value = freebie.preview || '';
    elements.freebieForm.freebieFile.value = '';
    elements.freebieForm.freebieFilePath.value = freebie.download || '';
    setStatus(elements.freebieStatus, '✏️ Ressource chargée pour édition.');
  }

  function editService(index) {
    const service = state.services.data[index];
    if (!service) return;
    state.services.editIndex = index;
    elements.serviceForm.serviceSlug.value = service.slug || '';
    elements.serviceForm.serviceTitle.value = service.title || '';
    elements.serviceForm.serviceIcon.value = service.icon || '';
    elements.serviceForm.serviceTagline.value = service.tagline || '';
    elements.serviceForm.serviceSummary.value = service.summary || '';
    elements.serviceForm.serviceDetails.value = service.details || '';
    elements.serviceForm.servicePrice.value = service.price || '';
    elements.serviceForm.serviceTurnaround.value = service.turnaround || '';
    elements.serviceForm.serviceDeliverables.value = (service.deliverables || []).join('\n');
    elements.serviceForm.serviceTools.value = (service.tools || []).join('\n');
    elements.serviceForm.serviceImage.value = '';
    elements.serviceForm.serviceImagePath.value = service.image || '';
    elements.serviceForm.serviceCta.value = service.cta || '';
    elements.serviceForm.serviceCtaLink.value = service.ctaLink || '';
    setStatus(elements.serviceStatus, '✏️ Service chargé pour édition.');
  }

  function editTestimonial(index) {
    const testimonial = state.testimonials.data[index];
    if (!testimonial) return;
    state.testimonials.editIndex = index;
    elements.testimonialForm.testimonialQuote.value = testimonial.quote || '';
    elements.testimonialForm.testimonialAuthor.value = testimonial.author || '';
    elements.testimonialForm.testimonialRole.value = testimonial.role || '';
    setStatus(elements.testimonialStatus, '✏️ Témoignage chargé pour édition.');
  }

  async function deleteProduct(index) {
    if (!Number.isInteger(index)) return;
    if (!confirm('Supprimer ce produit ?')) return;
    const updated = [...state.products.data];
    updated.splice(index, 1);
    try {
      const response = await updateFile(
        'data/products.json',
        updated,
        state.products.sha,
        'Suppression produit depuis admin'
      );
      state.products.data = updated;
      state.products.sha = response.content.sha;
      resetProductForm();
      renderProductList();
      setStatus(elements.productStatus, '✅ Produit supprimé.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.productStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    }
  }

  async function deleteProject(index) {
    if (!Number.isInteger(index)) return;
    if (!confirm('Supprimer ce projet ?')) return;
    const updated = [...state.projects.data];
    const [removed] = updated.splice(index, 1);
    try {
      const response = await updateFile(
        'data/projects.json',
        updated,
        state.projects.sha,
        'Suppression projet depuis admin'
      );
      state.projects.data = updated;
      state.projects.sha = response.content.sha;
      resetProjectForm();
      renderProjectList();
      updateFeaturedOptions();
      if (removed && removed.id && state.settings.data.featuredProject === removed.id) {
        state.settings.data.featuredProject = '';
        applySettingsForm();
        setStatus(elements.settingsStatus, 'ℹ️ Projet à la une supprimé, pense à en choisir un autre.', 'error');
      }
      setStatus(elements.projectStatus, '✅ Projet supprimé.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.projectStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    }
  }

  async function deleteFreebie(index) {
    if (!Number.isInteger(index)) return;
    if (!confirm('Supprimer cette ressource gratuite ?')) return;
    const updated = [...state.freebies.data];
    updated.splice(index, 1);
    try {
      const response = await updateFile(
        'data/freebies.json',
        updated,
        state.freebies.sha,
        'Suppression freebie depuis admin'
      );
      state.freebies.data = updated;
      state.freebies.sha = response.content.sha;
      resetFreebieForm();
      renderFreebieList();
      setStatus(elements.freebieStatus, '✅ Ressource supprimée.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.freebieStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    }
  }

  async function deleteService(index) {
    if (!Number.isInteger(index)) return;
    if (!confirm('Supprimer ce service ?')) return;
    const updated = [...state.services.data];
    updated.splice(index, 1);
    try {
      const response = await updateFile(
        'data/services.json',
        updated,
        state.services.sha,
        'Suppression service depuis admin'
      );
      state.services.data = updated;
      state.services.sha = response.content.sha;
      resetServiceForm();
      renderServiceList();
      setStatus(elements.serviceStatus, '✅ Service supprimé.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.serviceStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    }
  }

  async function deleteTestimonial(index) {
    if (!Number.isInteger(index)) return;
    if (!confirm('Supprimer ce témoignage ?')) return;
    const updated = [...state.testimonials.data];
    updated.splice(index, 1);
    try {
      const response = await updateFile(
        'data/testimonials.json',
        updated,
        state.testimonials.sha,
        'Suppression témoignage depuis admin'
      );
      state.testimonials.data = updated;
      state.testimonials.sha = response.content.sha;
      resetTestimonialForm();
      renderTestimonialList();
      setStatus(elements.testimonialStatus, '✅ Témoignage supprimé.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.testimonialStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (!elements.productForm) return;

    const fileInput = elements.productForm.productImage;
    const customPath = elements.productForm.productImagePath.value.trim();
    const file = fileInput.files[0];
    const fallbackPath = 'images/products/doc.jpg';
    const imagePath = customPath || (file ? `images/products/${file.name}` : fallbackPath);

    const product = {
      ref: elements.productForm.productRef.value.trim(),
      name: elements.productForm.productName.value.trim(),
      type: elements.productForm.productType.value,
      price: elements.productForm.productPrice.value.trim(),
      description: elements.productForm.productDescription.value.trim(),
      image: imagePath,
      link: elements.productForm.productLink.value.trim()
    };

    if (!product.ref || !product.name || !product.description) {
      setStatus(elements.productStatus, '❌ Référence, nom et description sont obligatoires.', 'error');
      return;
    }

    const updated = [...state.products.data];
    if (state.products.editIndex !== null && state.products.editIndex >= 0) {
      updated[state.products.editIndex] = product;
    } else {
      updated.push(product);
    }

    toggleFormDisabled(elements.productForm, true);
    setStatus(elements.productStatus, 'Traitement en cours…');

    const finalize = async (data) => {
      try {
        const response = await updateFile(
          'data/products.json',
          data,
          state.products.sha,
          'Mise à jour produits depuis admin'
        );
        state.products.data = data;
        state.products.sha = response.content.sha;
        renderProductList();
        resetProductForm();
        elements.productForm.productImagePath.value = '';
        setStatus(elements.productStatus, '✅ Produit enregistré avec succès.', 'success');
      } catch (error) {
        console.error(error);
        setStatus(elements.productStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
      } finally {
        toggleFormDisabled(elements.productForm, false);
      }
    };

    if (file) {
      try {
        const base64 = await readFileAsBase64(file);
        await uploadBinaryFile(
          imagePath,
          base64,
          `Mise à jour image ${file.name}`
        );
        await finalize(updated);
      } catch (error) {
        console.error(error);
        toggleFormDisabled(elements.productForm, false);
        setStatus(elements.productStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
      }
    } else {
      await finalize(updated);
    }
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();
    if (!elements.projectForm) return;

    const project = {
      id: elements.projectForm.projectId.value.trim(),
      title: elements.projectForm.projectTitle.value.trim(),
      summary: elements.projectForm.projectSummary.value.trim(),
      thumbnail: elements.projectForm.projectThumbnail.value.trim(),
      description: elements.projectForm.projectDescription.value.trim(),
      highlights: elements.projectForm.projectHighlights.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      services: elements.projectForm.projectServices.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      gallery: elements.projectForm.projectGallery.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      cta: elements.projectForm.projectCta.value.trim(),
      ctaLink: elements.projectForm.projectCtaLink.value.trim()
    };

    if (!project.id || !project.title || !project.description) {
      setStatus(elements.projectStatus, '❌ Identifiant, titre et description sont obligatoires.', 'error');
      return;
    }

    const updated = [...state.projects.data];
    if (state.projects.editIndex !== null && state.projects.editIndex >= 0) {
      updated[state.projects.editIndex] = project;
    } else {
      updated.push(project);
    }

    toggleFormDisabled(elements.projectForm, true);
    setStatus(elements.projectStatus, 'Traitement en cours…');

    try {
      const response = await updateFile(
        'data/projects.json',
        updated,
        state.projects.sha,
        'Mise à jour projets depuis admin'
      );
      state.projects.data = updated;
      state.projects.sha = response.content.sha;
      renderProjectList();
      updateFeaturedOptions();
      resetProjectForm();
      setStatus(elements.projectStatus, '✅ Projet enregistré avec succès.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.projectStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.projectForm, false);
    }
  }

  async function handleFreebieSubmit(event) {
    event.preventDefault();
    if (!elements.freebieForm) return;

    const previewFile = elements.freebieForm.freebiePreview.files[0];
    const file = elements.freebieForm.freebieFile.files[0];
    const previewPath = elements.freebieForm.freebiePreviewPath.value.trim() || (previewFile ? `images/freebies/${previewFile.name}` : 'images/doc.jpg');
    const downloadPath = elements.freebieForm.freebieFilePath.value.trim() || (file ? `files/freebies/${file.name}` : '');

    const freebie = {
      slug: elements.freebieForm.freebieSlug.value.trim(),
      title: elements.freebieForm.freebieTitle.value.trim(),
      description: elements.freebieForm.freebieDescription.value.trim(),
      format: elements.freebieForm.freebieFormat.value,
      preview: previewPath,
      download: downloadPath
    };

    if (!freebie.slug || !freebie.title || !freebie.description || !freebie.download) {
      setStatus(elements.freebieStatus, '❌ Slug, titre, description et fichier de téléchargement sont obligatoires.', 'error');
      return;
    }

    const updated = [...state.freebies.data];
    if (state.freebies.editIndex !== null && state.freebies.editIndex >= 0) {
      updated[state.freebies.editIndex] = freebie;
    } else {
      updated.push(freebie);
    }

    toggleFormDisabled(elements.freebieForm, true);
    setStatus(elements.freebieStatus, 'Téléversement en cours…');

    const uploads = [];
    if (previewFile && previewPath) {
      uploads.push(
        readFileAsBase64(previewFile).then((base64) => uploadBinaryFile(
          previewPath,
          base64,
          `Mise à jour vignette ${previewFile.name}`
        ))
      );
    }
    if (file && downloadPath) {
      uploads.push(
        readFileAsBase64(file).then((base64) => uploadBinaryFile(
          downloadPath,
          base64,
          `Mise à jour fichier ${file.name}`
        ))
      );
    }

    try {
      await Promise.all(uploads);
      const response = await updateFile(
        'data/freebies.json',
        updated,
        state.freebies.sha,
        'Mise à jour freebies depuis admin'
      );
      state.freebies.data = updated;
      state.freebies.sha = response.content.sha;
      renderFreebieList();
      resetFreebieForm();
      setStatus(elements.freebieStatus, '✅ Ressource enregistrée avec succès.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.freebieStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.freebieForm, false);
    }
  }

  async function handleServiceSubmit(event) {
    event.preventDefault();
    if (!elements.serviceForm) return;

    const imageFile = elements.serviceForm.serviceImage.files[0];
    const imagePath = elements.serviceForm.serviceImagePath.value.trim() || (imageFile ? `images/services/${imageFile.name}` : '');

    const service = {
      slug: elements.serviceForm.serviceSlug.value.trim(),
      title: elements.serviceForm.serviceTitle.value.trim(),
      icon: elements.serviceForm.serviceIcon.value.trim(),
      tagline: elements.serviceForm.serviceTagline.value.trim(),
      summary: elements.serviceForm.serviceSummary.value.trim(),
      details: elements.serviceForm.serviceDetails.value.trim(),
      price: elements.serviceForm.servicePrice.value.trim(),
      turnaround: elements.serviceForm.serviceTurnaround.value.trim(),
      deliverables: elements.serviceForm.serviceDeliverables.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      tools: elements.serviceForm.serviceTools.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      image: imagePath,
      cta: elements.serviceForm.serviceCta.value.trim(),
      ctaLink: elements.serviceForm.serviceCtaLink.value.trim()
    };

    if (!service.slug || !service.title || !service.summary || !service.details) {
      setStatus(elements.serviceStatus, '❌ Slug, titre, résumé et détails sont obligatoires.', 'error');
      return;
    }

    const updated = [...state.services.data];
    if (state.services.editIndex !== null && state.services.editIndex >= 0) {
      updated[state.services.editIndex] = service;
    } else {
      updated.push(service);
    }

    toggleFormDisabled(elements.serviceForm, true);
    setStatus(elements.serviceStatus, 'Traitement en cours…');

    const uploads = [];
    if (imageFile && imagePath) {
      uploads.push(
        readFileAsBase64(imageFile).then((base64) => uploadBinaryFile(
          imagePath,
          base64,
          `Mise à jour image service ${imageFile.name}`
        ))
      );
    }

    try {
      await Promise.all(uploads);
      const response = await updateFile(
        'data/services.json',
        updated,
        state.services.sha,
        'Mise à jour services depuis admin'
      );
      state.services.data = updated;
      state.services.sha = response.content.sha;
      renderServiceList();
      resetServiceForm();
      setStatus(elements.serviceStatus, '✅ Service enregistré avec succès.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.serviceStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.serviceForm, false);
    }
  }

  async function handleTestimonialSubmit(event) {
    event.preventDefault();
    if (!elements.testimonialForm) return;

    const testimonial = {
      quote: elements.testimonialForm.testimonialQuote.value.trim(),
      author: elements.testimonialForm.testimonialAuthor.value.trim(),
      role: elements.testimonialForm.testimonialRole.value.trim()
    };

    if (!testimonial.quote || !testimonial.author) {
      setStatus(elements.testimonialStatus, '❌ Citation et auteur sont obligatoires.', 'error');
      return;
    }

    const updated = [...state.testimonials.data];
    if (state.testimonials.editIndex !== null && state.testimonials.editIndex >= 0) {
      updated[state.testimonials.editIndex] = testimonial;
    } else {
      updated.push(testimonial);
    }

    toggleFormDisabled(elements.testimonialForm, true);
    setStatus(elements.testimonialStatus, 'Traitement en cours…');

    try {
      const response = await updateFile(
        'data/testimonials.json',
        updated,
        state.testimonials.sha,
        'Mise à jour témoignages depuis admin'
      );
      state.testimonials.data = updated;
      state.testimonials.sha = response.content.sha;
      renderTestimonialList();
      resetTestimonialForm();
      setStatus(elements.testimonialStatus, '✅ Témoignage enregistré avec succès.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.testimonialStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.testimonialForm, false);
    }
  }

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    if (!elements.settingsForm) return;

    const data = {
      featuredProject: elements.featuredSelect?.value?.trim() || '',
      testimonialRotation: elements.testimonialRotation ? elements.testimonialRotation.checked : true,
      testimonialInterval: elements.testimonialInterval ? Number(elements.testimonialInterval.value) || 8000 : 8000
    };

    if (data.testimonialInterval < 3000) {
      setStatus(elements.settingsStatus, '❌ L’intervalle doit être supérieur à 3000 ms.', 'error');
      return;
    }

    toggleFormDisabled(elements.settingsForm, true);
    setStatus(elements.settingsStatus, 'Sauvegarde en cours…');

    try {
      const response = await updateFile(
        'data/settings.json',
        data,
        state.settings.sha,
        'Mise à jour options interface depuis admin'
      );
      state.settings.data = data;
      state.settings.sha = response.content.sha;
      renderProjectList();
      setStatus(elements.settingsStatus, '✅ Options mises à jour.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.settingsStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.settingsForm, false);
    }
  }

  async function authenticate(event) {
    event.preventDefault();
    const tokenField = elements.authForm?.token;
    if (!tokenField) return;
    const token = tokenField.value.trim();
    if (!token) {
      setStatus(elements.authStatus, 'Merci de renseigner un token.', 'error');
      return;
    }

    setStatus(elements.authStatus, 'Vérification du token…');
    toggleFormDisabled(elements.authForm, true);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Token invalide ou sans droits suffisants.');
      }
      githubToken = token;
      setStatus(elements.authStatus, '✅ Connexion réussie.', 'success');
      toggleFormDisabled(elements.authForm, false);
      elements.authForm?.reset();
      elements.authPanel?.classList.add('hidden');
      elements.adminContent?.classList.remove('hidden');
      elements.adminContent?.setAttribute('aria-hidden', 'false');

      await Promise.all([loadProducts(), loadProjects()]);
      await Promise.all([loadFreebies(), loadServices(), loadTestimonials()]);
      await loadSettings();
    } catch (error) {
      console.error(error);
      setStatus(elements.authStatus, `❌ ${error instanceof Error ? error.message : 'Impossible de vérifier le token.'}`, 'error');
      toggleFormDisabled(elements.authForm, false);
    }
  }

  function init() {
    if (elements.authForm) {
      elements.authForm.addEventListener('submit', authenticate);
    }
    if (elements.productForm) {
      elements.productForm.addEventListener('submit', handleProductSubmit);
    }
    if (elements.productCancel) {
      elements.productCancel.addEventListener('click', () => {
        resetProductForm();
      });
    }
    if (elements.projectForm) {
      elements.projectForm.addEventListener('submit', handleProjectSubmit);
    }
    if (elements.projectCancel) {
      elements.projectCancel.addEventListener('click', () => {
        resetProjectForm();
      });
    }
    if (elements.freebieForm) {
      elements.freebieForm.addEventListener('submit', handleFreebieSubmit);
    }
    if (elements.freebieCancel) {
      elements.freebieCancel.addEventListener('click', () => {
        resetFreebieForm();
      });
    }
    if (elements.serviceForm) {
      elements.serviceForm.addEventListener('submit', handleServiceSubmit);
    }
    if (elements.serviceCancel) {
      elements.serviceCancel.addEventListener('click', () => {
        resetServiceForm();
      });
    }
    if (elements.testimonialForm) {
      elements.testimonialForm.addEventListener('submit', handleTestimonialSubmit);
    }
    if (elements.testimonialCancel) {
      elements.testimonialCancel.addEventListener('click', () => {
        resetTestimonialForm();
      });
    }
    if (elements.settingsForm) {
      elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
    }
    if (elements.settingsCancel) {
      elements.settingsCancel.addEventListener('click', () => {
        applySettingsForm();
        setStatus(elements.settingsStatus, 'Réinitialisé aux dernières valeurs enregistrées.');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
