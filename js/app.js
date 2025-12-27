/**
 * Main Application Controller (Firebase Version)
 */
const App = {
    currentUser: null,
    currentPage: 'dashboard',
    isLoading: false,

    async init() {
        // Initialize Firebase
        await Storage.init();

        // Check for demo data
        await Storage.initDemoData();

        this.checkAuth();
        this.bindEvents();
        this.updateDate();
    },

    // ==================== AUTH ====================
    checkAuth() {
        const user = Storage.getCurrentUser();
        if (user) {
            this.currentUser = user;
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('register-screen').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
    },

    showRegister() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('register-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('register-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.updateUserInfo();
        this.updateSidebarByRole();
        this.navigateTo('dashboard');
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        const btn = e.target.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Loading...';

        const user = await Storage.authenticate(username, password);

        btn.disabled = false;
        btn.textContent = 'Masuk';

        if (user) {
            this.currentUser = user;
            errorEl.classList.add('hidden');
            this.showApp();
        } else {
            errorEl.textContent = 'Username atau password salah!';
            errorEl.classList.remove('hidden');
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const displayName = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        const errorEl = document.getElementById('register-error');
        const btn = e.target.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Loading...';

        try {
            await Storage.registerUser({
                displayName,
                username: email,
                password,
                role
            });

            this.showToast('Registrasi berhasil! Silakan masuk.');
            this.showLogin();

            // Clear form
            e.target.reset();
            errorEl.classList.add('hidden');
        } catch (error) {
            errorEl.textContent = error.message || 'Terjadi kesalahan saat registrasi';
            errorEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Daftar';
        }
    },

    handleLogout() {
        Storage.logout();
        this.currentUser = null;
        // Reset forms
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        this.showLogin();
    },

    updateUserInfo() {
        if (!this.currentUser) return;
        document.getElementById('user-name').textContent = this.currentUser.displayName;
        document.getElementById('user-role').textContent = this.currentUser.role;
        document.getElementById('user-avatar').textContent = this.currentUser.displayName.charAt(0).toUpperCase();
    },

    updateSidebarByRole() {
        const role = this.currentUser?.role;
        document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
            const allowedRoles = item.dataset.roles.split(',');
            if (allowedRoles.includes(role)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });

        const createRequestBtn = document.getElementById('btn-create-request');
        if (createRequestBtn) {
            if (role === 'admin') {
                createRequestBtn.classList.add('hidden');
            } else {
                createRequestBtn.classList.remove('hidden');
            }
        }
    },

    hasPermission(action) {
        const role = this.currentUser?.role;
        const permissions = {
            'manager': ['view_all', 'approve_request', 'view_products', 'view_inbound', 'view_outbound'],
            'admin': ['view_products', 'edit_products', 'input_inbound', 'input_outbound', 'view_requests'],
            'staff': ['input_outbound', 'create_request', 'view_dashboard']
        };
        return permissions[role]?.includes(action) || role === 'manager';
    },

    // ==================== NAVIGATION ====================
    navigateTo(page) {
        this.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
        });
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.remove('hidden');
        }

        const titles = {
            'dashboard': 'Dashboard',
            'products': 'Manajemen Produk',
            'inbound': 'Barang Masuk',
            'outbound': 'Penjualan',
            'requests': 'Pengajuan Barang',
            'reports': 'Laporan'
        };
        document.getElementById('page-title').textContent = titles[page] || page;

        this.loadPageData(page);

        document.getElementById('sidebar').classList.remove('open');
    },

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'products':
                await Products.load();
                break;
            case 'inbound':
                await Transactions.loadInbound();
                break;
            case 'outbound':
                await Transactions.loadOutbound();
                break;
            case 'requests':
                await Requests.load();
                break;
            case 'reports':
                Reports.init();
                break;
        }
    },

    // ==================== DASHBOARD ====================
    async loadDashboard() {
        // Stats
        const totalValue = await Storage.getTotalStockValue();
        document.getElementById('stat-total-value').textContent = this.formatCurrency(totalValue);

        const critical = await Storage.getCriticalStock();
        document.getElementById('stat-critical').textContent = critical.length;

        document.getElementById('stat-inbound').textContent = await Storage.getInboundTotal(7);
        document.getElementById('stat-outbound').textContent = await Storage.getOutboundTotal(7);

        // Critical Stock Table
        const tbody = document.getElementById('critical-stock-table');
        const noCritical = document.getElementById('no-critical');

        if (critical.length === 0) {
            tbody.innerHTML = '';
            noCritical.classList.remove('hidden');
        } else {
            noCritical.classList.add('hidden');
            tbody.innerHTML = critical.map(p => `
                <tr>
                    <td><strong>${this.escapeHtml(p.name)}</strong></td>
                    <td><span class="badge badge-danger">${p.currentStock}</span></td>
                    <td>${p.minStock}</td>
                    <td>${p.unit}</td>
                    <td>
                        <button class="action-btn request" onclick="Requests.showFormForProduct('${p.id}')" title="Buat Pengajuan">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Recent Transactions
        const transactions = await Storage.getTransactions();
        const recentTx = transactions.slice(0, 10);
        const txBody = document.getElementById('recent-transactions-table');

        const products = await Storage.getProducts();
        const productMap = products.reduce((map, p) => {
            map[p.id] = p;
            return map;
        }, {});

        const txRows = [];
        for (const t of recentTx) {
            const product = productMap[t.productId];
            txRows.push(`
                <tr>
                    <td>${this.formatDate(t.date, true)}</td>
                    <td>${product ? this.escapeHtml(product.name) : `<span class="text-muted">(ID: ${t.productId})</span>`}</td>
                    <td><span class="badge badge-${t.type.toLowerCase()}">${t.type === 'IN' ? 'Masuk' : 'Keluar'}</span></td>
                    <td>${t.quantity}</td>
                    <td>${this.escapeHtml(t.notes || '-')}</td>
                </tr>
            `);
        }
        txBody.innerHTML = txRows.join('');
    },

    // ==================== EVENTS ====================
    bindEvents() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        document.getElementById('to-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });

        document.getElementById('to-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) this.navigateTo(page);
            });
        });

        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    // ==================== MODAL ====================
    showModal(title, content) {
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="btn-icon" onclick="App.closeModal()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        `;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // ==================== TOAST ====================
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ==================== UTILITIES ====================
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateStr, includeTime = false) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (includeTime) {
            return date.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    },

    updateDate() {
        const now = new Date();
        document.getElementById('current-date').textContent = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async getProductOptions(selectedId = '') {
        const products = await Storage.getProducts();
        return products.map(p =>
            `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} (${p.currentStock} ${p.unit})</option>`
        ).join('');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
