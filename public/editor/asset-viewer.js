(function () {
  'use strict';

  const MANIFEST_URL = '/assets/sprites/manifest.json';
  const state = { manifest: null, selectedPath: null, view: 'medium', onBack: null };
  let root;
  let categoriesElement;
  let titleElement;
  let statsElement;
  let contentElement;

  function init(options) {
    root = document.getElementById('asset-viewer');
    categoriesElement = document.getElementById('asset-categories');
    titleElement = document.getElementById('asset-category-title');
    statsElement = document.getElementById('asset-category-stats');
    contentElement = document.getElementById('asset-content');
    state.onBack = options && options.onBack;

    document.getElementById('asset-viewer-back').addEventListener('click', close);
    document.querySelectorAll('[data-asset-view]').forEach(button => {
      button.addEventListener('click', () => setView(button.dataset.assetView));
    });
  }

  async function open() {
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    if (state.manifest) {
      render();
      return;
    }

    categoriesElement.innerHTML = '';
    titleElement.textContent = 'Assets';
    statsElement.textContent = '';
    setContentMessage('Loading asset manifest…', 'asset-loading');

    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (!manifest || !Array.isArray(manifest.categories)) throw new Error('Invalid manifest format');
      state.manifest = manifest;
      const preferred = manifest.categories.find(category => category.path.toLowerCase() === 'corporations');
      state.selectedPath = (preferred || manifest.categories[0])?.path || null;
      render();
    } catch (error) {
      console.warn('Failed to load sprite asset manifest.', error);
      setContentMessage('Could not load the asset manifest. Run npm run generate-asset-manifest and try again.', 'asset-error');
    }
  }

  function close() {
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    if (typeof state.onBack === 'function') state.onBack();
  }

  function isOpen() {
    return Boolean(root && root.classList.contains('open'));
  }

  function render() {
    renderCategories();
    renderSelectedCategory();
    document.querySelectorAll('[data-asset-view]').forEach(button => {
      const active = button.dataset.assetView === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderCategories() {
    categoriesElement.innerHTML = '';
    for (const category of state.manifest.categories) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-category-btn';
      button.classList.toggle('active', category.path === state.selectedPath);
      button.textContent = category.label;
      button.title = category.path;
      button.addEventListener('click', () => {
        state.selectedPath = category.path;
        render();
      });
      categoriesElement.appendChild(button);
    }
  }

  function renderSelectedCategory() {
    const category = state.manifest.categories.find(entry => entry.path === state.selectedPath);
    contentElement.innerHTML = '';
    contentElement.className = 'asset-content';

    if (!category) {
      titleElement.textContent = 'No sprite categories';
      statsElement.textContent = '0 images · 0 bytes';
      setContentMessage('No sprite folders were found.', 'asset-empty');
      return;
    }

    const totalSize = category.assets.reduce((sum, asset) => sum + asset.size, 0);
    titleElement.textContent = category.label;
    statsElement.textContent = `${category.assets.length} ${category.assets.length === 1 ? 'image' : 'images'} · ${formatSize(totalSize)}`;
    contentElement.classList.add(state.view === 'list' ? 'asset-list' : `asset-grid-${state.view}`);

    if (category.assets.length === 0) {
      setContentMessage('This folder contains no supported images.', 'asset-empty');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const asset of category.assets) {
      fragment.appendChild(state.view === 'list' ? createListRow(asset) : createTile(asset));
    }
    contentElement.appendChild(fragment);
  }

  function createListRow(asset) {
    const row = document.createElement('div');
    row.className = 'asset-row';
    row.appendChild(createPreview(asset, 'small'));

    const name = document.createElement('div');
    name.className = 'asset-row-name';
    name.textContent = asset.name;
    name.title = asset.name;
    row.appendChild(name);

    const type = document.createElement('div');
    type.className = 'asset-row-meta';
    type.textContent = asset.type;
    row.appendChild(type);

    const size = document.createElement('div');
    size.className = 'asset-row-meta';
    size.textContent = formatSize(asset.size);
    row.appendChild(size);
    return row;
  }

  function createTile(asset) {
    const tile = document.createElement('div');
    tile.className = 'asset-tile';
    tile.title = asset.name;
    tile.appendChild(createPreview(asset, state.view));

    const label = document.createElement('div');
    label.className = 'asset-hover-label';
    label.textContent = asset.name;
    tile.appendChild(label);
    return tile;
  }

  function createPreview(asset, size) {
    const preview = document.createElement('div');
    preview.className = `asset-preview ${size}`;

    const image = document.createElement('img');
    image.src = asset.path;
    image.alt = asset.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      preview.classList.add('broken');
      image.setAttribute('aria-hidden', 'true');
    }, { once: true });

    const broken = document.createElement('span');
    broken.className = 'asset-broken-label';
    broken.textContent = 'Missing or unreadable image';
    preview.append(image, broken);
    return preview;
  }

  function setView(view) {
    if (!['list', 'medium', 'large'].includes(view) || state.view === view) return;
    state.view = view;
    render();
  }

  function setContentMessage(message, className) {
    contentElement.innerHTML = '';
    contentElement.className = 'asset-content';
    const element = document.createElement('div');
    element.className = className;
    element.textContent = message;
    contentElement.appendChild(element);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
    if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
    return `${formatNumber(bytes / (1024 * 1024))} MB`;
  }

  function formatNumber(value) {
    return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  }

  window.EpochAssetViewer = { init, open, close, isOpen };
}());
