/**
 * Transactions Module (Firebase Version)
 */
const Transactions = {
    // ==================== INBOUND ====================
    async loadInbound() {
        await this.populateProductSelect('inbound-product');
        await this.populateApprovedRequests();
        this.setDefaultDate('inbound-date');
        await this.renderInboundHistory();
        this.bindInboundForm();
    },

    async populateProductSelect(selectId, selectedId = '') {
        const products = await Storage.getProducts();
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">-- Pilih Produk --</option>' +
            products.map(p =>
                `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} (${p.currentStock} ${p.unit})</option>`
            ).join('');
    },

    async populateApprovedRequests() {
        const requests = await Storage.getRequestsByStatus('approved');
        const select = document.getElementById('inbound-request');

        let options = '<option value="">-- Tidak ada --</option>';
        for (const r of requests) {
            const product = await Storage.getProductById(r.productId);
            options += `<option value="${r.id}">${product?.name || 'Unknown'} - ${r.quantity} unit (${App.formatDate(r.createdAt)})</option>`;
        }
        select.innerHTML = options;
    },

    setDefaultDate(inputId) {
        const input = document.getElementById(inputId);
        input.value = new Date().toISOString().split('T')[0];
    },

    async renderInboundHistory() {
        const transactions = await Storage.getTransactionsByType('IN');
        const recent = transactions.slice(0, 20);
        const tbody = document.getElementById('inbound-history-table');

        let rows = [];
        for (const t of recent) {
            const product = await Storage.getProductById(t.productId);
            rows.push(`
                <tr>
                    <td>${App.formatDate(t.date, true)}</td>
                    <td>${product ? App.escapeHtml(product.name) : '-'}</td>
                    <td><strong>${t.quantity}</strong> ${product?.unit || ''}</td>
                    <td>${App.escapeHtml(t.supplier || '-')}</td>
                    <td>${App.escapeHtml(t.notes || '-')}</td>
                </tr>
            `);
        }
        tbody.innerHTML = rows.join('');

        if (recent.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--text-muted);">Belum ada data barang masuk</td></tr>`;
        }
    },

    bindInboundForm() {
        const form = document.getElementById('inbound-form');
        // Remove existing listener by replacing the element (reliable way to clear listeners)
        const newForm = form.cloneNode(true);
        form.replaceWith(newForm);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveInbound();
        });
    },

    async saveInbound() {
        const productId = document.getElementById('inbound-product').value;
        const quantity = parseInt(document.getElementById('inbound-quantity').value);
        const date = document.getElementById('inbound-date').value;
        const supplier = document.getElementById('inbound-supplier').value;
        const requestId = document.getElementById('inbound-request').value;
        const notes = document.getElementById('inbound-notes').value;

        if (!productId || !quantity) {
            App.showToast('Pilih produk dan masukkan jumlah!', 'error');
            return;
        }

        const success = await Storage.saveTransaction({
            productId,
            type: 'IN',
            quantity,
            date: date ? new Date(date).toISOString() : new Date().toISOString(),
            supplier: supplier || '-',
            notes: notes || '-',
            requestId
        });

        if (success) {
            if (requestId) {
                await Storage.updateRequestStatus(requestId, 'completed');
            }

            App.showToast(`${quantity} unit berhasil dicatat masuk!`);

            // Re-fetch form as it might have been replaced or needs specific reset
            const form = document.getElementById('inbound-form');
            if (form) form.reset();

            this.setDefaultDate('inbound-date');
            await this.populateApprovedRequests();
            await this.renderInboundHistory();
        } else {
            App.showToast('Gagal menyimpan data!', 'error');
        }
    },

    // ==================== OUTBOUND ====================
    async loadOutbound() {
        await this.populateProductSelect('outbound-product');
        this.setDefaultDate('outbound-date');
        await this.renderOutboundHistory();
        this.bindOutboundForm();
        this.bindStockInfo();
    },

    bindStockInfo() {
        const select = document.getElementById('outbound-product');
        const stockInfo = document.getElementById('stock-info');

        select.addEventListener('change', async () => {
            const productId = select.value;
            if (productId) {
                const product = await Storage.getProductById(productId);
                stockInfo.textContent = `Stok tersedia: ${product.currentStock} ${product.unit}`;
            } else {
                stockInfo.textContent = '';
            }
        });
    },

    async renderOutboundHistory() {
        const transactions = await Storage.getTransactionsByType('OUT');
        const recent = transactions.slice(0, 20);
        const tbody = document.getElementById('outbound-history-table');

        let rows = [];
        for (const t of recent) {
            const product = await Storage.getProductById(t.productId);
            const total = (t.sellPrice || 0) * t.quantity;
            rows.push(`
                <tr>
                    <td>${App.formatDate(t.date, true)}</td>
                    <td>${product ? App.escapeHtml(product.name) : '-'}</td>
                    <td><strong>${t.quantity}</strong> ${product?.unit || ''}</td>
                    <td>${App.formatCurrency(t.sellPrice || 0)}</td>
                    <td>${App.formatCurrency(total)}</td>
                    <td>${App.escapeHtml(t.notes || '-')}</td>
                </tr>
            `);
        }
        tbody.innerHTML = rows.join('');

        if (recent.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--text-muted);">Belum ada data penjualan</td></tr>`;
        }
    },

    bindOutboundForm() {
        const form = document.getElementById('outbound-form');
        const newForm = form.cloneNode(true);
        form.replaceWith(newForm);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveOutbound();
        });

        this.bindStockInfo();
    },

    async saveOutbound() {
        const productId = document.getElementById('outbound-product').value;
        const quantity = parseInt(document.getElementById('outbound-quantity').value);
        const sellPrice = parseInt(document.getElementById('outbound-price').value) || 0;
        const date = document.getElementById('outbound-date').value;
        const notes = document.getElementById('outbound-notes').value;

        if (!productId || !quantity) {
            App.showToast('Pilih produk dan masukkan jumlah!', 'error');
            return;
        }

        const product = await Storage.getProductById(productId);
        if (quantity > product.currentStock) {
            App.showToast(`Stok tidak cukup! Tersedia: ${product.currentStock} ${product.unit}`, 'error');
            return;
        }

        await Storage.saveTransaction({
            productId,
            type: 'OUT',
            quantity,
            sellPrice,
            date: date ? new Date(date).toISOString() : new Date().toISOString(),
            notes
        });

        App.showToast(`${quantity} unit berhasil dicatat keluar!`);

        document.getElementById('outbound-form').reset();
        this.setDefaultDate('outbound-date');
        document.getElementById('stock-info').textContent = '';
        await this.renderOutboundHistory();
    }
};
