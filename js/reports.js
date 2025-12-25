/**
 * Reports Module (Firebase Version) - PDF Generation using jsPDF
 */
const Reports = {

    init() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const formatDate = (d) => d.toISOString().split('T')[0];

        if (document.getElementById('sales-from')) {
            document.getElementById('sales-from').value = formatDate(firstDay);
            document.getElementById('sales-to').value = formatDate(lastDay);
            document.getElementById('purchase-from').value = formatDate(firstDay);
            document.getElementById('purchase-to').value = formatDate(lastDay);
        }
    },

    createPDF(title, orientation = 'portrait') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(orientation, 'mm', 'a4');

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('INVENTORY PRO', 14, 20);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(title, 14, 28);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`, 14, 35);
        doc.setTextColor(0);

        doc.setLineWidth(0.5);
        doc.line(14, 38, orientation === 'landscape' ? 283 : 196, 38);

        return doc;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID').format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    },

    // ==================== SALES REPORT ====================
    async generateSales() {
        const fromDate = document.getElementById('sales-from').value;
        const toDate = document.getElementById('sales-to').value;

        let transactions = await Storage.getTransactionsByType('OUT');

        if (fromDate) {
            transactions = transactions.filter(t => new Date(t.date) >= new Date(fromDate));
        }
        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59);
            transactions = transactions.filter(t => new Date(t.date) <= endDate);
        }

        if (transactions.length === 0) {
            App.showToast('Tidak ada data penjualan untuk periode ini', 'warning');
            return;
        }

        const dateRange = fromDate && toDate ? `${this.formatDate(fromDate)} - ${this.formatDate(toDate)}` : 'Semua Periode';
        const doc = this.createPDF(`LAPORAN PENJUALAN\n${dateRange}`);

        const tableData = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            const product = await Storage.getProductById(t.productId);
            const total = (t.sellPrice || 0) * t.quantity;
            tableData.push([
                i + 1,
                this.formatDate(t.date),
                product?.name || '-',
                t.quantity,
                product?.unit || '-',
                'Rp ' + this.formatCurrency(t.sellPrice),
                'Rp ' + this.formatCurrency(total),
                t.notes || '-'
            ]);
        }

        const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0);
        const totalSales = transactions.reduce((sum, t) => sum + ((t.sellPrice || 0) * t.quantity), 0);

        doc.autoTable({
            startY: 45,
            head: [['No', 'Tanggal', 'Produk', 'Qty', 'Unit', 'Harga', 'Total', 'Keterangan']],
            body: tableData,
            foot: [['', '', 'TOTAL', totalQty, '', '', 'Rp ' + this.formatCurrency(totalSales), '']],
            headStyles: { fillColor: [16, 185, 129] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 10 },
                5: { halign: 'right' },
                6: { halign: 'right' }
            }
        });

        doc.save(`Laporan_Penjualan_${new Date().toISOString().split('T')[0]}.pdf`);
        App.showToast('Laporan Penjualan berhasil didownload!');
    },

    // ==================== PURCHASE REPORT ====================
    async generatePurchase() {
        const fromDate = document.getElementById('purchase-from').value;
        const toDate = document.getElementById('purchase-to').value;

        let transactions = await Storage.getTransactionsByType('IN');

        if (fromDate) {
            transactions = transactions.filter(t => new Date(t.date) >= new Date(fromDate));
        }
        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59);
            transactions = transactions.filter(t => new Date(t.date) <= endDate);
        }

        if (transactions.length === 0) {
            App.showToast('Tidak ada data pembelian untuk periode ini', 'warning');
            return;
        }

        const dateRange = fromDate && toDate ? `${this.formatDate(fromDate)} - ${this.formatDate(toDate)}` : 'Semua Periode';
        const doc = this.createPDF(`LAPORAN PEMBELIAN / BARANG MASUK\n${dateRange}`);

        const tableData = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            const product = await Storage.getProductById(t.productId);
            tableData.push([
                i + 1,
                this.formatDate(t.date),
                product?.name || '-',
                t.quantity,
                product?.unit || '-',
                t.notes || '-'
            ]);
        }

        const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0);

        doc.autoTable({
            startY: 45,
            head: [['No', 'Tanggal', 'Produk', 'Jumlah', 'Unit', 'Supplier/Catatan']],
            body: tableData,
            foot: [['', '', 'TOTAL', totalQty, '', '']],
            headStyles: { fillColor: [59, 130, 246] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 9 }
        });

        doc.save(`Laporan_Pembelian_${new Date().toISOString().split('T')[0]}.pdf`);
        App.showToast('Laporan Pembelian berhasil didownload!');
    },

    // ==================== REQUESTS REPORT ====================
    async generateRequests() {
        const statusFilter = document.getElementById('request-status-filter').value;

        const requests = await Storage.getRequestsByStatus(statusFilter);

        if (requests.length === 0) {
            App.showToast('Tidak ada data pengajuan', 'warning');
            return;
        }

        const statusLabel = statusFilter === 'all' ? 'Semua Status' : statusFilter.toUpperCase();
        const doc = this.createPDF(`LAPORAN PENGAJUAN BARANG\nStatus: ${statusLabel}`);

        const tableData = [];
        for (let i = 0; i < requests.length; i++) {
            const r = requests[i];
            const product = await Storage.getProductById(r.productId);
            tableData.push([
                i + 1,
                this.formatDate(r.createdAt),
                product?.name || '-',
                r.quantity,
                product?.unit || '-',
                r.requesterName || '-',
                r.status.toUpperCase(),
                r.reason || '-'
            ]);
        }

        doc.autoTable({
            startY: 45,
            head: [['No', 'Tanggal', 'Produk', 'Qty', 'Unit', 'Pengaju', 'Status', 'Alasan']],
            body: tableData,
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 9 },
            columnStyles: {
                7: { cellWidth: 40 }
            }
        });

        const pending = requests.filter(r => r.status === 'pending').length;
        const approved = requests.filter(r => r.status === 'approved').length;
        const completed = requests.filter(r => r.status === 'completed').length;

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(`Ringkasan: Pending: ${pending} | Approved: ${approved} | Completed: ${completed} | Total: ${requests.length}`, 14, finalY);

        doc.save(`Laporan_Pengajuan_${new Date().toISOString().split('T')[0]}.pdf`);
        App.showToast('Laporan Pengajuan berhasil didownload!');
    },

    // ==================== STOCK REPORT ====================
    async generateStock() {
        const stockOption = document.getElementById('stock-option').value;

        let products = stockOption === 'critical' ? await Storage.getCriticalStock() : await Storage.getProducts();

        if (products.length === 0) {
            App.showToast('Tidak ada data produk', 'warning');
            return;
        }

        const title = stockOption === 'critical' ? 'LAPORAN STOK KRITIS' : 'LAPORAN STOK BARANG';
        const doc = this.createPDF(title);

        const tableData = products.map((p, i) => {
            const isCritical = p.currentStock <= p.minStock;
            return [
                i + 1,
                p.sku,
                p.name,
                p.category || '-',
                p.currentStock,
                p.minStock,
                p.unit,
                'Rp ' + this.formatCurrency(p.buyPrice),
                'Rp ' + this.formatCurrency(p.currentStock * (p.buyPrice || 0)),
                isCritical ? 'KRITIS' : 'Aman'
            ];
        });

        const totalValue = products.reduce((sum, p) => sum + (p.currentStock * (p.buyPrice || 0)), 0);
        const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);

        doc.autoTable({
            startY: 45,
            head: [['No', 'SKU', 'Nama Produk', 'Kategori', 'Stok', 'Min', 'Unit', 'Harga Beli', 'Nilai', 'Status']],
            body: tableData,
            foot: [['', '', '', 'TOTAL', totalStock, '', '', '', 'Rp ' + this.formatCurrency(totalValue), '']],
            headStyles: { fillColor: [139, 92, 246] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 8 },
            columnStyles: {
                7: { halign: 'right' },
                8: { halign: 'right' }
            },
            didParseCell: function (data) {
                if (data.column.index === 9 && data.cell.raw === 'KRITIS') {
                    data.cell.styles.textColor = [239, 68, 68];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        doc.save(`Laporan_Stok_${new Date().toISOString().split('T')[0]}.pdf`);
        App.showToast('Laporan Stok berhasil didownload!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Reports.init(), 100);
});
