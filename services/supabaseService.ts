
import { supabase } from './supabaseClient';
import { Product, Order, User, Expense, SearchLog, ProductType, AvailabilityStatus, Role, ExpenseCategory } from '../types';

// --- Mappers ---

const mapProductFromDB = (row: any): Product => ({
  ...row,
  purchasePrice: row.purchase_price,
  logisticsCost: row.logistics_cost,
  supplierName: row.supplier_name,
  supplierWechat: row.supplier_wechat,
  width_cm: row.width_cm, // matches type, kept for clarity
  available_qty: row.available_qty,
  reserved_qty: row.reserved_qty,
  factory_moq: row.factory_moq,
  // JSONB fields come back as objects automatically
  media: row.media || [],
  variants: row.variants || []
});

const mapProductToDB = (p: Product) => ({
  id: p.id,
  sku: p.sku,
  title: p.title,
  description: p.description,
  type: p.type,
  category: p.category,
  price: p.price,
  currency: p.currency,
  moq: p.moq,
  factory_moq: p.factory_moq,
  unit: p.unit,
  status: p.status,
  available_qty: p.available_qty,
  reserved_qty: p.reserved_qty,
  media: p.media,
  variants: p.variants,
  gsm: p.gsm,
  width_cm: p.width_cm,
  supplier_name: p.supplierName,
  supplier_wechat: p.supplierWechat,
  purchase_price: p.purchasePrice,
  logistics_cost: p.logisticsCost
});

const mapOrderFromDB = (row: any): Order => ({
  id: row.id,
  userId: row.user_id,
  telegramId: row.telegram_id,
  username: row.username,
  userBrand: row.user_brand,
  userPhone: row.user_phone,
  status: row.status,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  currency: row.currency,
  createdAt: row.created_at,
  statusUpdatedAt: row.status_updated_at,
  items: row.items || [],
  paymentProofs: row.payment_proofs || []
});

const mapOrderToDB = (o: Order) => ({
  id: o.id,
  user_id: o.userId,
  telegram_id: o.telegramId,
  username: o.username,
  user_brand: o.userBrand,
  user_phone: o.userPhone,
  status: o.status,
  total_amount: o.totalAmount,
  paid_amount: o.paidAmount,
  currency: o.currency,
  created_at: o.createdAt,
  status_updated_at: o.statusUpdatedAt,
  items: o.items,
  payment_proofs: o.paymentProofs
});

const mapUserFromDB = (row: any): User => ({
  id: row.id,
  telegram_id: row.telegram_id,
  username: row.username,
  name: row.name,
  brand: row.brand,
  phone: row.phone,
  logoUrl: row.logo_url,
  role: row.role as Role,
  balance: row.balance
});

const mapUserToDB = (u: User) => ({
  id: u.id,
  telegram_id: u.telegram_id,
  username: u.username,
  name: u.name,
  brand: u.brand,
  phone: u.phone,
  logo_url: u.logoUrl,
  role: u.role,
  balance: u.balance
});

const mapExpenseFromDB = (row: any): Expense => ({
  id: row.id,
  title: row.title,
  amount: row.amount,
  category: row.category as ExpenseCategory,
  date: row.date,
  receiptUrl: row.receipt_url
});

const mapExpenseToDB = (e: Expense) => ({
  id: e.id,
  title: e.title,
  amount: e.amount,
  category: e.category,
  date: e.date,
  receipt_url: e.receiptUrl
});

// --- Services ---

export const api = {
  // AUTH
  async loginOrRegister(telegramUser: any): Promise<User> {
    const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', String(telegramUser.id)).single();
    
    if (existingUser) {
        // Update info if changed
        const updated = {
            ...existingUser,
            username: telegramUser.username || existingUser.username,
            name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || existingUser.name
        };
        await supabase.from('users').update({
            username: updated.username,
            name: updated.name
        }).eq('id', existingUser.id);
        return mapUserFromDB(updated);
    } else {
        // Create new user
        const newUser: User = {
            id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            telegram_id: String(telegramUser.id),
            username: telegramUser.username || '',
            name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'New User',
            brand: 'New Brand',
            phone: '',
            role: Role.USER, // Default role
            balance: 0
        };
        await api.upsertUser(newUser);
        return newUser;
    }
  },

  // PRODUCTS
  async getProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProductFromDB);
  },

  async upsertProduct(product: Product) {
    const { error } = await supabase.from('products').upsert(mapProductToDB(product));
    if (error) throw error;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  // ORDERS
  async getOrders() {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapOrderFromDB);
  },

  async upsertOrder(order: Order) {
    const { error } = await supabase.from('orders').upsert(mapOrderToDB(order));
    if (error) throw error;
  },

  // USERS
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return (data || []).map(mapUserFromDB);
  },

  async upsertUser(user: User) {
    const { error } = await supabase.from('users').upsert(mapUserToDB(user));
    if (error) throw error;
  },
  
  async deleteUser(userId: string) {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
  },

  // EXPENSES
  async getExpenses() {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapExpenseFromDB);
  },

  async createExpense(expense: Expense) {
    const { error } = await supabase.from('expenses').insert(mapExpenseToDB(expense));
    if (error) throw error;
  },

  // SEARCH LOGS
  async getSearchLogs() {
    const { data, error } = await supabase.from('search_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) throw error;
    return (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        type: row.type,
        query: row.query,
        resultsCount: row.results_count,
        timestamp: row.timestamp
    }));
  },

  async createSearchLog(log: SearchLog) {
    const dbRow = {
        id: log.id,
        user_id: log.userId,
        user_name: log.userName,
        type: log.type,
        query: log.query || (log.type === 'PHOTO' ? 'PHOTO_SEARCH' : ''),
        results_count: log.resultsCount,
        timestamp: log.timestamp
    };
    const { error } = await supabase.from('search_logs').insert(dbRow);
    if (error) console.error("Failed to log search", error);
  }
};
