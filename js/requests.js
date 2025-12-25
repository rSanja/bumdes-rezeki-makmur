/**
 * Requests Module (Firebase Version)
 */
const Requests = {
    currentFilter: 'all',

    async load() {
        this.bindTabs();
        await this.render();
    },

    bindTabs() {
        document.querySelectorAll('#page-requests .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#page-requests .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.status;
                this.render();
            });
        });
    },

    async render() {
        const requests = await Storage.getRequestsByStatus(this.currentFilter);
        const grid = document.getElementById('requests-grid');
        const empty = document.getElementById('no-requests');
        const user = App.currentUser;

        if (requests.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');

        let cards = [];
        for (const r of requests) {
            const product = await Storage.getProductById(r.productId);
            const statusBadge = {
                'pending': '<span class="badge badge-pending">Pending</span>',
                'approved': '<span class="badge badge-approved">Approved</span>',
                'completed': '<span class="badge badge-completed">Completed</span>'
            };

            let actions = '';
            if (r.status === 'pending' && user.role === 'manager') {
                actions = `
                    <button class="btn btn-sm btn-primary" onclick="Requests.approve('${r.id}')">
                        ✓ Approve
                    </button>
                `;
            } else if (r.status === 'approved' && (user.role === 'admin' || user.role === 'manager')) {
                actions = `
                    <button class="btn btn-sm btn-primary" onclick="Requests.complete('${r.id}')">
                        📦 Barang Datang
                    </button>
                `;
            }

            cards.push(`
                <div class="request-card">
                    <div class="request-header">
                        <div>
                            <div class="request-product">${product ? App.escapeHtml(product.name) : 'Unknown'}</div>
                            <div class="request-quantity">${r.quantity} ${product?.unit || 'unit'}</div>
                        </div>
                        ${statusBadge[r.status]}
                    </div>
                    <div class="request-meta">
                        <span>👤 ${App.escapeHtml(r.requesterName)}</span>
                        <span>📅 ${App.formatDate(r.createdAt, true)}</span>
                    </div>
                    ${r.reason ? `<div class="request-reason">"${App.escapeHtml(r.reason)}"</div>` : ''}
                    ${r.status === 'approved' ? `<div class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Disetujui: ${App.formatDate(r.approvedAt, true)}</div>` : ''}
                    ${r.status === 'completed' ? `<div class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Selesai: ${App.formatDate(r.completedAt, true)}</div>` : ''}
                    <div class="request-actions">
                        ${actions}
                    </div>
                </div>
            `);
        }
        grid.innerHTML = cards.join('');
    },

    async showForm(productId = null) {
        const user = App.currentUser;

        if (user.role === 'admin') {
            App.showToast('Admin tidak dapat membuat pengajuan', 'warning');
            return;
        }

        const product = productId ? await Storage.getProductById(productId) : null;
        const products = await Storage.getProducts();
        const productOptions = products.map(p =>
            `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${p.name} (${p.currentStock} ${p.unit})</option>`
        ).join('');

        const content = `
            <form id="request-form">
                <div class="form-group">
                    <label>Pilih Produk *</label>
                    <select id="rf-product" class="select-input" required style="width: 100%;">
                        <option value="">-- Pilih Produk --</option>
                        ${productOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Jumlah yang Diminta *</label>
                    <input type="number" id="rf-quantity" min="1" value="${product ? Math.max(1, product.minStock - product.currentStock + 10) : ''}" required>
                </div>
                <div class="form-group">
                    <label>Alasan Pengajuan</label>
                    <textarea id="rf-reason" rows="3" placeholder="Contoh: Stok menipis, perlu untuk promo minggu depan...">${product && product.currentStock <= product.minStock ? `Stok ${product.name} tinggal ${product.currentStock} ${product.unit}, di bawah minimum (${product.minStock})` : ''}</textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">Batal</button>
                    <button type="submit" class="btn btn-primary">Kirim Pengajuan</button>
                </div>
            </form>
        `;

        App.showModal('Buat Pengajuan Baru', content);

        document.getElementById('request-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });
    },

    showFormForProduct(productId) {
        this.showForm(productId);
    },

    async save() {
        const productId = document.getElementById('rf-product').value;
        const quantity = parseInt(document.getElementById('rf-quantity').value);
        const reason = document.getElementById('rf-reason').value;

        if (!productId || !quantity) {
            App.showToast('Pilih produk dan masukkan jumlah!', 'error');
            return;
        }

        await Storage.saveRequest({
            productId,
            quantity,
            reason,
            requesterName: App.currentUser.displayName
        });

        App.closeModal();
        App.showToast('Pengajuan berhasil dikirim!');
        await this.render();
    },

    async approve(id) {
        await Storage.updateRequestStatus(id, 'approved');
        App.showToast('Pengajuan disetujui!');
        await this.render();
    },

    async complete(id) {
        const requests = await Storage.getRequests();
        const request = requests.find(r => r.id === id);
        if (!request) return;

        const product = await Storage.getProductById(request.productId);

        const content = `
            <p>Barang sudah datang untuk pengajuan:</p>
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin: 16px 0;">
                <strong>${product?.name || 'Unknown'}</strong><br>
                Jumlah diminta: ${request.quantity} ${product?.unit || 'unit'}
            </div>
            <div class="form-group">
                <label>Jumlah yang Diterima *</label>
                <input type="number" id="complete-qty" value="${request.quantity}" min="1" required>
            </div>
            <div class="form-group">
                <label>Nama Supplier</label>
                <input type="text" id="complete-supplier" placeholder="PT. Supplier ABC">
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
                <button class="btn btn-primary" onclick="Requests.confirmComplete('${id}', '${request.productId}')">
                    ✓ Konfirmasi & Tambah Stok
                </button>
            </div>
        `;

        App.showModal('Konfirmasi Barang Datang', content);
    },

    async confirmComplete(requestId, productId) {
        const quantity = parseInt(document.getElementById('complete-qty').value);
        const supplier = document.getElementById('complete-supplier').value;

        if (!quantity || quantity < 1) {
            App.showToast('Masukkan jumlah yang valid!', 'error');
            return;
        }

        await Storage.saveTransaction({
            productId,
            type: 'IN',
            quantity,
            notes: supplier || 'Pengajuan ' + requestId,
            requestId
        });

        await Storage.updateRequestStatus(requestId, 'completed');

        App.closeModal();
        App.showToast(`${quantity} unit berhasil ditambahkan ke stok!`);
        await this.render();
    }
};
