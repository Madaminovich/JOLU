
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { ProductCard } from './components/ProductCard';
import { MediaSlider } from './components/MediaSlider';
import { MOCK_PRODUCTS, MOCK_USER, MOCK_SETTINGS, I18N, FABRIC_CATEGORIES, HARDWARE_CATEGORIES, STATUS_COLORS, EXPENSE_CATEGORIES } from './constants';
import { Product, Role, CartItem, OrderStatus, Order, AvailabilityStatus, AppSettings, CatalogType, ProductType, MediaItem, SearchLogType, PaymentProof, User, PaymentMethod, Expense, ExpenseCategory, ReportType, SearchLog, ProductVariant } from './types';
import { findSimilarProducts } from './services/vectorService';
import { trackEvent, getDashboardStats, exportToCSV, generateClientLedger } from './services/analyticsService';
import { resizeImage } from './services/imageService';
import { analyzeProductImage } from './services/geminiService';
import { api } from './services/supabaseService';

const STORAGE_KEYS = {
  SETTINGS: 'shilu_v1_settings',
  FAVORITES: 'shilu_v1_favorites'
};

const ITEMS_PER_PAGE = 30;

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminPhotoInputRef = useRef<HTMLInputElement>(null);
  const adminPaymentPhotoInputRef = useRef<HTMLInputElement>(null);
  const expenseReceiptRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  
  // -- State --
  const [users, setUsers] = useState<User[]>([MOCK_USER]);
  const [currentUserId, setCurrentUserId] = useState<string>(MOCK_USER.id);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : MOCK_SETTINGS;
    } catch { return MOCK_SETTINGS; }
  });
  const [favorites, setFavorites] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
  });

  const [currentTab, setCurrentTab] = useState('catalog');
  const user = useMemo(() => users.find(u => u.id === currentUserId) || users[0], [users, currentUserId]);

  const [lang, setLang] = useState<'ru' | 'en' | 'ky'>(settings.defaultLanguage || 'ru');
  const [catalogType, setCatalogType] = useState<CatalogType | 'FAVORITES' | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isPhotoSearching, setIsPhotoSearching] = useState(false);
  const [lastPhotoSearch, setLastPhotoSearch] = useState<{ preview: string; similarIds: string[] } | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailQty, setDetailQty] = useState<number>(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [wantsFactoryOnly, setWantsFactoryOnly] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminMediaItems, setAdminMediaItems] = useState<MediaItem[]>([]);
  const [adminVariants, setAdminVariants] = useState<ProductVariant[]>([]);
  const [modalProductType, setModalProductType] = useState<ProductType>(ProductType.FABRIC);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [activeOrderForPayment, setActiveOrderForPayment] = useState<Order | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [pendingPaymentPhoto, setPendingPaymentPhoto] = useState<string | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseReceipt, setExpenseReceipt] = useState<string | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Set<ReportType>>(new Set());
  const [reportClient, setReportClient] = useState<string>('ALL');

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const t = I18N[lang];

  // -- Initialization --
  useEffect(() => {
    const init = async () => {
        try {
            const [p, o, u, e, l] = await Promise.all([
                api.getProducts(),
                api.getOrders(),
                api.getUsers(),
                api.getExpenses(),
                api.getSearchLogs()
            ]);
            
            setProducts(p.length > 0 ? p : MOCK_PRODUCTS); // Fallback to mock only if DB empty
            setOrders(o);
            setExpenses(e);
            setSearchLogs(l);

            if (u.length > 0) {
                // Ensure current mock user exists in DB or merge logic
                const currentUserExists = u.find(x => x.id === MOCK_USER.id);
                if (!currentUserExists) {
                    await api.upsertUser(MOCK_USER);
                    setUsers([...u, MOCK_USER]);
                } else {
                    setUsers(u);
                }
            } else {
                 await api.upsertUser(MOCK_USER);
                 setUsers([MOCK_USER]);
            }
        } catch (err) {
            console.error("Supabase init failed", err);
            // Fallback to mocks if no DB connection
            setProducts(MOCK_PRODUCTS);
            setUsers([MOCK_USER]);
        }
    };
    init();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Log Text Search
  useEffect(() => {
      if (debouncedSearch.length > 2) {
          const newLog: SearchLog = {
              id: `log-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              type: SearchLogType.TEXT,
              query: debouncedSearch,
              resultsCount: 0,
              timestamp: new Date().toISOString()
          };
          setSearchLogs(prev => [newLog, ...prev].slice(0, 100));
          api.createSearchLog(newLog);
      }
  }, [debouncedSearch]);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(favorites))), [favorites]);

  // Recalculate balance
  const syncUserBalance = async (userId: string, currentOrders: Order[]) => {
    const userOrders = currentOrders.filter(o => o.userId === userId && o.status !== OrderStatus.CANCELLED);
    const totalOrderValue = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = userOrders.reduce((sum, o) => sum + o.paidAmount, 0);
    const calculatedBalance = totalPaid - totalOrderValue;

    setUsers(prev => {
        const next = prev.map(u => u.id === userId ? { ...u, balance: calculatedBalance } : u);
        const updatedUser = next.find(u => u.id === userId);
        if (updatedUser) api.upsertUser(updatedUser);
        return next;
    });
  };

  const updateProductInventory = async (productId: string, qtyDelta: number, reserveDelta: number) => {
    setProducts(prev => {
        const next = prev.map(p => {
            if (p.id === productId) {
                const updated = {
                    ...p,
                    available_qty: Math.max(0, p.available_qty + qtyDelta),
                    reserved_qty: Math.max(0, p.reserved_qty + reserveDelta)
                };
                api.upsertProduct(updated); // Async update
                return updated;
            }
            return p;
        });
        return next;
    });
  };

  const resetFilters = useCallback(() => {
    if (lastPhotoSearch?.preview) URL.revokeObjectURL(lastPhotoSearch.preview);
    setLastPhotoSearch(null);
    setSearchQuery('');
    setDebouncedSearch('');
    setVisibleCount(ITEMS_PER_PAGE);
  }, [lastPhotoSearch]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (catalogType === 'FAVORITES') {
        list = list.filter(p => favorites.has(p.id));
    } else if (catalogType) {
        list = list.filter(p => p.type === (catalogType as unknown as ProductType));
    }

    if (lastPhotoSearch?.similarIds) {
      list = list.filter(p => lastPhotoSearch.similarIds.includes(p.id));
    } else if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return list;
  }, [products, debouncedSearch, catalogType, lastPhotoSearch, favorites]);

  const displayedProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  const toggleFavorite = (productId: string) => {
      setFavorites(prev => {
          const next = new Set(prev);
          if (next.has(productId)) next.delete(productId);
          else next.add(productId);
          return next;
      });
  };

  const handlePhotoSearch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsPhotoSearching(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      const compressedB64 = await resizeImage(file, 800);
      
      const detection = await analyzeProductImage(compressedB64);
      if (detection?.catalogType) {
        setCatalogType(detection.catalogType as CatalogType);
      }
      
      const similarIds = await findSimilarProducts(compressedB64, products, detection);
      setLastPhotoSearch({ preview: previewUrl, similarIds });
      
      const newLog: SearchLog = {
          id: `log-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          type: SearchLogType.PHOTO,
          photoBase64: `data:image/jpeg;base64,${compressedB64}`, // Note: Supabase text column might limit this size
          resultsCount: similarIds.length,
          timestamp: new Date().toISOString()
      };
      setSearchLogs(prev => [newLog, ...prev].slice(0, 50));
      api.createSearchLog(newLog);
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsPhotoSearching(false);
    }
  };

  const handleAddToCart = (product: Product, quantity: number, forceFactory: boolean = false) => {
    if (quantity < product.moq) return;
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
        alert(t.selectColor); 
        return;
    }
    setCart(prev => {
      const exists = prev.find(i => i.productId === product.id && i.variantId === selectedVariant?.id);
      if (exists) {
          return prev.map(i => (i.productId === product.id && i.variantId === selectedVariant?.id) ? { 
              ...i, 
              quantity: i.quantity + quantity,
              forceFactory: forceFactory || i.forceFactory 
          } : i);
      }
      return [...prev, { productId: product.id, quantity, forceFactory, variantId: selectedVariant?.id }];
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    const itemsWithSnapshots = cart.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      const variant = product.variants?.find(v => v.id === item.variantId);
      const available = variant ? variant.stock : (product.available_qty - product.reserved_qty);
      
      let stockQty = 0;
      let factoryQty = 0;

      if (item.forceFactory) {
          stockQty = 0;
          factoryQty = item.quantity;
      } else {
          stockQty = Math.min(item.quantity, Math.max(0, available));
          factoryQty = item.quantity - stockQty;
      }
      
      return {
        ...item,
        stockQty,
        factoryQty,
        productSnapshot: product
      };
    });

    const total = itemsWithSnapshots.reduce((acc, i) => {
        const basePrice = i.productSnapshot?.price || 0;
        const stockCost = (i.stockQty || 0) * basePrice;
        const factoryCost = (i.factoryQty || 0) * (basePrice * 0.97); 
        return acc + stockCost + factoryCost;
    }, 0);
    
    const newOrder: Order = {
      id: `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      userId: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      userBrand: user.brand,
      userPhone: user.phone,
      status: OrderStatus.ORDERED,
      items: itemsWithSnapshots,
      totalAmount: total,
      paidAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      statusUpdatedAt: new Date().toISOString(),
      paymentProofs: []
    };

    const nextOrders = [newOrder, ...orders];
    setOrders(nextOrders);
    setCart([]);
    setCurrentTab('profile');
    
    await api.upsertOrder(newOrder);
    syncUserBalance(user.id, nextOrders);
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== OrderStatus.ORDERED) return;
    
    const updatedOrder = { ...order, status: OrderStatus.CANCELLED, statusUpdatedAt: new Date().toISOString() };
    const nextOrders = orders.map(o => o.id === orderId ? updatedOrder : o);
    
    setOrders(nextOrders);
    await api.upsertOrder(updatedOrder);
    syncUserBalance(user.id, nextOrders);
  };

  const handleReorder = (order: Order) => {
    order.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
           setCart(prev => {
              const exists = prev.find(i => i.productId === item.productId && i.variantId === item.variantId);
              if (exists) {
                  return prev.map(i => (i.productId === item.productId && i.variantId === item.variantId) ? { 
                      ...i, 
                      quantity: i.quantity + item.quantity,
                      forceFactory: item.forceFactory 
                  } : i);
              }
              return [...prev, { productId: item.productId, quantity: item.quantity, forceFactory: item.forceFactory, variantId: item.variantId }];
            });
      }
    });
    setCurrentTab('cart');
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    // Inventory logic
    if ((newStatus === OrderStatus.CONFIRMED || newStatus === OrderStatus.PRODUCTION) && orderToUpdate.status === OrderStatus.ORDERED) {
      orderToUpdate.items.forEach(it => updateProductInventory(it.productId, -(it.stockQty || 0), 0));
    }
    if (newStatus === OrderStatus.CANCELLED && (orderToUpdate.status !== OrderStatus.ORDERED && orderToUpdate.status !== OrderStatus.CANCELLED)) {
      orderToUpdate.items.forEach(it => updateProductInventory(it.productId, (it.stockQty || 0), 0));
    }

    const updatedOrder = { ...orderToUpdate, status: newStatus, statusUpdatedAt: new Date().toISOString() };
    
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    await api.upsertOrder(updatedOrder);
    syncUserBalance(orderToUpdate.userId, orders.map(o => o.id === orderId ? updatedOrder : o));
  };

  const handleSavePayment = async (order: Order) => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    let updatedOrder = { ...order };
    let updatedProofs = [...order.paymentProofs];
    
    if (editingPaymentId) {
        updatedProofs = updatedProofs.map(p => p.id === editingPaymentId ? {
            ...p,
            amount: amount,
            method: paymentMethod,
            fileUrl: pendingPaymentPhoto || p.fileUrl
        } : p);
    } else {
        const newProof: PaymentProof = {
          id: `PAY-${Date.now()}`,
          amount: amount,
          method: paymentMethod,
          fileUrl: pendingPaymentPhoto || undefined,
          timestamp: new Date().toISOString(),
          status: 'APPROVED'
        };
        updatedProofs.push(newProof);
    }

    const newTotalPaid = updatedProofs.reduce((sum, p) => sum + p.amount, 0);
    updatedOrder.paidAmount = newTotalPaid;
    updatedOrder.paymentProofs = updatedProofs;

    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    setPaymentAmount('');
    setPaymentMethod(PaymentMethod.CASH);
    setPendingPaymentPhoto(null);
    setActiveOrderForPayment(null);
    setEditingPaymentId(null);
    
    await api.upsertOrder(updatedOrder);
    syncUserBalance(order.userId, orders.map(o => o.id === order.id ? updatedOrder : o));
  };

  const handleAdminPaymentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await resizeImage(file, 800);
      setPendingPaymentPhoto(`data:image/jpeg;base64,${b64}`);
    }
  };

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings: AppSettings = {
      ...settings,
      contact: {
        destinationValue: formData.get('manager') as string,
        messageTemplate: formData.get('template') as string,
        managerName: formData.get('managerName') as string,
        managerTG: formData.get('managerTG') as string,
        managerWA: formData.get('managerWA') as string,
      }
    };
    setSettings(newSettings);
    trackEvent('SettingsUpdated', newSettings);
  };

  const handleAdminMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: MediaItem[] = [];
    for (const file of files) {
      const b64 = await resizeImage(file, 800);
      const url = `data:image/jpeg;base64,${b64}`;
      newItems.push({ type: 'image', url, thumbUrl: url });
    }
    setAdminMediaItems(prev => [...prev, ...newItems]);
  };

  const handleAddVariant = () => {
      const nextLabel = String.fromCharCode(65 + adminVariants.length);
      const newVar: ProductVariant = {
          id: nextLabel,
          name: '',
          stock: 0,
          color: '#000000'
      };
      setAdminVariants([...adminVariants, newVar]);
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productUpdate: Partial<Product> = {
      title: formData.get('title') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      purchasePrice: parseFloat(formData.get('purchasePrice') as string),
      logisticsCost: parseFloat(formData.get('logisticsCost') as string),
      supplierName: formData.get('supplierName') as string,
      supplierWechat: formData.get('supplierWechat') as string,
      moq: parseInt(formData.get('moq') as string),
      factory_moq: parseInt(formData.get('factory_moq') as string) || undefined,
      category: formData.get('category') as string,
      gsm: formData.get('gsm') ? parseFloat(formData.get('gsm') as string) : undefined,
      width_cm: formData.get('width_cm') ? parseFloat(formData.get('width_cm') as string) : undefined,
      available_qty: parseInt(formData.get('available_qty') as string) || 0,
      variants: adminVariants.map((v, i) => ({
        ...v,
        name: formData.get(`var_name_${i}`) as string || v.id,
        stock: parseInt(formData.get(`var_stock_${i}`) as string) || 0,
        color: formData.get(`var_color_${i}`) as string
      })),
      type: modalProductType,
      media: [...adminMediaItems],
      unit: modalProductType === ProductType.FABRIC ? 'm' : 'pcs'
    };

    const youtubeId = formData.get('youtubeId') as string;
    if (youtubeId && youtubeId.length === 11) {
      productUpdate.media?.push({ type: 'youtube', url: youtubeId });
    }

    let savedProduct: Product;
    if (editingProduct) {
        savedProduct = { ...editingProduct, ...productUpdate } as Product;
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? savedProduct : p));
    } else {
        savedProduct = {
            ...productUpdate,
            id: `p-${Date.now()}`,
            status: AvailabilityStatus.IN_STOCK,
            reserved_qty: 0,
            currency: 'USD'
        } as Product;
        setProducts(prev => [savedProduct, ...prev]);
    }

    await api.upsertProduct(savedProduct);

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setAdminMediaItems([]);
    setAdminVariants([]);
  };

  const handleExpenseReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await resizeImage(file, 800);
      setExpenseReceipt(`data:image/jpeg;base64,${b64}`);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        title: formData.get('title') as string,
        amount: parseFloat(formData.get('amount') as string),
        category: formData.get('category') as ExpenseCategory,
        date: new Date().toISOString(),
        receiptUrl: expenseReceipt || undefined
    };
    setExpenses(prev => [newExpense, ...prev]);
    await api.createExpense(newExpense);
    
    setIsExpenseModalOpen(false);
    setExpenseReceipt(null);
  };

  const handleBatchDownload = async () => {
    const stats = getDashboardStats(orders, expenses);
    
    const download = (d: any[], n: string, t: string) => {
        exportToCSV(d, n, { lang, reportType: t });
    };
    
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    if (selectedReports.has(ReportType.SUPPLIER)) {
        download(stats.supplierReportData, 'supplier_report', 'SUPPLIER');
        await delay(500);
    }
    if (selectedReports.has(ReportType.CLIENTS)) {
        download(users, 'clients_list', 'CLIENTS');
        await delay(500);
    }
    if (selectedReports.has(ReportType.CLIENT_LEDGER)) {
        const ledgerData = generateClientLedger(orders, users, reportClient);
        download(ledgerData, `client_ledger_${reportClient === 'ALL' ? 'all' : reportClient}`, 'CLIENT_LEDGER');
        await delay(500);
    }
    if (selectedReports.has(ReportType.SALES_ALL)) {
        download(orders, 'sales_all', 'SALES_ALL');
        await delay(500);
    }
    if (selectedReports.has(ReportType.SALES_FABRIC)) {
        download(orders, 'sales_fabric', 'SALES_FABRIC');
        await delay(500);
    }
    if (selectedReports.has(ReportType.SALES_HARDWARE)) {
        download(orders, 'sales_hardware', 'SALES_HARDWARE');
        await delay(500);
    }
    if (selectedReports.has(ReportType.EXPENSES)) {
        download(expenses, 'expenses_report', 'EXPENSES');
        await delay(500);
    }
    if (selectedReports.has(ReportType.INCOME)) {
        download(orders, 'income_report', 'SALES_ALL');
        await delay(500);
    }
    if (selectedReports.has(ReportType.INVENTORY)) {
        download(products, 'inventory_stock', 'INVENTORY');
        await delay(500);
    }
    if (selectedReports.has(ReportType.SEARCH_LOGS)) {
        download(searchLogs.filter(l => l.type === SearchLogType.TEXT), 'search_logs', 'SEARCH_LOGS');
    }

    setIsReportsModalOpen(false);
  };

  const handleContactManager = () => {
    if (settings.contact.managerTG) {
      window.open(`https://t.me/${settings.contact.managerTG}`, '_blank');
    } else if (settings.contact.managerWA) {
      window.open(`https://wa.me/${settings.contact.managerWA.replace(/\D/g, '')}`, '_blank');
    }
  };

  const handleRoleSwitch = (newRole: Role) => {
    setUsers(prev => {
        const next = prev.map(u => u.id === currentUserId ? { ...u, role: newRole } : u);
        const updated = next.find(u => u.id === currentUserId);
        if(updated) api.upsertUser(updated);
        return next;
    });
    if (newRole === Role.USER) {
        if (currentTab.startsWith('admin-')) setCurrentTab('catalog');
        setCatalogType(null); 
    } else {
        if (!currentTab.startsWith('admin-')) setCurrentTab('admin-orders');
    }
  };

  const handleLangChange = (newLang: 'ru' | 'en' | 'ky') => {
    setLang(newLang);
    setSettings(prev => ({ ...prev, defaultLanguage: newLang }));
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const b64 = await resizeImage(file, 600);
        const newLogoUrl = `data:image/jpeg;base64,${b64}`;
        setUsers(prev => {
            const next = prev.map(u => u.id === currentUserId ? { ...u, logoUrl: newLogoUrl } : u);
            const updated = next.find(u => u.id === currentUserId);
            if(updated) api.upsertUser(updated);
            return next;
        });
    } catch (err) {
        console.error("Logo upload failed", err);
    }
  };

  // ... (Render Helpers like renderFullScreenImageViewer, renderProductDetail, etc. remain unchanged in logic)
  // Re-pasting them here for completeness to ensure valid file structure, though logic is identical to previous version.
  
  const renderFullScreenImageViewer = () => {
     if (!isImageViewerOpen || !selectedProduct) return null;
     return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col animate-fade-in">
            <button 
               onClick={() => setIsImageViewerOpen(false)} 
               className="absolute top-4 right-4 z-[210] w-10 h-10 bg-white/20 backdrop-blur-md rounded-full text-white flex items-center justify-center text-xl font-bold"
            >
               ✕
            </button>
            <div className="flex-1 w-full h-full">
               <MediaSlider 
                   media={selectedProduct.media} 
                   lang={lang} 
                   fitType="contain"
               />
            </div>
        </div>
     );
  };

  const renderProductDetail = () => {
    if (!selectedProduct) return null;
    const factoryMoq = selectedProduct.factory_moq || selectedProduct.moq || 0;
    const isFavorite = favorites.has(selectedProduct.id);

    let available = selectedProduct.available_qty - selectedProduct.reserved_qty;
    if (selectedProduct.variants && selectedProduct.variants.length > 0) {
        if (selectedVariant) available = selectedVariant.stock;
        else available = 0;
    }
    
    let stockPartQty = 0;
    let neededFromFactory = 0;

    if (wantsFactoryOnly) {
        stockPartQty = 0;
        neededFromFactory = detailQty;
    } else {
        stockPartQty = Math.min(detailQty, Math.max(0, available));
        neededFromFactory = Math.max(0, detailQty - available);
    }

    const factoryPrice = selectedProduct.price * 0.97;
    const totalCost = (stockPartQty * selectedProduct.price) + (neededFromFactory * factoryPrice);
    
    const baseCost = detailQty * selectedProduct.price;
    const savings = baseCost - totalCost;
    
    const hasVariants = selectedProduct.variants && selectedProduct.variants.length > 0;
    const isFactoryMoqMet = neededFromFactory === 0 || neededFromFactory >= factoryMoq;
    const canFullOrderFromFactory = detailQty >= factoryMoq;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setSelectedProduct(null)}>
          <div 
            className="bg-white w-full h-[96vh] sm:h-auto sm:max-w-lg rounded-t-[32px] sm:rounded-[40px] overflow-hidden flex flex-col relative animate-slide-up shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="relative w-full h-[35vh] bg-gray-100 flex-shrink-0">
                <MediaSlider 
                    media={selectedProduct.media} 
                    lang={lang} 
                    onMediaClick={() => setIsImageViewerOpen(true)}
                />
                <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 bg-black/20 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center text-xl z-20">✕</button>
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(selectedProduct.id); }}
                    className="absolute top-4 left-4 bg-white/80 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-xl z-20 shadow-sm transition-transform active:scale-95"
                >
                    <span className={isFavorite ? 'grayscale-0' : 'grayscale opacity-50'}>{isFavorite ? '❤️' : '🤍'}</span>
                </button>
             </div>
             <div className="flex-1 p-6 overflow-y-auto bg-white relative z-10 flex flex-col">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0" />
                {hasVariants && (
                    <div className="mb-6 flex-shrink-0">
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">{t.colorCard}</p>
                        <div className="flex flex-wrap gap-3">
                            {selectedProduct.variants?.map(v => {
                                const isSelected = selectedVariant?.id === v.id;
                                return (
                                    <button 
                                        key={v.id}
                                        onClick={() => { setSelectedVariant(v); setDetailQty(0); }} 
                                        className={`group relative flex flex-col items-center gap-1 transition-all ${isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                                    >
                                        <div 
                                            className={`w-10 h-10 rounded-full shadow-sm border-2 flex items-center justify-center text-[10px] font-bold ${isSelected ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200'}`}
                                            style={{ backgroundColor: v.color || '#eee' }}
                                        >
                                            <span className="bg-white/80 backdrop-blur-sm px-1 rounded-sm text-gray-900">{v.id}</span>
                                        </div>
                                        <span className={`text-[9px] font-bold max-w-[60px] truncate ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>{v.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {!selectedVariant && <p className="text-xs text-red-500 font-bold mt-2">← {t.selectColor}</p>}
                    </div>
                )}
                <div className="mb-4 flex-shrink-0">
                   <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
                       <button onClick={() => setWantsFactoryOnly(false)} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${!wantsFactoryOnly ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>{t.stockOrder} (FAST)</button>
                       <button onClick={() => setWantsFactoryOnly(true)} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${wantsFactoryOnly ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>🏭 FACTORY (-3%)</button>
                   </div>
                   {detailQty > 0 && (
                       <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-3 animate-slide-up shadow-sm">
                           <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-1">
                               <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">{t.totalEst}</p>
                               <p className="text-xl font-black text-blue-800">${totalCost.toFixed(2)}</p>
                           </div>
                           {stockPartQty > 0 && <div className="flex justify-between text-[10px] text-gray-600 font-medium"><span className="flex items-center gap-1">📦 {t.stockPart}: {stockPartQty} {selectedProduct.unit} x ${selectedProduct.price.toFixed(2)}</span><span className="font-bold text-gray-900">${(stockPartQty * selectedProduct.price).toFixed(2)}</span></div>}
                           {neededFromFactory > 0 && <div className="flex justify-between text-[10px] text-orange-600 font-bold"><span className="flex items-center gap-1">🏭 {t.factoryPart}: {neededFromFactory} {selectedProduct.unit} x ${factoryPrice.toFixed(2)}</span><span>${(neededFromFactory * factoryPrice).toFixed(2)}</span></div>}
                           {!isFactoryMoqMet && (
                               <div className="bg-red-50 border border-red-200 p-3 rounded-xl transition-all">
                                   <div className="mb-2"><p className="text-[10px] font-black text-red-600 uppercase mb-1">⚠️ {t.factoryMoqError}</p><p className="text-xs text-red-800 leading-snug">{t.factoryMoqDetail} <br/><span className="font-bold">Min: {factoryMoq} {selectedProduct.unit}</span>.</p></div>
                                   {canFullOrderFromFactory && (
                                       <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm">
                                           <button onClick={() => setWantsFactoryOnly(true)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-black uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><span>🏭 Order All from Factory</span><span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">-3%</span></button>
                                       </div>
                                   )}
                               </div>
                           )}
                           {savings > 0 && isFactoryMoqMet && <div className="bg-white/50 p-2 rounded-lg flex items-center justify-between border border-blue-100"><span className="text-[9px] font-black text-green-600 uppercase">✨ {t.yourSavings}</span><span className="text-xs font-black text-green-600">${savings.toFixed(2)}</span></div>}
                       </div>
                   )}
                </div>
                <div className="flex justify-between items-start mb-3 flex-shrink-0">
                   <div>
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{selectedProduct.category}</p>
                      <h2 className="text-2xl font-black text-gray-900 leading-tight mt-1">{selectedProduct.title}</h2>
                      {selectedVariant && <span className="inline-block mt-1 bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600">Selected: {selectedVariant.id} - {selectedVariant.name}</span>}
                   </div>
                   <div className="text-right"><p className="text-3xl font-black text-blue-600">${selectedProduct.price.toFixed(2)}</p><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{selectedProduct.unit}</p></div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto mb-4"><p className="text-sm sm:text-base text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{selectedProduct.description}</p></div>
                <div className="space-y-4 mb-20 flex-shrink-0">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.sku}</p><p className="text-sm font-bold text-gray-800">{selectedProduct.sku}</p></div>
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase">{t.inStock}</p><p className={`text-sm font-bold ${available > 0 ? 'text-green-600' : 'text-orange-500'}`}>{hasVariants && !selectedVariant ? '-' : available} {selectedProduct.unit}</p></div>
                   </div>
                   {selectedProduct.type === ProductType.FABRIC && (
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.gsm}</p><p className="text-sm font-bold text-gray-800">{selectedProduct.gsm || '-'}</p></div>
                         <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.width}</p><p className="text-sm font-bold text-gray-800">{selectedProduct.width_cm || '-'} cm</p></div>
                      </div>
                   )}
                </div>
             </div>
             <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex gap-4 z-20">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
                   <button onClick={() => setDetailQty(Math.max(0, detailQty - 10))} className="text-xl font-black text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">−</button>
                   <div className="text-center w-20"><input type="number" className="w-full bg-transparent text-center text-lg font-black text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-300" placeholder="0" value={detailQty > 0 ? detailQty.toString() : ''} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setDetailQty(val); else setDetailQty(0); }} /><span className="block text-[7px] font-black text-gray-400 uppercase tracking-widest">MOQ: {selectedProduct.moq}</span></div>
                   <button onClick={() => setDetailQty(detailQty + 10)} className="text-xl font-black text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">+</button>
                </div>
                <button 
                  onClick={() => { handleAddToCart(selectedProduct, detailQty, wantsFactoryOnly); setSelectedProduct(null); setWantsFactoryOnly(false); }}
                  disabled={detailQty < selectedProduct.moq || (hasVariants && !selectedVariant) || !isFactoryMoqMet}
                  className="flex-1 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
                >
                   {t.addToCart}
                </button>
             </div>
          </div>
        </div>
    );
  };

  const renderReceiptViewer = () => {
    if (!viewingReceiptUrl) return null;
    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingReceiptUrl(null)}>
           <button className="absolute top-4 right-4 text-white text-2xl font-bold p-2 bg-white/20 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
           <img src={viewingReceiptUrl} className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} alt="Receipt" />
        </div>
    );
  };

  const renderOrderList = (list: Order[]) => {
    return (
        <div className="space-y-3">
            {list.map(order => {
                const isExpanded = expandedOrderId === order.id;
                const toggle = () => setExpandedOrderId(isExpanded ? null : order.id);
                return (
                    <div key={order.id} className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out">
                        <div onClick={toggle} className="p-4 flex items-center justify-between cursor-pointer bg-white active:bg-gray-50 transition-colors">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{order.id} • {new Date(order.createdAt).toLocaleDateString()}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-gray-900">${order.totalAmount.toFixed(2)}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${STATUS_COLORS[order.status] || 'bg-gray-400'}`}>{order.status}</span>
                                </div>
                                {order.paidAmount < order.totalAmount ? (
                                    <span className="text-[9px] font-bold text-orange-500">Unpaid: ${(order.totalAmount - order.paidAmount).toFixed(2)}</span>
                                ) : (
                                    <span className="text-[9px] font-bold text-green-500">Fully Paid</span>
                                )}
                            </div>
                            <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}><span className="text-gray-400 text-xl">▼</span></div>
                        </div>
                        {isExpanded && (
                            <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-4 animate-slide-up">
                                {user.role === Role.ADMIN && (
                                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.checkCustomer}</h4>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2"><span className="text-green-500 text-sm">✓</span><span className="text-xs font-bold text-gray-900">{order.userBrand}</span></div>
                                            <div className="flex items-center gap-2"><span className="text-green-500 text-sm">✓</span><span className="text-xs font-bold text-gray-900">{order.username}</span></div>
                                            <div className="flex items-center gap-2"><span className="text-green-500 text-sm">✓</span><span className="text-xs font-bold text-gray-900">{order.userPhone}</span></div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {order.items.map((item, idx) => {
                                         const snap = item.productSnapshot;
                                         if(!snap) return null;
                                         const basePrice = snap.price;
                                         const factoryPrice = basePrice * 0.97;
                                         const stockQty = item.stockQty || 0;
                                         const factoryQty = item.factoryQty || 0;
                                         const variant = snap.variants?.find(v => v.id === item.variantId);
                                         const itemSavings = factoryQty * (basePrice - factoryPrice);
                                         return (
                                             <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3">
                                                 <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden"><img src={snap.media?.[0]?.thumbUrl || snap.media?.[0]?.url} className="w-full h-full object-cover" alt="prev"/></div>
                                                 <div className="flex-1 min-w-0">
                                                     <div className="flex justify-between items-start mb-1">
                                                         <div><p className="text-[10px] font-bold text-gray-900 line-clamp-1">{snap.title}</p><p className="text-[9px] font-bold text-gray-400">{snap.sku}</p>{variant && <p className="text-[8px] font-bold text-blue-500">Var: {variant.id} ({variant.name})</p>}</div>
                                                     </div>
                                                     <div className="space-y-1 mt-2 pt-2 border-t border-gray-50">
                                                        {stockQty > 0 && <div className="flex justify-between items-center text-[9px]"><span className="font-bold text-gray-600">Stock: {stockQty} {snap.unit} @ ${basePrice.toFixed(2)}</span><span className="font-black text-gray-900">${(stockQty * basePrice).toFixed(2)}</span></div>}
                                                        {factoryQty > 0 && <div className="flex justify-between items-center text-[9px]"><span className="font-bold text-orange-600">Factory: {factoryQty} {snap.unit} @ ${factoryPrice.toFixed(2)}</span><span className="font-black text-gray-900">${(factoryQty * factoryPrice).toFixed(2)}</span></div>}
                                                        {itemSavings > 0 && <div className="flex justify-end mt-1"><span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t.yourSavings}: ${itemSavings.toFixed(2)}</span></div>}
                                                     </div>
                                                 </div>
                                             </div>
                                         )
                                    })}
                                </div>
                                <div className="flex gap-2">
                                   {user.role === Role.ADMIN ? (
                                       <select value={order.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)} className="flex-1 bg-white border border-gray-200 text-xs font-bold rounded-xl py-3 px-3 shadow-sm">
                                            {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                       </select>
                                   ) : (
                                      <>
                                        {order.status === OrderStatus.ORDERED && <button onClick={() => handleCancelOrder(order.id)} className="flex-1 bg-white border border-red-100 text-red-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-red-50 transition-colors">{t.cancel}</button>}
                                        <button onClick={() => handleReorder(order)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-200 active:scale-95 transition-all">{t.reorder}</button>
                                      </>
                                   )}
                                </div>
                                <div className="pt-2 border-t border-gray-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{t.amountPaid}</span>
                                            <span className={`text-xs font-black ${order.paidAmount >= order.totalAmount ? 'text-green-500' : 'text-orange-500'}`}>${order.paidAmount.toFixed(2)} / ${order.totalAmount.toFixed(2)}</span>
                                        </div>
                                        {user.role === Role.ADMIN && order.paidAmount < order.totalAmount && (
                                             <button onClick={(e) => { e.stopPropagation(); setEditingPaymentId(null); setPaymentAmount(''); setPendingPaymentPhoto(null); setActiveOrderForPayment(order); }} className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-transform">+ Payment</button>
                                        )}
                                        {activeOrderForPayment?.id === order.id && (
                                             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { e.stopPropagation(); setActiveOrderForPayment(null); setEditingPaymentId(null); }}>
                                                 <div className="bg-white w-full max-w-sm p-6 rounded-[32px] space-y-4" onClick={(e) => e.stopPropagation()}>
                                                     <h3 className="text-lg font-black text-gray-900">{editingPaymentId ? 'Edit Payment' : t.recordPayment}</h3>
                                                     <input type="number" placeholder="Amount" className="w-full bg-gray-50 border-none rounded-xl p-3 font-bold text-lg" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                                                     <div className="flex gap-2">
                                                        {[PaymentMethod.CASH, PaymentMethod.TRANSFER, PaymentMethod.CARD].map(m => (
                                                            <button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${paymentMethod === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{m}</button>
                                                        ))}
                                                     </div>
                                                     <div onClick={() => adminPaymentPhotoInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 gap-2 cursor-pointer hover:bg-gray-50 transition-colors">
                                                        {pendingPaymentPhoto ? <img src={pendingPaymentPhoto} className="h-20 object-contain rounded-lg" alt="Proof" /> : <><span className="text-2xl">📷</span><span className="text-[10px] font-bold uppercase">{t.uploadCheck}</span></>}
                                                        <input ref={adminPaymentPhotoInputRef} type="file" className="hidden" accept="image/*" onChange={handleAdminPaymentPhotoUpload} />
                                                     </div>
                                                     <button onClick={() => handleSavePayment(order)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase shadow-lg shadow-blue-200">{t.save}</button>
                                                 </div>
                                             </div>
                                        )}
                                    </div>
                                    {order.paymentProofs && order.paymentProofs.length > 0 && (
                                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.paymentHistory}</p>
                                             <div className="space-y-2">
                                               {order.paymentProofs.map(proof => (
                                                 <div key={proof.id} className="flex justify-between items-center text-xs border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex flex-col"><span className="text-gray-900 font-black">${proof.amount.toFixed(2)}</span><span className="text-gray-400 text-[9px] font-bold">{new Date(proof.timestamp).toLocaleDateString()}</span></div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[8px] font-bold uppercase">{proof.method}</span>
                                                        {proof.fileUrl && <button onClick={() => setViewingReceiptUrl(proof.fileUrl || null)} className="text-blue-600 font-bold text-[9px] uppercase border border-blue-100 bg-white px-2 py-1 rounded-lg shadow-sm hover:bg-blue-50 transition-colors">📎 {t.viewReceipt}</button>}
                                                        {user.role === Role.ADMIN && <button onClick={(e) => { e.stopPropagation(); setActiveOrderForPayment(order); setEditingPaymentId(proof.id); setPaymentAmount(proof.amount.toString()); setPaymentMethod(proof.method); setPendingPaymentPhoto(proof.fileUrl || null); }} className="text-gray-400 hover:text-blue-600 text-sm p-1">✏️</button>}
                                                    </div>
                                                 </div>
                                               ))}
                                             </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
  };

  const renderProductModal = () => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
           <form onSubmit={handleSaveProduct} className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] p-6 space-y-4 relative">
              <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-black text-gray-900">{editingProduct ? t.edit : t.add} Product</h2>
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
              </div>
              <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setModalProductType(ProductType.FABRIC)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${modalProductType === ProductType.FABRIC ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t.fabrics}</button>
                  <button type="button" onClick={() => setModalProductType(ProductType.HARDWARE)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${modalProductType === ProductType.HARDWARE ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t.hardware}</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <input name="sku" defaultValue={editingProduct?.sku} placeholder={t.sku} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                  <input name="title" defaultValue={editingProduct?.title} placeholder={t.title} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              </div>
              <textarea name="description" defaultValue={editingProduct?.description} placeholder={t.description} className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold resize-none h-20"/>
              <div className="grid grid-cols-3 gap-3">
                 <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} placeholder={t.price} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                 <input name="purchasePrice" type="number" step="0.01" defaultValue={editingProduct?.purchasePrice} placeholder={t.purchasePrice} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                 <input name="logisticsCost" type="number" step="0.01" defaultValue={editingProduct?.logisticsCost} placeholder={t.logistics} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <input name="supplierName" defaultValue={editingProduct?.supplierName} placeholder={t.supplier} className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                  <input name="supplierWechat" defaultValue={editingProduct?.supplierWechat} placeholder={t.supplierWechat} className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <input name="moq" type="number" defaultValue={editingProduct?.moq} placeholder={t.minOrder} required className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                  <input name="factory_moq" type="number" defaultValue={editingProduct?.factory_moq} placeholder={t.factoryMinOrder} className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              </div>
              <div className="flex gap-2 items-center">
                  {isCustomCategory ? (
                      <input name="category" defaultValue={editingProduct?.category} placeholder={t.category} className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" autoFocus />
                  ) : (
                      <select name="category" defaultValue={editingProduct?.category} className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-xs font-bold">
                          {(modalProductType === ProductType.FABRIC ? FABRIC_CATEGORIES : HARDWARE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  )}
                  <button type="button" onClick={() => setIsCustomCategory(!isCustomCategory)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-colors ${isCustomCategory ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'}`}>{isCustomCategory ? '✕' : '+'}</button>
              </div>
              {modalProductType === ProductType.FABRIC && (
                  <div className="grid grid-cols-2 gap-4">
                      <input name="gsm" type="number" defaultValue={editingProduct?.gsm} placeholder={t.gsm} className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                      <input name="width_cm" type="number" defaultValue={editingProduct?.width_cm} placeholder={t.width} className="bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                  </div>
              )}
              <input name="available_qty" type="number" defaultValue={editingProduct?.available_qty} placeholder={t.availableQty} className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl">
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-gray-400">{t.variant}s</span><button type="button" onClick={handleAddVariant} className="text-[10px] font-bold text-blue-600">+ {t.addVariant}</button></div>
                  {adminVariants.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                          <input type="color" name={`var_color_${i}`} defaultValue={v.color} className="w-8 h-8 rounded overflow-hidden border-none p-0" />
                          <input name={`var_name_${i}`} defaultValue={v.name} placeholder="Name" className="flex-1 bg-white border-none rounded-lg p-2 text-xs" />
                          <input name={`var_stock_${i}`} type="number" defaultValue={v.stock} placeholder="Stock" className="w-20 bg-white border-none rounded-lg p-2 text-xs" />
                          <button type="button" onClick={() => setAdminVariants(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 px-2">×</button>
                      </div>
                  ))}
              </div>
              <div onClick={() => adminPhotoInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 gap-1 cursor-pointer hover:bg-gray-50 transition-colors">
                 <span className="text-2xl">🖼️</span><span className="text-[10px] font-bold uppercase">Upload Images</span>
                 <input ref={adminPhotoInputRef} type="file" multiple className="hidden" accept="image/*" onChange={handleAdminMediaUpload} />
              </div>
              <input name="youtubeId" placeholder={t.youtubeLink} className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
              <div className="flex gap-2 overflow-x-auto pb-2">
                 {adminMediaItems.map((m, idx) => (
                     <div key={idx} className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 relative overflow-hidden group">
                         <img src={m.thumbUrl || m.url} className="w-full h-full object-cover" alt="prev"/>
                         <button type="button" onClick={() => setAdminMediaItems(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs">×</button>
                     </div>
                 ))}
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-200">{t.save}</button>
           </form>
        </div>
    );
  };

  const renderExpenseModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
        <form onSubmit={handleSaveExpense} className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-4">
             <h2 className="text-xl font-black text-gray-900">{t.addExpense}</h2>
             <input name="title" placeholder={t.title} required className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
             <input name="amount" type="number" step="0.01" placeholder={t.amount} required className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
             <select name="category" className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
             <div onClick={() => expenseReceiptRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 gap-1 cursor-pointer hover:bg-gray-50 transition-colors">
                 {expenseReceipt ? <img src={expenseReceipt} className="h-20 object-contain" alt="Receipt" /> : <><span className="text-2xl">🧾</span><span className="text-[10px] font-bold uppercase">{t.uploadCheck}</span></>}
                 <input ref={expenseReceiptRef} type="file" className="hidden" accept="image/*" onChange={handleExpenseReceiptUpload} />
              </div>
             <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase">{t.cancel}</button>
                 <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase shadow-lg shadow-blue-200">{t.save}</button>
             </div>
        </form>
    </div>
  );

  const renderReportsModal = () => {
    const reportOptions = [
        { id: ReportType.SUPPLIER, label: t.rep_supplier },
        { id: ReportType.CLIENTS, label: t.rep_clients },
        { id: ReportType.CLIENT_LEDGER, label: t.rep_client_ledger },
        { id: ReportType.SALES_ALL, label: t.rep_sales_all },
        { id: ReportType.SALES_FABRIC, label: t.rep_sales_fabric },
        { id: ReportType.SALES_HARDWARE, label: t.rep_sales_hardware },
        { id: ReportType.EXPENSES, label: t.rep_expenses },
        { id: ReportType.INCOME, label: t.rep_income },
        { id: ReportType.INVENTORY, label: t.rep_inventory },
        { id: ReportType.SEARCH_LOGS, label: t.rep_search_logs },
    ];
    const toggleReport = (id: ReportType) => {
        const next = new Set(selectedReports);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedReports(next);
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto">
               <div className="flex justify-between items-center"><h2 className="text-xl font-black text-gray-900">{t.reports}</h2><button onClick={() => setIsReportsModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button></div>
               <div>
                   <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">{t.selectClient}</label>
                   <select value={reportClient} onChange={(e) => setReportClient(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold">
                       <option value="ALL">{t.allClients}</option>
                       {users.filter(u => u.role === Role.USER).map(u => <option key={u.id} value={u.id}>{u.name} ({u.brand})</option>)}
                   </select>
               </div>
               <p className="text-xs text-gray-400 font-bold">{t.selectReports}</p>
               <div className="space-y-2">{reportOptions.map(opt => (
                   <button key={opt.id} onClick={() => toggleReport(opt.id)} className={`w-full p-3 rounded-xl flex items-center justify-between transition-colors ${selectedReports.has(opt.id) ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-gray-50 border border-transparent text-gray-600'}`}><span className="text-xs font-bold text-left">{opt.label}</span>{selectedReports.has(opt.id) && <span className="text-blue-600">✓</span>}</button>
               ))}</div>
               <div className="flex gap-2 pt-2"><button onClick={() => setSelectedReports(new Set())} className="px-4 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-black uppercase">{t.reset}</button><button onClick={handleBatchDownload} disabled={selectedReports.size === 0} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black uppercase shadow-lg disabled:opacity-50">Download ({selectedReports.size})</button></div>
           </div>
        </div>
    );
  };

  const renderExpenseDetailModal = () => {
     if (!viewingExpense) return null;
     return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingExpense(null)}>
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start"><div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.expenseDetails}</p><h2 className="text-xl font-black text-gray-900 mt-1">{viewingExpense.title}</h2></div><button onClick={() => setViewingExpense(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button></div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                    <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-[9px] font-bold text-gray-400 uppercase">{t.amount}</p><p className="text-lg font-black text-gray-900">${viewingExpense.amount.toFixed(2)}</p></div>
                        <div><p className="text-[9px] font-bold text-gray-400 uppercase">{t.date}</p><p className="text-sm font-bold text-gray-900">{new Date(viewingExpense.date).toLocaleDateString()}</p></div>
                        <div><p className="text-[9px] font-bold text-gray-400 uppercase">{t.category}</p><p className="text-sm font-bold text-gray-900">{viewingExpense.category}</p></div>
                    </div>
                </div>
                {viewingExpense.receiptUrl && <div className="rounded-xl overflow-hidden border border-gray-100"><img src={viewingExpense.receiptUrl} className="w-full object-contain" alt="Receipt" /></div>}
            </div>
        </div>
     );
  };

  const renderAnalysisOverlay = () => {
     if (!isPhotoSearching) return null;
     return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white animate-fade-in">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
           <p className="text-lg font-black tracking-widest uppercase animate-pulse">{t.analyzing}</p>
           <p className="text-xs text-white/50 font-bold mt-2">{t.analyzingText}</p>
        </div>
     );
  };

  const renderFullContent = () => {
      switch (currentTab) {
      case 'catalog':
        return (
          <div className="space-y-6 pb-24">
            <div className="flex gap-2 relative z-20">
              <div className="flex-1 relative"><input type="text" placeholder={t.searchPlaceholder} className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-blue-100 placeholder-gray-300 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /><span className="absolute left-3.5 top-3.5 text-gray-300">🔍</span></div>
              <button onClick={() => fileInputRef.current?.click()} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${lastPhotoSearch ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-gray-400'}`}>📷</button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSearch} />
            </div>
            {lastPhotoSearch && (
               <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between animate-slide-up">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100"><img src={lastPhotoSearch.preview} className="w-full h-full object-cover" alt="Search" /></div><div><p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Visual Search</p><p className="text-xs font-bold text-gray-700">{filteredProducts.length} matches found</p></div></div>
                  <button onClick={resetFilters} className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-lg">✕</button>
               </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               <button onClick={() => setCatalogType(null)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${!catalogType ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' : 'bg-white text-gray-400'}`}>All</button>
               <button onClick={() => setCatalogType('FAVORITES')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all flex items-center gap-1 ${catalogType === 'FAVORITES' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-white text-gray-400'}`}>❤️ {t.favorites}</button>
               <button onClick={() => setCatalogType(CatalogType.FABRIC)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${catalogType === CatalogType.FABRIC ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-gray-400'}`}>{t.fabrics}</button>
               <button onClick={() => setCatalogType(CatalogType.HARDWARE)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${catalogType === CatalogType.HARDWARE ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-white text-gray-400'}`}>{t.hardware}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
               {displayedProducts.map(p => {
                 const inCart = cart.find(c => c.productId === p.id);
                 return <ProductCard key={p.id} product={p} lang={lang} currentQtyInCart={inCart?.quantity} isFavorite={favorites.has(p.id)} onClick={(prod) => { setSelectedProduct(prod); setDetailQty(0); setWantsFactoryOnly(false); setSelectedVariant(null); }} onAddToCart={(prod, qty) => handleAddToCart(prod, qty)} onToggleFavorite={(prod) => toggleFavorite(prod.id)} />;
               })}
            </div>
            {visibleCount < filteredProducts.length && <button onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)} className="w-full py-3 bg-white text-gray-400 text-xs font-black uppercase rounded-2xl shadow-sm">Load More</button>}
          </div>
        );

      case 'cart':
        const cartTotal = cart.reduce((sum, item) => {
            const p = products.find(p => p.id === item.productId);
            if (!p) return sum;
            const available = p.available_qty - p.reserved_qty;
            let stockQty = 0;
            let factoryQty = 0;
            if (item.forceFactory) {
                stockQty = 0;
                factoryQty = item.quantity;
            } else {
                stockQty = Math.min(item.quantity, Math.max(0, available));
                factoryQty = item.quantity - stockQty;
            }
            return sum + (stockQty * p.price) + (factoryQty * (p.price * 0.97));
        }, 0);
        return (
          <div className="pb-24">
            <h1 className="text-2xl font-black text-gray-900 mb-6 px-1">{t.cart}</h1>
            {cart.length === 0 ? <div className="flex flex-col items-center justify-center py-20 opacity-50"><span className="text-6xl mb-4">🛒</span><p className="font-bold text-gray-400">{t.cartEmpty}</p></div> : (
               <div className="space-y-4">
                  {cart.map(item => {
                     const p = products.find(p => p.id === item.productId);
                     if (!p) return null;
                     const available = p.available_qty - p.reserved_qty;
                     const variant = p.variants?.find(v => v.id === item.variantId);
                     let stockQty = 0;
                     let factoryQty = 0;
                     if (item.forceFactory) {
                        stockQty = 0;
                        factoryQty = item.quantity;
                     } else {
                        stockQty = Math.min(item.quantity, Math.max(0, available));
                        factoryQty = item.quantity - stockQty;
                     }
                     const basePrice = p.price;
                     const savings = factoryQty * (basePrice * 0.03);

                     return (
                       <div key={`${item.productId}-${item.variantId}`} className="bg-white p-3 rounded-[24px] flex gap-3 shadow-sm border border-gray-100">
                          <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0"><img src={p.media[0]?.thumbUrl || p.media[0]?.url} className="w-full h-full object-cover" alt="item" /></div>
                          <div className="flex-1 flex flex-col justify-center py-1">
                             <div><h3 className="text-[10px] font-bold text-gray-800 line-clamp-1">{p.title}</h3><p className="text-[9px] font-black text-gray-300 uppercase">{p.sku}</p>{variant && <p className="text-[9px] font-bold text-blue-500">Color: {variant.id} ({variant.name})</p>}</div>
                             <div className="space-y-1">
                                {stockQty > 0 && <p className="text-[8px] text-gray-500 font-bold flex justify-between"><span>{t.stockPart}: {stockQty}</span> <span>${(stockQty * p.price).toFixed(2)}</span></p>}
                                {factoryQty > 0 && <p className="text-[8px] text-orange-500 font-bold flex justify-between"><span>{t.factoryPart}: {factoryQty}</span> <span>${(factoryQty * p.price * 0.97).toFixed(2)}</span></p>}
                                {savings > 0 && <p className="text-[8px] font-black text-green-600 flex justify-end"><span className="bg-green-50 px-1 rounded">{t.yourSavings}: ${savings.toFixed(2)}</span></p>}
                             </div>
                          </div>
                          <div className="flex flex-col justify-between items-end py-1"><button onClick={() => setCart(prev => prev.filter(x => !(x.productId === item.productId && x.variantId === item.variantId)))} className="text-gray-300 hover:text-red-500">×</button><div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1"><span className="text-[10px] font-black">{item.quantity} {p.unit}</span></div></div>
                       </div>
                     );
                  })}
                  <div className="fixed bottom-24 left-6 right-6 z-30"><div className="bg-gray-900 text-white p-4 rounded-[24px] shadow-xl flex items-center justify-between shadow-gray-300/50"><div className="flex flex-col px-2"><span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.totalEst}</span><span className="text-xl font-black">${cartTotal.toFixed(2)}</span></div><button onClick={handleCheckout} className="bg-white text-gray-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">{t.checkout}</button></div></div>
               </div>
            )}
          </div>
        );
      
      case 'profile':
        return (
          <div className="space-y-6 pb-24">
             <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                 <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-md">{user.logoUrl ? <img src={user.logoUrl} className="w-full h-full object-cover" alt="logo" /> : <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>}</div>
                    <button onClick={() => profileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md">✏️</button>
                    <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                 </div>
                 <div><h2 className="text-xl font-black text-gray-900">{user.brand || user.name}</h2><p className="text-xs font-bold text-gray-400">{user.username}</p><p className="text-xs font-bold text-gray-400">{user.phone}</p></div>
             </div>
             <div className="bg-gray-900 text-white p-6 rounded-[32px] shadow-xl shadow-gray-200">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{t.balance}</p>
                 <div className="flex justify-between items-end"><p className={`text-3xl font-black ${user.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>${Math.abs(user.balance).toFixed(2)}<span className="text-xs align-top ml-1 opacity-60">{user.balance < 0 ? t.debt : t.overpayment}</span></p><button onClick={handleContactManager} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors">{t.managerContact}</button></div>
             </div>
             <div>
                 <h3 className="text-lg font-black text-gray-900 mb-4 px-2">{t.orderHistory}</h3>
                 {renderOrderList(orders.filter(o => o.userId === user.id))}
                 {orders.filter(o => o.userId === user.id).length === 0 && <div className="text-center py-10 opacity-50"><span className="text-4xl block mb-2">📦</span><p className="text-sm font-bold text-gray-400">{t.historyEmpty}</p></div>}
             </div>
             <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                 <h3 className="text-lg font-black text-gray-900 mb-4">{t.settings}</h3>
                 <button onClick={() => handleRoleSwitch(Role.ADMIN)} className="w-full bg-white border border-gray-200 p-4 rounded-xl text-left shadow-sm flex justify-between items-center group"><span className="font-bold text-gray-700">{t.switchRole} (Dev)</span><span className="text-gray-300 group-hover:text-blue-600 transition-colors">→</span></button>
             </div>
          </div>
        );

      case 'admin-orders':
          return (
              <div className="pb-24">
                  <h1 className="text-2xl font-black text-gray-900 mb-6 px-1">{t.orders}</h1>
                  {renderOrderList(orders)}
              </div>
          );

      case 'admin-products':
          return (
              <div className="pb-24">
                  <div className="flex justify-between items-center mb-6 px-1">
                      <h1 className="text-2xl font-black text-gray-900">{t.stock}</h1>
                      <button onClick={() => { setEditingProduct(null); setAdminMediaItems([]); setAdminVariants([]); setIsProductModalOpen(true); setIsCustomCategory(false); }} className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-transform text-xl font-bold">+</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      {products.map(p => (
                          <ProductCard 
                              key={p.id} 
                              product={p} 
                              lang={lang} 
                              isAdmin 
                              onClick={() => { setSelectedProduct(p); setDetailQty(0); }}
                              onAddToCart={() => {}}
                              onEdit={(prod) => {
                                  setEditingProduct(prod);
                                  setAdminMediaItems(prod.media || []);
                                  setAdminVariants(prod.variants || []);
                                  setModalProductType(prod.type);
                                  const cats = prod.type === ProductType.FABRIC ? FABRIC_CATEGORIES : HARDWARE_CATEGORIES;
                                  setIsCustomCategory(!cats.includes(prod.category));
                                  setIsProductModalOpen(true);
                              }}
                          />
                      ))}
                  </div>
              </div>
          );

      case 'admin-dashboard':
          const stats = getDashboardStats(orders, expenses);
          return (
              <div className="pb-24 space-y-6">
                   <h1 className="text-2xl font-black text-gray-900 px-1">{t.stats}</h1>
                   <div className="grid grid-cols-2 gap-4">
                       <div className="bg-blue-600 text-white p-5 rounded-[24px] shadow-lg shadow-blue-200"><p className="text-[10px] font-black uppercase opacity-60 mb-1">{t.revenue}</p><p className="text-2xl font-black">${stats.revenue.toFixed(2)}</p></div>
                       <div className="bg-green-500 text-white p-5 rounded-[24px] shadow-lg shadow-green-200"><p className="text-[10px] font-black uppercase opacity-60 mb-1">{t.netProfit}</p><p className="text-2xl font-black">${stats.netProfit.toFixed(2)}</p></div>
                       <div className="bg-white border border-gray-100 p-5 rounded-[24px]"><p className="text-[10px] font-black uppercase text-gray-400 mb-1">{t.avgCheck}</p><p className="text-xl font-black text-gray-900">${stats.avgCheck.toFixed(2)}</p></div>
                       <div className="bg-white border border-gray-100 p-5 rounded-[24px]"><p className="text-[10px] font-black uppercase text-gray-400 mb-1">{t.expenses}</p><p className="text-xl font-black text-red-500">-${stats.totalExpenses.toFixed(2)}</p></div>
                   </div>
                   <button onClick={() => setIsReportsModalOpen(true)} className="w-full bg-gray-900 text-white p-5 rounded-[24px] flex justify-between items-center shadow-lg"><span className="font-bold">{t.reportsCenter}</span><span className="text-2xl">📊</span></button>
                   <div>
                       <div className="flex justify-between items-center mb-4 px-1"><h3 className="text-lg font-black text-gray-900">{t.expenses}</h3><button onClick={() => setIsExpenseModalOpen(true)} className="text-[10px] font-bold bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600">+ {t.add}</button></div>
                       <div className="space-y-2">
                           {expenses.slice(0, 5).map(exp => (
                               <div key={exp.id} onClick={() => setViewingExpense(exp)} className="bg-white p-3 rounded-2xl border border-gray-100 flex justify-between items-center">
                                   <div><p className="text-xs font-bold text-gray-900">{exp.title}</p><p className="text-[9px] font-bold text-gray-400">{new Date(exp.date).toLocaleDateString()} • {exp.category}</p></div>
                                   <span className="text-sm font-black text-gray-900">-${exp.amount.toFixed(2)}</span>
                               </div>
                           ))}
                       </div>
                   </div>
              </div>
          );

      case 'admin-settings':
          return (
              <div className="pb-24">
                  <h1 className="text-2xl font-black text-gray-900 mb-6 px-1">{t.settings}</h1>
                  <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-[32px] border border-gray-100 space-y-4 shadow-sm">
                      <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t.managerContact}</label>
                          <input name="managerName" defaultValue={settings.contact.managerName} placeholder="Manager Name" className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold mb-2" />
                          <input name="managerTG" defaultValue={settings.contact.managerTG} placeholder="Telegram Username (no @)" className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold mb-2" />
                          <input name="managerWA" defaultValue={settings.contact.managerWA} placeholder="WhatsApp Number" className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs font-bold" />
                      </div>
                      <button type="button" onClick={() => handleRoleSwitch(Role.USER)} className="w-full bg-red-50 text-red-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">{t.clientView}</button>
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">{t.save}</button>
                  </form>
              </div>
          );

      default:
        return null;
    }
  };

  return (
    <Layout userRole={user.role} currentTab={currentTab} onTabChange={setCurrentTab} lang={lang} onLangChange={handleLangChange}>
        {renderFullContent()}
        {isProductModalOpen && renderProductModal()}
        {isExpenseModalOpen && renderExpenseModal()}
        {isReportsModalOpen && renderReportsModal()}
        {viewingExpense && renderExpenseDetailModal()}
        {selectedProduct && renderProductDetail()}
        {viewingReceiptUrl && renderReceiptViewer()}
        {isImageViewerOpen && renderFullScreenImageViewer()}
        {isPhotoSearching && renderAnalysisOverlay()}
    </Layout>
  );
};

export default App;
