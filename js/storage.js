/**
 * Storage Service - LocalStorage wrapper for inventory data
 */
const Storage = {
    // Keys
    KEYS: {
        PRODUCTS: 'inventory_products',
        TRANSACTIONS: 'inventory_transactions',
        REQUESTS: 'inventory_requests',
        USERS: 'inventory_users',
        CURRENT_USER: 'inventory_current_user'
    },

    // Initialize with demo data if empty
    init() {
        if (!this.getUsers().length) {
            this.initDemoData();
        }
    },

    // Generic get/set
    get(key) {
        try {
            // localStorage.getItem(key) adalah perintah hubung ke browser
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    },

    set(key, data) {
        // localStorage.setItem(key, ...) adalah perintah simpan ke browser
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Generate UUID
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // ==================== USERS ====================
    getUsers() {
        return this.get(this.KEYS.USERS);
    },

    authenticate(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            const { password: _, ...safeUser } = user;
            this.set(this.KEYS.CURRENT_USER, safeUser);
            return safeUser;
        }
        return null;
    },

    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem(this.KEYS.CURRENT_USER));
        } catch {
            return null;
        }
    },

    logout() {
        // localStorage.removeItem adalah perintah hapus dari browser
        localStorage.removeItem(this.KEYS.CURRENT_USER);
    },

    // ==================== PRODUCTS ====================
    getProducts() {
        return this.get(this.KEYS.PRODUCTS);
    },

    getProductById(id) {
        return this.getProducts().find(p => p.id === id);
    },

    saveProduct(product) {
        const products = this.getProducts();
        if (product.id) {
            const index = products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                products[index] = { ...products[index], ...product };
            }
        } else {
            product.id = this.generateId();
            product.currentStock = product.currentStock || 0;
            product.createdAt = new Date().toISOString();
            products.push(product);
        }
        this.set(this.KEYS.PRODUCTS, products);
        return product;
    },

    deleteProduct(id) {
        const products = this.getProducts().filter(p => p.id !== id);
        this.set(this.KEYS.PRODUCTS, products);
    },

    updateProductStock(productId, quantity, type) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === productId);
        if (index !== -1) {
            if (type === 'IN') {
                products[index].currentStock += quantity;
            } else {
                products[index].currentStock -= quantity;
            }
            this.set(this.KEYS.PRODUCTS, products);
        }
    },

    // ==================== TRANSACTIONS ====================
    getTransactions() {
        return this.get(this.KEYS.TRANSACTIONS);
    },

    saveTransaction(transaction) {
        const transactions = this.getTransactions();
        transaction.id = this.generateId();
        transaction.date = transaction.date || new Date().toISOString();
        transactions.unshift(transaction); // Add to beginning
        this.set(this.KEYS.TRANSACTIONS, transactions);

        // Update product stock
        this.updateProductStock(transaction.productId, transaction.quantity, transaction.type);

        return transaction;
    },

    getTransactionsByType(type) {
        return this.getTransactions().filter(t => t.type === type);
    },

    getRecentTransactions(days = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return this.getTransactions().filter(t => new Date(t.date) >= cutoff);
    },

    // ==================== REQUESTS ====================
    getRequests() {
        return this.get(this.KEYS.REQUESTS);
    },

    getRequestsByStatus(status) {
        if (status === 'all') return this.getRequests();
        return this.getRequests().filter(r => r.status === status);
    },

    getApprovedRequestsForProduct(productId) {
        return this.getRequests().filter(r =>
            r.productId === productId && r.status === 'approved'
        );
    },

    saveRequest(request) {
        const requests = this.getRequests();
        if (request.id) {
            const index = requests.findIndex(r => r.id === request.id);
            if (index !== -1) {
                requests[index] = { ...requests[index], ...request };
            }
        } else {
            request.id = this.generateId();
            request.status = 'pending';
            request.createdAt = new Date().toISOString();
            requests.unshift(request);
        }
        this.set(this.KEYS.REQUESTS, requests);
        return request;
    },

    updateRequestStatus(id, status) {
        const requests = this.getRequests();
        const index = requests.findIndex(r => r.id === id);
        if (index !== -1) {
            requests[index].status = status;
            if (status === 'approved') {
                requests[index].approvedAt = new Date().toISOString();
            } else if (status === 'completed') {
                requests[index].completedAt = new Date().toISOString();
            }
            this.set(this.KEYS.REQUESTS, requests);
        }
    },

    // ==================== CALCULATIONS ====================
    getCriticalStock() {
        return this.getProducts().filter(p => p.currentStock <= p.minStock);
    },

    getTotalStockValue() {
        return this.getProducts().reduce((sum, p) => {
            return sum + (p.currentStock * (p.buyPrice || 0));
        }, 0);
    },

    getInboundTotal(days = 7) {
        const recent = this.getRecentTransactions(days);
        return recent.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
    },

    getOutboundTotal(days = 7) {
        const recent = this.getRecentTransactions(days);
        return recent.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
    },

    getCategories() {
        const products = this.getProducts();
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        return categories;
    },

    // ==================== DEMO DATA ====================
    initDemoData() {
        // Users
        const users = [
            { id: 'u1', username: 'manager', password: 'manager123', role: 'manager', displayName: 'Kades Manager' },
            { id: 'u2', username: 'admin', password: 'admin123', role: 'admin', displayName: 'Agung Admin' },
            { id: 'u3', username: 'staff', password: 'staff123', role: 'staff', displayName: 'Tegar Staff' }
        ];
        this.set(this.KEYS.USERS, users); //untuk menyimpan data ke local storage

        // Products
        const products = [
            { id: 'p1', name: 'Beras Premium 5kg', sku: 'BRS001', category: 'Sembako', unit: 'Karung', currentStock: 25, minStock: 10, buyPrice: 75000 },
            { id: 'p2', name: 'Minyak Goreng 2L', sku: 'MYK001', category: 'Sembako', unit: 'Botol', currentStock: 8, minStock: 15, buyPrice: 35000 },
            { id: 'p3', name: 'Gula Pasir 1kg', sku: 'GLA001', category: 'Sembako', unit: 'Kg', currentStock: 5, minStock: 20, buyPrice: 14000 },
            { id: 'p4', name: 'Sabun Cuci 800ml', sku: 'SBN001', category: 'Kebersihan', unit: 'Botol', currentStock: 30, minStock: 10, buyPrice: 12000 },
            { id: 'p5', name: 'Kopi Sachet', sku: 'KPI001', category: 'Minuman', unit: 'Box', currentStock: 12, minStock: 5, buyPrice: 45000 },
            { id: 'p6', name: 'Teh Celup', sku: 'TEH001', category: 'Minuman', unit: 'Box', currentStock: 3, minStock: 8, buyPrice: 25000 }
        ];
        this.set(this.KEYS.PRODUCTS, products); //untuk menyimpan data ke local storage

        // Transactions
        const now = new Date();
        const transactions = [
            { id: 't1', productId: 'p1', type: 'IN', quantity: 50, date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), notes: 'PT. Beras Makmur' },
            { id: 't2', productId: 'p1', type: 'OUT', quantity: 25, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Penjualan retail', sellPrice: 85000 },
            { id: 't3', productId: 'p2', type: 'IN', quantity: 20, date: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Distributor ABC' },
            { id: 't4', productId: 'p2', type: 'OUT', quantity: 12, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Warung Pak Joko', sellPrice: 42000 },
            { id: 't5', productId: 'p4', type: 'IN', quantity: 30, date: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), notes: 'PT. Bersih Cemerlang' }
        ];
        this.set(this.KEYS.TRANSACTIONS, transactions); //untuk menyimpan data ke local storage

        // Requests
        const requests = [
            { id: 'r1', productId: 'p3', quantity: 30, status: 'pending', requesterName: 'Ahmad Staff', reason: 'Stok gula tinggal 5kg, perlu restock untuk minggu depan', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() },
            { id: 'r2', productId: 'p2', quantity: 24, status: 'approved', requesterName: 'Ahmad Staff', reason: 'Minyak goreng hampir habis', createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), approvedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() }
        ];
        this.set(this.KEYS.REQUESTS, requests); //untuk menyimpan data ke local storage
    }
};

// Initialize on load
Storage.init();
