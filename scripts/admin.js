(() => {
  const repoOwner = 'Disensor';
  const repoName = 'disensor.github.io';
  const apiRoot = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/`;

  let githubToken = '';

  const state = {
    products: { data: [], sha: null, editIndex: null },
    projects: { data: [], sha: null, editIndex: null }
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
    projectCancel: document.getElementById('projectCancel')
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
    } catch (error) {
      console.error(error);
      elements.projectList.textContent = '❌ Erreur lors du chargement des projets.';
    }
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
    updated.splice(index, 1);
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
      setStatus(elements.projectStatus, '✅ Projet supprimé.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.projectStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
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

    async function finalize(data) {
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
    }

    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result.split(',')[1];
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
      };
      reader.readAsDataURL(file);
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
      resetProjectForm();
      setStatus(elements.projectStatus, '✅ Projet enregistré avec succès.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(elements.projectStatus, `❌ ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, 'error');
    } finally {
      toggleFormDisabled(elements.projectForm, false);
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
