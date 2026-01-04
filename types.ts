
export enum Role {
  USER = 'USER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN'
}

export enum ProductType {
  FABRIC = 'FABRIC',
  HARDWARE = 'HARDWARE'
}

export enum AvailabilityStatus {
  IN_STOCK = 'IN_STOCK',
  PREORDER = 'PREORDER',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}

export enum OrderStatus {
  ORDERED = 'ORDERED',
  CONFIRMED = 'CONFIRMED',
  PRODUCTION = 'PRODUCTION',
  TRANSIT = 'TRANSIT',
  WAREHOUSE = 'WAREHOUSE',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD'
}

export enum CatalogType {
  FABRIC = 'FABRIC',
  HARDWARE = 'HARDWARE'
}

export enum SearchLogType {
  TEXT = 'TEXT',
  PHOTO = 'PHOTO'
}

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SALARY = 'SALARY',
  LOGISTICS = 'LOGISTICS',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER'
}

export enum ReportType {
  SUPPLIER = 'SUPPLIER',
  CLIENTS = 'CLIENTS',
  CLIENT_LEDGER = 'CLIENT_LEDGER',
  SALES_ALL = 'SALES_ALL',
  SALES_FABRIC = 'SALES_FABRIC',
  SALES_HARDWARE = 'SALES_HARDWARE',
  EXPENSES = 'EXPENSES',
  INCOME = 'INCOME',
  INVENTORY = 'INVENTORY',
  SEARCH_LOGS = 'SEARCH_LOGS'
}

export interface MediaItem {
  type: 'image' | 'youtube';
  url: string;
  thumbUrl?: string;
}

export interface ProductVariant {
  id: string;      // "A", "B", "C"
  name: string;    // "Midnight Blue"
  color?: string;  // Hex Code like #000080
  stock: number;   // Specific stock for this variant
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  type: ProductType;
  category: string;
  price: number; // Selling Price
  currency: string;
  moq: number; // Stock MOQ
  factory_moq?: number; // New: Factory specific MOQ
  unit: string;
  status: AvailabilityStatus;
  available_qty: number; // Total combined stock or generic stock
  reserved_qty: number;
  media: MediaItem[];
  variants?: ProductVariant[]; // New: Array of color/design variants
  box_qty?: number;
  gsm?: number;
  width_cm?: number;
  
  // Internal Fields
  supplierName?: string;
  supplierWechat?: string;
  purchasePrice?: number; // Cost price
  logisticsCost?: number; // Cost to bring to warehouse
}

export interface CartItem {
  productId: string;
  quantity: number;
  stockQty?: number;
  factoryQty?: number;
  forceFactory?: boolean; 
  variantId?: string; // New: Selected Variant ID (e.g., "A")
  productSnapshot?: Product;
}

export interface PaymentProof {
  id: string;
  fileUrl?: string;
  fileName?: string;
  amount: number;
  method: PaymentMethod;
  timestamp: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface Order {
  id: string;
  userId: string;
  telegramId: string;
  username: string;
  userBrand: string;
  userPhone: string;
  status: OrderStatus;
  items: CartItem[];
  totalAmount: number;
  paidAmount: number;
  currency: string;
  createdAt: string;
  statusUpdatedAt: string;
  paymentProofs: PaymentProof[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  receiptUrl?: string;
}

export interface AppSettings {
  defaultLanguage: 'ru' | 'en' | 'ky';
  contact: {
    destinationValue: string;
    messageTemplate: string;
    managerName?: string;
    managerTG?: string;
    managerWA?: string;
  };
  globalMargin?: number;
}

export interface User {
  id: string;
  telegram_id: string;
  username: string;
  name: string;
  brand: string;
  phone: string;
  logoUrl?: string;
  role: Role;
  balance: number; // Positive = Overpaid, Negative = Debt
}

export interface SearchLog {
  id: string;
  userId: string;
  userName: string;
  type: SearchLogType;
  query?: string;
  photoBase64?: string;
  resultsCount: number;
  timestamp: string;
  metadata?: any;
}
