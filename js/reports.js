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
        const pageWidth = orientation === 'landscape' ? 297 : 210;

        // Branding Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // Navy color matching our UI
        doc.text('STIVEN BUMDES REZEKI MAKMUR', 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('Sistem Informasi & Manajemen Inventory', 14, 20);

        // Report Title & Date Range
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);

        // Handle multiline title (title + date range)
        const titleLines = doc.splitTextToSize(title, pageWidth - 28);
        doc.text(titleLines, 14, 28);

        const titleHeight = titleLines.length * 7;
        const infoY = 28 + titleHeight;

        // Info Metadata
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Dicetak oleh: ${App.currentUser?.displayName || 'System'}`, 14, infoY);
        doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 14, infoY + 4);

        // Line separator
        doc.setLineWidth(0.3);
        doc.setDrawColor(200);
        doc.line(14, infoY + 7, pageWidth - 14, infoY + 7);

        return { doc, startY: infoY + 12 };
    },

    downloadPDF(doc, fileName) {
        try {
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;

            // Add to DOM for compatibility
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Cleanup
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error('downloadPDF error:', error);
            // Fallback to standard save if blob fails
            doc.save(fileName);
        }
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
        try {
            const fromDateArr = document.getElementById('sales-from')?.value || '';
            const toDateArr = document.getElementById('sales-to')?.value || '';

            let transactions = await Storage.getTransactionsByType('OUT');

            if (fromDateArr) {
                transactions = transactions.filter(t => new Date(t.date) >= new Date(fromDateArr));
            }
            if (toDateArr) {
                const endDate = new Date(toDateArr);
                endDate.setHours(23, 59, 59);
                transactions = transactions.filter(t => new Date(t.date) <= endDate);
            }

            if (transactions.length === 0) {
                App.showToast('Tidak ada data penjualan untuk periode ini', 'warning');
                return;
            }

            // Batch fetch products for performance
            const products = await Storage.getProducts();
            const productMap = products.reduce((map, p) => {
                map[p.id] = p;
                return map;
            }, {});

            const dateRange = fromDateArr && toDateArr ? `${this.formatDate(fromDateArr)} - ${this.formatDate(toDateArr)}` : 'Semua Periode';
            const { doc, startY } = this.createPDF(`LAPORAN PENJUALAN\nPeriode: ${dateRange}`);

            const tableData = [];
            for (let i = 0; i < transactions.length; i++) {
                const t = transactions[i];
                const product = productMap[t.productId];
                const total = (t.sellPrice || 0) * t.quantity;
                tableData.push([
                    i + 1,
                    this.formatDate(t.date),
                    product?.name || `(ID: ${t.productId})`,
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
                startY: startY,
                head: [['No', 'Tanggal', 'Produk', 'Qty', 'Unit', 'Harga', 'Total', 'Keterangan']],
                body: tableData,
                foot: [['', '', 'TOTAL', totalQty, '', '', 'Rp ' + this.formatCurrency(totalSales), '']],
                headStyles: { fillColor: [15, 23, 42] },
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    5: { halign: 'right' },
                    6: { halign: 'right' }
                }
            });

            const fileName = `Laporan_Penjualan_${new Date().getTime()}.pdf`;
            this.downloadPDF(doc, fileName);
            App.showToast('Laporan Penjualan berhasil diunduh!');
        } catch (error) {
            console.error('generateSales error:', error);
            App.showToast('Gagal membuat laporan penjualan', 'error');
        }
    },

    // ==================== PURCHASE REPORT ====================
    async generatePurchase() {
        try {
            const fromDateArr = document.getElementById('purchase-from')?.value || '';
            const toDateArr = document.getElementById('purchase-to')?.value || '';

            let transactions = await Storage.getTransactionsByType('IN');

            if (fromDateArr) {
                transactions = transactions.filter(t => new Date(t.date) >= new Date(fromDateArr));
            }
            if (toDateArr) {
                const endDate = new Date(toDateArr);
                endDate.setHours(23, 59, 59);
                transactions = transactions.filter(t => new Date(t.date) <= endDate);
            }

            if (transactions.length === 0) {
                App.showToast('Tidak ada data pembelian untuk periode ini', 'warning');
                return;
            }

            const products = await Storage.getProducts();
            const productMap = products.reduce((map, p) => {
                map[p.id] = p;
                return map;
            }, {});

            const dateRange = fromDateArr && toDateArr ? `${this.formatDate(fromDateArr)} - ${this.formatDate(toDateArr)}` : 'Semua Periode';
            const { doc, startY } = this.createPDF(`LAPORAN PEMBELIAN / BARANG MASUK\nPeriode: ${dateRange}`);

            const tableData = [];
            for (let i = 0; i < transactions.length; i++) {
                const t = transactions[i];
                const product = productMap[t.productId];
                tableData.push([
                    i + 1,
                    this.formatDate(t.date),
                    product?.name || `(ID: ${t.productId})`,
                    t.quantity,
                    product?.unit || '-',
                    t.notes || '-'
                ]);
            }

            const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0);

            doc.autoTable({
                startY: startY,
                head: [['No', 'Tanggal', 'Produk', 'Jumlah', 'Unit', 'Supplier/Catatan']],
                body: tableData,
                foot: [['', '', 'TOTAL', totalQty, '', '']],
                headStyles: { fillColor: [15, 23, 42] },
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 3 }
            });

            const fileName = `Laporan_Pembelian_${new Date().getTime()}.pdf`;
            this.downloadPDF(doc, fileName);
            App.showToast('Laporan Pembelian berhasil diunduh!');
        } catch (error) {
            console.error('generatePurchase error:', error);
            App.showToast('Gagal membuat laporan pembelian', 'error');
        }
    },

    // ==================== REQUESTS REPORT ====================
    async generateRequests() {
        try {
            const statusFilter = document.getElementById('request-status-filter')?.value || 'all';
            const requests = await Storage.getRequestsByStatus(statusFilter);

            if (requests.length === 0) {
                App.showToast('Tidak ada data pengajuan', 'warning');
                return;
            }

            const products = await Storage.getProducts();
            const productMap = products.reduce((map, p) => {
                map[p.id] = p;
                return map;
            }, {});

            const statusLabel = statusFilter === 'all' ? 'Semua Status' : statusFilter.toUpperCase();
            const { doc, startY } = this.createPDF(`LAPORAN PENGAJUAN BARANG\nStatus: ${statusLabel}`);

            const tableData = [];
            for (let i = 0; i < requests.length; i++) {
                const r = requests[i];
                const product = productMap[r.productId];
                tableData.push([
                    i + 1,
                    this.formatDate(r.createdAt),
                    product?.name || `(ID: ${r.productId})`,
                    r.quantity,
                    product?.unit || '-',
                    r.requesterName || '-',
                    r.status.toUpperCase(),
                    r.reason || '-'
                ]);
            }

            doc.autoTable({
                startY: startY,
                head: [['No', 'Tanggal', 'Produk', 'Qty', 'Unit', 'Pengaju', 'Status', 'Alasan']],
                body: tableData,
                headStyles: { fillColor: [15, 23, 42] },
                styles: { fontSize: 8, cellPadding: 3 },
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

            const fileName = `Laporan_Pengajuan_${new Date().getTime()}.pdf`;
            this.downloadPDF(doc, fileName);
            App.showToast('Laporan Pengajuan berhasil diunduh!');
        } catch (error) {
            console.error('generateRequests error:', error);
            App.showToast('Gagal membuat laporan pengajuan', 'error');
        }
    },

    // ==================== STOCK REPORT ====================
    async generateStock() {
        try {
            const stockOption = document.getElementById('stock-option')?.value || 'all';
            let products = stockOption === 'critical' ? await Storage.getCriticalStock() : await Storage.getProducts();

            if (products.length === 0) {
                App.showToast('Tidak ada data produk', 'warning');
                return;
            }

            const title = stockOption === 'critical' ? 'LAPORAN STOK KRITIS' : 'LAPORAN STOK BARANG';
            const { doc, startY } = this.createPDF(title);

            const tableData = products.map((p, i) => {
                const isCritical = p.currentStock <= (p.minStock || 0);
                return [
                    i + 1,
                    p.sku || '-',
                    p.name,
                    p.category || '-',
                    p.currentStock,
                    p.minStock || 0,
                    p.unit || '-',
                    'Rp ' + this.formatCurrency(p.buyPrice),
                    'Rp ' + this.formatCurrency(p.currentStock * (p.buyPrice || 0)),
                    isCritical ? 'KRITIS' : 'Aman'
                ];
            });

            const totalValue = products.reduce((sum, p) => sum + (p.currentStock * (p.buyPrice || 0)), 0);
            const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);

            doc.autoTable({
                startY: startY,
                head: [['No', 'SKU', 'Nama Produk', 'Kategori', 'Stok', 'Min', 'Unit', 'Harga Beli', 'Nilai', 'Status']],
                body: tableData,
                foot: [['', '', '', 'TOTAL', totalStock, '', '', '', 'Rp ' + this.formatCurrency(totalValue), '']],
                headStyles: { fillColor: [15, 23, 42] },
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 3 },
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

            const fileName = `Laporan_Stok_${new Date().getTime()}.pdf`;
            this.downloadPDF(doc, fileName);
            App.showToast('Laporan Stok berhasil diunduh!');
        } catch (error) {
            console.error('generateStock error:', error);
            App.showToast('Gagal membuat laporan stok', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Reports.init(), 100);
});
