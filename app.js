// Module Pattern untuk mengelola aplikasi
const LinkHub = (() => {
    // Konfigurasi & State
    const CONFIG = {
        FILE_PATH: '/linkhub-data.json'
    };
    let state = {
        githubUsername: null,
        githubToken: null,
        repoName: null,
        links: [],
        isEditing: false,
        currentEditId: null
    };

    // Cache DOM Elements
    const authScreenEl = document.getElementById('auth-screen');
    const appContentEl = document.getElementById('app-content');
    const authFormEl = document.getElementById('auth-form');
    const searchInputEl = document.getElementById('search-input');
    const linksContainerEl = document.getElementById('links-container');
    const loadingStateEl = document.getElementById('loading-state');
    const addNewBtnEl = document.getElementById('add-new-btn');
    const linkModalEl = document.getElementById('link-modal');
    const modalTitleEl = document.getElementById('modal-title');
    const linkFormEl = document.getElementById('link-form');
    const modalCancelBtnEl = document.getElementById('modal-cancel');

    // Initialize App
    function init() {
        _loadConfigFromStorage();
        _bindEvents();
        _checkAuthState();
    }

    // Cek status auth saat pertama kali load
    function _checkAuthState() {
        if (state.githubUsername && state.githubToken && state.repoName) {
            _switchToAppView();
            _loadLinksFromGitHub();
        } else {
            _switchToAuthView();
        }
    }

    // Load konfigurasi dari localStorage
    function _loadConfigFromStorage() {
        const savedConfig = localStorage.getItem('linkhub-config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            state.githubUsername = config.username;
            state.githubToken = config.token;
            state.repoName = config.repoName;
        }
    }

    // Simpan konfigurasi ke localStorage
    function _saveConfigToStorage() {
        const config = {
            username: state.githubUsername,
            token: state.githubToken,
            repoName: state.repoName
        };
        localStorage.setItem('linkhub-config', JSON.stringify(config));
    }

    // Bind event listeners
    function _bindEvents() {
        authFormEl.addEventListener('submit', _handleAuthSubmit);
        addNewBtnEl.addEventListener('click', () => _openModal());
        modalCancelBtnEl.addEventListener('click', _closeModal);
        linkFormEl.addEventListener('submit', _handleLinkSubmit);
        searchInputEl.addEventListener('input', _handleSearch);
    }

    // Handle form auth
    function _handleAuthSubmit(e) {
        e.preventDefault();
        state.githubUsername = document.getElementById('github-username').value;
        state.githubToken = document.getElementById('github-token').value;
        state.repoName = document.getElementById('repo-name').value;

        _saveConfigToStorage();
        _switchToAppView();
        _loadLinksFromGitHub();
    }

    // Ganti tampilan ke mode app
    function _switchToAppView() {
        authScreenEl.classList.add('hidden');
        appContentEl.classList.remove('hidden');
    }

    // Ganti tampilan ke mode auth
    function _switchToAuthView() {
        authScreenEl.classList.remove('hidden');
        appContentEl.classList.add('hidden');
    }

    // ================ GITHUB API OPERATIONS ================ //

    // Fungsi untuk melakukan call API GitHub
    async function _callGitHubApi(endpoint, options = {}) {
        const url = `https://api.github.com${endpoint}`;
        const auth = btoa(`${state.githubUsername}:${state.githubToken}`);

        const defaultOptions = {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    // Ambil data links dari file di GitHub
    async function _loadLinksFromGitHub() {
        _showLoadingState();
        try {
            const endpoint = `/repos/${state.githubUsername}/${state.repoName}/contents${CONFIG.FILE_PATH}`;
            const fileData = await _callGitHubApi(endpoint);
            // File ada, decode isinya
            const content = JSON.parse(atob(fileData.content));
            state.links = Array.isArray(content) ? content : [];
            _renderLinks(state.links);
        } catch (error) {
            if (error.message.includes('404')) {
                // File belum ada, buat array kosong
                state.links = [];
                _renderLinks(state.links);
            } else {
                console.error('Error loading links:', error);
                alert('Gagal memuat data. Periksa koneksi dan kredensial Anda.');
                _switchToAuthView();
            }
        } finally {
            _hideLoadingState();
        }
    }

    // Simpan/update data links ke GitHub
    async function _saveLinksToGitHub() {
        try {
            const content = btoa(JSON.stringify(state.links, null, 2)); // Convert to base64
            let sha = null;

            // Coba dapatkan SHA file yang sudah ada untuk update
            try {
                const endpoint = `/repos/${state.githubUsername}/${state.repoName}/contents${CONFIG.FILE_PATH}`;
                const existingFile = await _callGitHubApi(endpoint);
                sha = existingFile.sha;
            } catch (e) {} // File tidak ada, sha tetap null

            const endpoint = `/repos/${state.githubUsername}/${state.repoName}/contents${CONFIG.FILE_PATH}`;
            const payload = {
                message: state.isEditing ? 'Update link in LinkHub' : 'Add new link to LinkHub',
                content: content,
                sha: sha // Jika sha null, akan create file baru
            };

            await _callGitHubApi(endpoint, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            _closeModal();
            _loadLinksFromGitHub(); // Reload data terbaru
        } catch (error) {
            console.error('Error saving links:', error);
            alert('Gagal menyimpan data. Periksa koneksi dan kredensial Anda.');
        }
    }

    // ================ UI OPERATIONS ================ //

    // Tampilkan loading state
    function _showLoadingState() {
        loadingStateEl.classList.remove('hidden');
        linksContainerEl.innerHTML = '';
    }

    // Sembunyikan loading state
    function _hideLoadingState() {
        loadingStateEl.classList.add('hidden');
    }

    // Render daftar links ke UI
    function _renderLinks(linksToRender) {
        if (linksToRender.length === 0) {
            linksContainerEl.innerHTML = `
                <div class="loading-state">
                    <i data-feather="inbox"></i>
                    <p>Tidak ada link yang disimpan. Klik "Add New Link" untuk menambahkan.</p>
                </div>
            `;
            feather.replace();
            return;
        }

        const linksHtml = linksToRender.map(link => `
            <div class="link-card" data-id="${link.id}">
                <div class="link-header">
                    <a href="${link.url}" target="_blank" class="link-title">${link.title}</a>
                    <div class="link-actions">
                        <button class="link-action-btn" data-action="edit" title="Edit">
                            <i data-feather="edit"></i>
                        </button>
                        <button class="link-action-btn" data-action="delete" title="Hapus">
                            <i data-feather="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="link-url">${link.url}</div>
                ${link.tags && link.tags.length > 0 ? `
                    <div class="link-tags">
                        ${link.tags.map(tag => `<span class="link-tag" data-tag="${tag}">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                ${link.notes ? `<div class="link-notes">${link.notes}</div>` : ''}
            </div>
        `).join('');

        linksContainerEl.innerHTML = linksHtml;
        feather.replace();

        // Bind event listeners untuk action buttons
        linksContainerEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.link-card');
                const id = card.dataset.id;
                _openModal(id);
            });
        });

        linksContainerEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const card = e.target.closest('.link-card');
                const id = card.dataset.id;
                if (confirm('Apakah Anda yakin ingin menghapus link ini?')) {
                    state.links = state.links.filter(link => link.id !== id);
                    await _saveLinksToGitHub();
                }
            });
        });

        // Bind event listener untuk tags
        linksContainerEl.querySelectorAll('.link-tag').forEach(tagEl => {
            tagEl.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                searchInputEl.value = tag;
                _handleSearch();
            });
        });
    }

    // Buka modal untuk add/edit
    function _openModal(linkId = null) {
        state.isEditing = !!linkId;
        state.currentEditId = linkId;

        if (state.isEditing) {
            modalTitleEl.textContent = 'Edit Link';
            const linkToEdit = state.links.find(link => link.id === linkId);
            document.getElementById('edit-id').value = linkId;
            document.getElementById('link-title').value = linkToEdit.title;
            document.getElementById('link-url').value = linkToEdit.url;
            document.getElementById('link-tags').value = linkToEdit.tags ? linkToEdit.tags.join(', ') : '';
            document.getElementById('link-notes').value = linkToEdit.notes || '';
        } else {
            modalTitleEl.textContent = 'Tambah Link Baru';
            linkFormEl.reset();
        }

        linkModalEl.classList.add('active');
    }

    // Tutup modal
    function _closeModal() {
        linkModalEl.classList.remove('active');
        state.isEditing = false;
        state.currentEditId = null;
        linkFormEl.reset();
    }

    // Handle form submit untuk add/edit link
    function _handleLinkSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const linkData = {
            id: state.isEditing ? state.currentEditId : Date.now().toString(),
            title: formData.get('link-title'),
            url: formData.get('link-url'),
            tags: formData.get('link-tags') ? formData.get('link-tags').split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [],
            notes: formData.get('link-notes'),
            createdAt: state.isEditing ? state.links.find(link => link.id === state.currentEditId).createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (state.isEditing) {
            // Update existing link
            const index = state.links.findIndex(link => link.id === state.currentEditId);
            state.links[index] = linkData;
        } else {
            // Add new link
            state.links.unshift(linkData);
        }

        _saveLinksToGitHub();
    }

    // Handle pencarian
    function _handleSearch() {
        const query = searchInputEl.value.toLowerCase().trim();
        if (query === '') {
            _renderLinks(state.links);
            return;
        }

        const filteredLinks = state.links.filter(link => {
            return link.title.toLowerCase().includes(query) ||
                   (link.tags && link.tags.some(tag => tag.toLowerCase().includes(query))) ||
                   (link.notes && link.notes.toLowerCase().includes(query));
        });

        _renderLinks(filteredLinks);
    }

    // Ekspos fungsi public
    return {
        init
    };
})();

// Start the app
document.addEventListener('DOMContentLoaded', LinkHub.init);