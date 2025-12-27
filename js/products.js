/**
 * Products Module (Firebase Version)
 */
const Products = {
    searchTerm: '',
    categoryFilter: '',
    products: [],

    async load() {
        await this.loadCategoryFilter();
        await this.render();
        this.bindEvents();
    },

    async loadCategoryFilter() {
        const categories = await Storage.getCategories();
        const select = document.getElementById('category-filter');
        select.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    async render() {
        let products = await Storage.getProducts();
        this.products = products;

        // Apply filters
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.sku.toLowerCase().includes(term)
            );
        }

        if (this.categoryFilter) {
            products = products.filter(p => p.category === this.categoryFilter);
        }

        const tbody = document.getElementById('products-table');
        tbody.innerHTML = products.map(p => {
            const isCritical = p.currentStock <= p.minStock;
            return `
                <tr>
                    <td><code>${App.escapeHtml(p.sku)}</code></td>
                    <td><strong>${App.escapeHtml(p.name)}</strong></td>
                    <td>${App.escapeHtml(p.category || '-')}</td>
                    <td>
                        <span class="${isCritical ? 'badge badge-danger' : ''}">${p.currentStock}</span>
                    </td>
                    <td>${p.minStock}</td>
                    <td>${App.formatCurrency(p.buyPrice || 0)}</td>
                    <td>${p.unit}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn edit" onclick="Products.edit('${p.id}')" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="action-btn delete" onclick="Products.delete('${p.id}')" title="Hapus">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted);">Tidak ada produk ditemukan</td></tr>`;
        }
    },

    bindEvents() {
        document.getElementById('product-search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.render();
        });

        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.render();
        });
    },

    async showForm(product = null) {
        const isEdit = !!product;
        const title = isEdit ? 'Edit Produk' : 'Tambah Produk Baru';

        const content = `
            <form id="product-form">
                <div class="form-group">
                    <label>Nama Produk *</label>
                    <input type="text" id="pf-name" value="${product?.name || ''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Kode SKU *</label>
                        <input type="text" id="pf-sku" value="${product?.sku || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Kategori</label>
                        <input type="text" id="pf-category" value="${product?.category || ''}" placeholder="Sembako, Minuman, dll">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Satuan *</label>
                        <input type="text" id="pf-unit" value="${product?.unit || ''}" placeholder="Pcs, Box, Kg" required>
                    </div>
                    <div class="form-group">
                        <label>Minimum Stok *</label>
                        <input type="number" id="pf-minstock" value="${product?.minStock || 10}" min="0" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Harga Beli</label>
                        <input type="number" id="pf-buyprice" value="${product?.buyPrice || ''}" min="0" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>Stok Awal</label>
                        <input type="number" id="pf-stock" value="${product?.currentStock || 0}" min="0" ${isEdit ? 'disabled' : ''}>
                        ${isEdit ? '<small class="text-muted">Stok diatur lewat Barang Masuk/Keluar</small>' : ''}
                    </div>
                </div>
                <input type="hidden" id="pf-id" value="${product?.id || ''}">
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">Batal</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</button>
                </div>
            </form>
        `;

        App.showModal(title, content);

        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });
    },

    async save() {
        try {
            const product = {
                id: document.getElementById('pf-id').value || null,
                name: document.getElementById('pf-name').value.trim(),
                sku: document.getElementById('pf-sku').value.trim(),
                category: document.getElementById('pf-category').value.trim(),
                unit: document.getElementById('pf-unit').value.trim(),
                minStock: parseInt(document.getElementById('pf-minstock').value) || 0,
                buyPrice: parseInt(document.getElementById('pf-buyprice').value) || 0,
                currentStock: parseInt(document.getElementById('pf-stock').value) || 0
            };

            const savedProduct = await Storage.saveProduct(product);
            if (savedProduct) {
                App.closeModal();
                App.showToast(product.id ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
                await this.loadCategoryFilter();
                await this.render();
            } else {
                App.showToast('Gagal menyimpan produk ke database!', 'error');
            }
        } catch (error) {
            console.error('Save product error:', error);
            App.showToast('Terjadi kesalahan saat menyimpan produk!', 'error');
        }
    },

    async edit(id) {
        const product = await Storage.getProductById(id);
        if (product) {
            this.showForm(product);
        }
    },

    async delete(id) {
        try {
            const product = await Storage.getProductById(id);
            if (!product) {
                App.showToast('Produk tidak ditemukan!', 'error');
                return;
            }

            // Validation: Prevent deleting product with stock
            if (product.currentStock > 0) {
                App.showToast(`Gagal hapus! Produk <strong>${product.name}</strong> masih memiliki stok (${product.currentStock} ${product.unit}). Habiskan stok terlebih dahulu.`, 'warning');
                return;
            }

            const content = `
                <p>Apakah Anda yakin ingin menghapus produk <strong>${App.escapeHtml(product.name)}</strong>?</p>
                <p class="text-muted" style="margin-top: 8px;">Tindakan ini tidak dapat dibatalkan.</p>
                <div class="modal-footer" style="margin-top: 24px;">
                    <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
                    <button class="btn btn-danger" id="confirm-delete-btn" onclick="Products.confirmDelete('${id}')">Hapus</button>
                </div>
            `;

            App.showModal('Hapus Produk', content);
        } catch (error) {
            console.error('Delete product error:', error);
            App.showToast('Terjadi kesalahan saat memuat data produk!', 'error');
        }
    },

    async confirmDelete(id) {
        const btn = document.getElementById('confirm-delete-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menghapus...';
        }

        try {
            const success = await Storage.deleteProduct(id);
            if (success) {
                App.closeModal();
                App.showToast('Produk berhasil dihapus!');
                await this.render();
            } else {
                App.showToast('Gagal menghapus produk dari database!', 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Hapus';
                }
            }
        } catch (error) {
            console.error('Confirm delete error:', error);
            App.showToast('Terjadi kesalahan saat menghapus produk!', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Hapus';
            }
        }
    }
};
