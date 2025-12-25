/**
 * Firebase Storage Service - Firestore wrapper for inventory data
 */
const StorageFirebase = {
    db: null,
    currentUser: null,

    // Initialize Firebase
    async init() {
        try {
            // Initialize Firebase App
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.firestore();

            // Check for saved session
            const savedUser = localStorage.getItem('inventory_current_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
            }

            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            return false;
        }
    },

    // Generate ID
    generateId() {
        return this.db.collection('_').doc().id;
    },

    // ==================== USERS ====================
    async getUsers() {
        try {
            const snapshot = await this.db.collection('users').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('getUsers error:', error);
            return [];
        }
    },

    async authenticate(username, password) {
        try {
            const snapshot = await this.db.collection('users')
                .where('username', '==', username)
                .where('password', '==', password)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const user = { id: doc.id, ...doc.data() };
                delete user.password;
                this.currentUser = user;
                localStorage.setItem('inventory_current_user', JSON.stringify(user));
                return user;
            }
            return null;
        } catch (error) {
            console.error('authenticate error:', error);
            return null;
        }
    },

    getCurrentUser() {
        return this.currentUser;
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('inventory_current_user');
    },

    // ==================== PRODUCTS ====================
    async getProducts() {
        try {
            const snapshot = await this.db.collection('products').get();
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client-side to avoid index requirement
            return products.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('getProducts error:', error);
            return [];
        }
    },

    async getProductById(id) {
        try {
            const doc = await this.db.collection('products').doc(id).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('getProductById error:', error);
            return null;
        }
    },

    async saveProduct(product) {
        try {
            if (product.id) {
                // Update existing
                await this.db.collection('products').doc(product.id).update(product);
            } else {
                // Create new
                product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                product.currentStock = product.currentStock || 0;
                const docRef = await this.db.collection('products').add(product);
                product.id = docRef.id;
            }
            return product;
        } catch (error) {
            console.error('saveProduct error:', error);
            return null;
        }
    },

    async deleteProduct(id) {
        try {
            await this.db.collection('products').doc(id).delete();
            return true;
        } catch (error) {
            console.error('deleteProduct error:', error);
            return false;
        }
    },

    async updateProductStock(productId, quantity, type) {
        try {
            const doc = await this.db.collection('products').doc(productId).get();
            if (doc.exists) {
                const product = doc.data();
                let newStock = product.currentStock || 0;
                if (type === 'IN') {
                    newStock += quantity;
                } else {
                    newStock -= quantity;
                }
                await this.db.collection('products').doc(productId).update({
                    currentStock: newStock
                });
            }
        } catch (error) {
            console.error('updateProductStock error:', error);
        }
    },

    // ==================== TRANSACTIONS ====================
    async getTransactions() {
        try {
            const snapshot = await this.db.collection('transactions').get();
            const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('getTransactions error:', error);
            return [];
        }
    },

    async saveTransaction(transaction) {
        try {
            transaction.date = transaction.date || new Date().toISOString();
            const docRef = await this.db.collection('transactions').add(transaction);
            transaction.id = docRef.id;

            // Update product stock
            await this.updateProductStock(transaction.productId, transaction.quantity, transaction.type);

            return transaction;
        } catch (error) {
            console.error('saveTransaction error:', error);
            return null;
        }
    },

    async getTransactionsByType(type) {
        try {
            const snapshot = await this.db.collection('transactions')
                .where('type', '==', type)
                .get();
            const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('getTransactionsByType error:', error);
            return [];
        }
    },

    async getRecentTransactions(days = 7) {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            // Get all and filter client-side to avoid index requirement
            const snapshot = await this.db.collection('transactions').get();
            const transactions = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(t => new Date(t.date) >= cutoff)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            return transactions;
        } catch (error) {
            console.error('getRecentTransactions error:', error);
            return [];
        }
    },

    // ==================== REQUESTS ====================
    async getRequests() {
        try {
            const snapshot = await this.db.collection('requests').get();
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('getRequests error:', error);
            return [];
        }
    },

    async getRequestsByStatus(status) {
        try {
            let snapshot;
            if (status === 'all') {
                snapshot = await this.db.collection('requests').get();
            } else {
                snapshot = await this.db.collection('requests')
                    .where('status', '==', status)
                    .get();
            }
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('getRequestsByStatus error:', error);
            return [];
        }
    },

    async getApprovedRequestsForProduct(productId) {
        try {
            const snapshot = await this.db.collection('requests')
                .where('productId', '==', productId)
                .where('status', '==', 'approved')
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('getApprovedRequestsForProduct error:', error);
            return [];
        }
    },

    async saveRequest(request) {
        try {
            if (request.id) {
                // Update
                await this.db.collection('requests').doc(request.id).update(request);
            } else {
                // Create
                request.status = 'pending';
                request.createdAt = new Date().toISOString();
                const docRef = await this.db.collection('requests').add(request);
                request.id = docRef.id;
            }
            return request;
        } catch (error) {
            console.error('saveRequest error:', error);
            return null;
        }
    },

    async updateRequestStatus(id, status) {
        try {
            const updates = { status };
            if (status === 'approved') {
                updates.approvedAt = new Date().toISOString();
            } else if (status === 'completed') {
                updates.completedAt = new Date().toISOString();
            }
            await this.db.collection('requests').doc(id).update(updates);
        } catch (error) {
            console.error('updateRequestStatus error:', error);
        }
    },

    // ==================== CALCULATIONS ====================
    async getCriticalStock() {
        try {
            const products = await this.getProducts();
            return products.filter(p => (p.currentStock || 0) <= (p.minStock || 0));
        } catch (error) {
            console.error('getCriticalStock error:', error);
            return [];
        }
    },

    async getTotalStockValue() {
        try {
            const products = await this.getProducts();
            return products.reduce((sum, p) => {
                return sum + ((p.currentStock || 0) * (p.buyPrice || 0));
            }, 0);
        } catch (error) {
            console.error('getTotalStockValue error:', error);
            return 0;
        }
    },

    async getInboundTotal(days = 7) {
        try {
            const recent = await this.getRecentTransactions(days);
            return recent.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
        } catch (error) {
            return 0;
        }
    },

    async getOutboundTotal(days = 7) {
        try {
            const recent = await this.getRecentTransactions(days);
            return recent.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
        } catch (error) {
            return 0;
        }
    },

    async getCategories() {
        try {
            const products = await this.getProducts();
            const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
            return categories;
        } catch (error) {
            return [];
        }
    },

    // ==================== DEMO DATA ====================
    async initDemoData() {
        try {
            // Check if data already exists
            const usersSnapshot = await this.db.collection('users').limit(1).get();
            if (!usersSnapshot.empty) {
                console.log('Demo data already exists');
                return;
            }

            console.log('Inserting demo data...');

            // Users
            const users = [
                { username: 'manager', password: 'manager123', displayName: 'Budi Manager', role: 'manager' },
                { username: 'admin', password: 'admin123', displayName: 'Siti Admin', role: 'admin' },
                { username: 'staff', password: 'staff123', displayName: 'Ahmad Staff', role: 'staff' }
            ];
            for (const user of users) {
                await this.db.collection('users').add({
                    ...user,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Products
            const products = [
                { name: 'Beras Premium 5kg', sku: 'BRS001', category: 'Sembako', unit: 'Karung', currentStock: 25, minStock: 10, buyPrice: 75000 },
                { name: 'Minyak Goreng 2L', sku: 'MYK001', category: 'Sembako', unit: 'Botol', currentStock: 8, minStock: 15, buyPrice: 35000 },
                { name: 'Gula Pasir 1kg', sku: 'GLA001', category: 'Sembako', unit: 'Kg', currentStock: 5, minStock: 20, buyPrice: 14000 },
                { name: 'Sabun Cuci 800ml', sku: 'SBN001', category: 'Kebersihan', unit: 'Botol', currentStock: 30, minStock: 10, buyPrice: 12000 },
                { name: 'Kopi Sachet', sku: 'KPI001', category: 'Minuman', unit: 'Box', currentStock: 12, minStock: 5, buyPrice: 45000 },
                { name: 'Teh Celup', sku: 'TEH001', category: 'Minuman', unit: 'Box', currentStock: 3, minStock: 8, buyPrice: 25000 }
            ];
            for (const product of products) {
                await this.db.collection('products').add({
                    ...product,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log('Demo data inserted successfully');
        } catch (error) {
            console.error('initDemoData error:', error);
        }
    }
};

// Alias for compatibility with existing code
const Storage = StorageFirebase;
