
import { Order, OrderStatus, ProductType, SearchLog, Expense, User } from '../types';

type Lang = 'ru' | 'en' | 'ky';

const CSV_I18N: Record<Lang, Record<string, string>> = {
  ru: {
    orderId: '№ заказа',
    date: 'Дата',
    client: 'Клиент',
    brand: 'Бренд',
    status: 'Статус',
    sku: 'Артикул',
    product: 'Товар',
    qty: 'Кол-во',
    unit: 'Ед.',
    price: 'Цена продажи',
    purchasePrice: 'Закупка (Cost)',
    logistics: 'Логистика (Unit)',
    profit: 'Прибыль',
    itemTotal: 'Сумма позиции',
    orderTotal: 'Итого заказа',
    paid: 'Оплачено',
    remaining: 'Остаток долга',
    supplier: 'Поставщик',
    supplierWechat: 'WeChat',
    phone: 'Телефон',
    balance: 'Баланс',
    category: 'Категория',
    title: 'Название',
    amount: 'Сумма',
    revenue: 'Выручка',
    available: 'Доступно',
    reserved: 'Резерв',
    query: 'Запрос',
    results: 'Найдено',
    type: 'Тип',
    description: 'Описание',
    debit: 'Дебет (Долг)',
    credit: 'Кредит (Оплата)',
    running_balance: 'Текущий баланс',
    transaction_type: 'Тип операции',

    status_confirmed: 'Подтверждён',
    status_in_progress: 'В процессе',
    status_delivered: 'Доставлен',
    status_cancelled: 'Отменён',
    status_submitted: 'Отправлен',
    status_draft: 'Черновик'
  },
  en: {
    orderId: 'Order ID',
    date: 'Date',
    client: 'Client',
    brand: 'Brand',
    status: 'Status',
    sku: 'SKU',
    product: 'Product',
    qty: 'Qty',
    unit: 'Unit',
    price: 'Price',
    purchasePrice: 'Purchase Price (Cost)',
    logistics: 'Logistics (Unit)',
    profit: 'Profit',
    itemTotal: 'Item Total',
    orderTotal: 'Order Total',
    paid: 'Paid',
    remaining: 'Remaining',
    supplier: 'Supplier',
    supplierWechat: 'WeChat',
    phone: 'Phone',
    balance: 'Balance',
    category: 'Category',
    title: 'Title',
    amount: 'Amount',
    revenue: 'Revenue',
    available: 'Available',
    reserved: 'Reserved',
    query: 'Query',
    results: 'Results',
    type: 'Type',
    description: 'Description',
    debit: 'Debit (Debt)',
    credit: 'Credit (Payment)',
    running_balance: 'Running Balance',
    transaction_type: 'Tx Type',

    status_confirmed: 'Confirmed',
    status_in_progress: 'In progress',
    status_delivered: 'Delivered',
    status_cancelled: 'Cancelled',
    status_submitted: 'Submitted',
    status_draft: 'Draft'
  },
  ky: {
    orderId: 'Заказ №',
    date: 'Күнү',
    client: 'Кардар',
    brand: 'Бренд',
    status: 'Абалы',
    sku: 'Артикул',
    product: 'Товар',
    qty: 'Саны',
    unit: 'Өлч.',
    price: 'Баа',
    purchasePrice: 'Сатып алуу (Cost)',
    logistics: 'Логистика (Unit)',
    profit: 'Пайда',
    itemTotal: 'Позиция суммасы',
    orderTotal: 'Заказдын суммасы',
    paid: 'Төлөндү',
    remaining: 'Калган карыз',
    supplier: 'Поставщик',
    supplierWechat: 'WeChat',
    phone: 'Телефон',
    balance: 'Баланс',
    category: 'Категория',
    title: 'Аты',
    amount: 'Сумма',
    revenue: 'Түшүм',
    available: 'Жеткиликтүү',
    reserved: 'Резерв',
    query: 'Сурам',
    results: 'Табылды',
    type: 'Түрү',
    description: 'Сүрөттөмө',
    debit: 'Дебет (Карыз)',
    credit: 'Кредит (Төлөм)',
    running_balance: 'Учурдагы баланс',
    transaction_type: 'Операция түрү',

    status_confirmed: 'Тастыкталды',
    status_in_progress: 'Процессте',
    status_delivered: 'Жеткирилди',
    status_cancelled: 'Жокко чыгарылды',
    status_submitted: 'Жөнөтүлдү',
    status_draft: 'Каралама'
  }
};

const getCsvConfig = (lang: Lang) => {
  const delimiter = lang === 'en' ? ',' : ';';
  const decimalComma = lang !== 'en';
  return { delimiter, decimalComma };
};

const formatNumber = (val: any, lang: Lang, digits = 2) => {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return lang === 'en' ? '0.00' : '0,00';
  const s = n.toFixed(digits);
  return lang === 'en' ? s : s.replace('.', ',');
};

const formatDate = (iso: any, lang: Lang) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (lang !== 'en') {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}.${mm}.${yy}`;
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  return `${mm}/${dd}/${yy}`;
};

const escapeCell = (val: any, delimiter: string) => {
  const s = String(val ?? '');
  const mustQuote =
    s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
  const safe = s.replace(/"/g, '""');
  return mustQuote ? `"${safe}"` : safe;
};

const localizeStatus = (status: any, lang: Lang) => {
  const t = CSV_I18N[lang];
  const s = String(status ?? '').toUpperCase();
  if (s.includes('CANCEL')) return t.status_cancelled;
  if (s.includes('DRAFT')) return t.status_draft;
  if (s.includes('SUBMIT') || s.includes('CREATED') || s.includes('PENDING')) return t.status_submitted;
  if (s.includes('CONFIRM') || s.includes('APPROV')) return t.status_confirmed;
  if (s.includes('DELIVER') || s.includes('DONE') || s.includes('COMPLET')) return t.status_delivered;
  if (s.includes('PROGRESS') || s.includes('SHIP') || s.includes('TRANSIT') || s.includes('FACTORY') || s.includes('PRODUC')) return t.status_in_progress;
  return status ?? '';
};

export const exportToCSV = (
  data: any[],
  filename: string,
  options?: { reportType?: string; lang?: Lang }
) => {
  if (!data || data.length === 0) return;

  const lang: Lang = options?.lang ?? 'ru';
  const { delimiter } = getCsvConfig(lang);
  const t = CSV_I18N[lang];
  const rows: string[] = [];
  const type = options?.reportType;

  if (type === 'SUPPLIER') {
    // Supplier Report
    const headers = [t.supplier, t.supplierWechat, t.brand, t.sku, t.qty, t.client, t.purchasePrice];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(row => {
        const line = [
            row.supplierName,
            row.supplierWechat,
            row.userBrand,
            row.sku,
            row.qty,
            row.username,
            formatNumber(row.purchasePrice, lang)
        ];
        rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type === 'CLIENTS') {
    // Clients List
    const headers = [t.client, t.brand, t.phone, t.balance, 'Telegram ID'];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(u => {
      const line = [u.name, u.brand, u.phone, formatNumber(u.balance, lang), u.telegram_id];
      rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type === 'CLIENT_LEDGER') {
    // Ledger
    const headers = [t.date, t.client, t.transaction_type, t.description, t.debit, t.credit, t.running_balance, t.orderId];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(tr => {
        const line = [
            formatDate(tr.date, lang),
            tr.clientName,
            tr.type,
            tr.description,
            formatNumber(tr.debit, lang),
            formatNumber(tr.credit, lang),
            formatNumber(tr.runningBalance, lang),
            tr.orderId
        ];
        rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type === 'EXPENSES') {
    // Expenses
    const headers = [t.date, t.title, t.category, t.amount];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(e => {
      const line = [formatDate(e.date, lang), e.title, e.category, formatNumber(e.amount, lang)];
      rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type === 'INVENTORY') {
    // Inventory
    const headers = [t.sku, t.title, t.category, t.price, t.available, t.reserved, t.unit];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(p => {
      const line = [p.sku, p.title, p.category, formatNumber(p.price, lang), p.available_qty, p.reserved_qty, p.unit];
      rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type === 'SEARCH_LOGS') {
    // Search Logs
    const headers = [t.date, t.client, t.type, t.query, t.results];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(l => {
      const line = [formatDate(l.timestamp, lang), l.userName, l.type, l.query || '(Photo)', l.resultsCount];
      rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
    });

  } else if (type?.startsWith('SALES')) {
    // Sales Logic
    const headers = [
      t.orderId, t.date, t.client, t.brand, t.status,
      t.sku, t.product, t.qty, t.unit, t.price, t.purchasePrice, t.logistics, t.profit,
      t.itemTotal, t.orderTotal, t.paid, t.remaining
    ];
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));

    (data as Order[]).forEach(o => {
      const items = o.items ?? [];
      const orderTotal = Number(o.totalAmount ?? 0);
      const paid = Number(o.paidAmount ?? 0);
      const remaining = orderTotal - paid;

      if (items.length === 0) {
        // ... empty order logic (optional)
        return;
      }

      items.forEach(it => {
        const snap = it.productSnapshot;
        // Filter by type if requested
        if (type === 'SALES_FABRIC' && snap?.type !== 'FABRIC') return;
        if (type === 'SALES_HARDWARE' && snap?.type !== 'HARDWARE') return;

        const basePrice = snap?.price || 0;
        const costPrice = snap?.purchasePrice || 0;
        const logisticsCost = snap?.logisticsCost || 0;
        const stockQty = it.stockQty || 0;
        const factoryQty = it.factoryQty || 0;
        
        const finalItemTotal = (stockQty * basePrice) + (factoryQty * basePrice * 0.97);
        const totalQty = stockQty + factoryQty;
        const totalCost = totalQty * costPrice;
        const totalLogistics = totalQty * logisticsCost;
        
        const profit = finalItemTotal - totalCost - totalLogistics;

        const line = [
          o.id, formatDate(o.createdAt, lang), o.username ?? '', o.userBrand ?? '', localizeStatus(o.status, lang),
          snap?.sku ?? '', snap?.title ?? '', it.quantity, snap?.unit ?? '',
          formatNumber(basePrice, lang), 
          formatNumber(costPrice, lang),
          formatNumber(logisticsCost, lang),
          formatNumber(profit, lang),
          formatNumber(finalItemTotal, lang),
          formatNumber(orderTotal, lang),
          formatNumber(paid, lang),
          formatNumber(remaining, lang)
        ];
        rows.push(line.map(v => escapeCell(v, delimiter)).join(delimiter));
      });
    });
  } else {
    // Fallback Generic
    const headers = Object.keys(data[0] ?? {});
    if (headers.length === 0) return;
    rows.push(headers.map(h => escapeCell(h, delimiter)).join(delimiter));
    data.forEach(obj => {
      const line = headers.map(h => escapeCell(obj[h], delimiter));
      rows.push(line.join(delimiter));
    });
  }

  const csv = rows.join('\n');
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const generateClientLedger = (orders: Order[], users: User[], targetUserId: string | 'ALL') => {
  let relevantUsers = users;
  if (targetUserId !== 'ALL') {
    relevantUsers = users.filter(u => u.id === targetUserId);
  }

  const allTransactions: any[] = [];

  relevantUsers.forEach(user => {
    const userOrders = orders.filter(o => o.userId === user.id && o.status !== OrderStatus.CANCELLED);
    
    userOrders.forEach(o => {
        // 1. Order Transaction (Debit / Debt increase)
        // Note: For accounting, an Invoice/Order usually means the client OWES money. 
        // We treat Debt as negative balance or Debit as a positive charge against account.
        // To make it intuitive: 
        // Debit = Amount to be paid
        // Credit = Amount paid
        // Balance = Credit - Debit
        
        allTransactions.push({
            date: o.createdAt,
            type: 'ORDER',
            description: `Order #${o.id} (${o.items.length} items)`,
            amount: -o.totalAmount, // Decreases balance (increases debt)
            clientId: user.id,
            clientName: user.name,
            orderId: o.id
        });

        // 2. Payment Transactions (Credit / Debt decrease)
        o.paymentProofs.forEach(p => {
             allTransactions.push({
                date: p.timestamp,
                type: 'PAYMENT',
                description: `Payment (${p.method})`,
                amount: p.amount, // Increases balance
                clientId: user.id,
                clientName: user.name,
                orderId: o.id
            });
        });
    });
  });

  // Sort strictly by date
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const balances: Record<string, number> = {};
  
  const rows = allTransactions.map(t => {
      if (balances[t.clientId] === undefined) balances[t.clientId] = 0;
      balances[t.clientId] += t.amount;
      
      return {
          ...t,
          debit: t.type === 'ORDER' ? Math.abs(t.amount) : 0,
          credit: t.type === 'PAYMENT' ? t.amount : 0,
          runningBalance: balances[t.clientId]
      };
  });

  return rows;
};

export const trackEvent = (eventName: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') console.log(`[Analytics] ${eventName}`, data);
};

export const logSearch = (log: Partial<SearchLog>) => {
  if (process.env.NODE_ENV === 'development') console.log('[Search]', log);
};

export const getDashboardStats = (orders: Order[], expenses: Expense[] = []) => {
  const activeOrders = orders.filter(o => o.status !== OrderStatus.CANCELLED);
  
  const revenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgCheck = activeOrders.length > 0 ? revenue / activeOrders.length : 0;
  
  // Calculate COGS and Logistics
  let totalCostOfGoods = 0;
  let totalLogistics = 0;

  const fabricSales: any[] = [];
  const hardwareSales: any[] = [];
  const supplierReportData: any[] = []; // For daily export

  activeOrders.forEach(o => {
    o.items.forEach(item => {
      const snap = item.productSnapshot;
      if (!snap) return;

      // Item metrics
      const qty = item.quantity;
      const basePrice = snap.price;
      const purchasePrice = snap.purchasePrice || 0;
      const logisticCost = snap.logisticsCost || 0;

      // Pricing logic match: Stock 100%, Factory 97%
      const stockQty = item.stockQty || 0;
      const factoryQty = item.factoryQty || 0;
      const itemRevenue = (stockQty * basePrice) + (factoryQty * basePrice * 0.97);

      const itemCOGS = qty * purchasePrice;
      const itemLogistics = qty * logisticCost;

      totalCostOfGoods += itemCOGS;
      totalLogistics += itemLogistics;
      
      const itemProfit = itemRevenue - itemCOGS - itemLogistics;

      const row = {
        date: o.createdAt,
        orderId: o.id,
        sku: snap.sku || '',
        title: snap.title || '',
        price: basePrice,
        purchasePrice: purchasePrice, // Added for report
        logisticsCost: logisticCost, // Added for report
        qty: qty,
        revenue: itemRevenue,
        cost: itemCOGS,
        logistics: itemLogistics,
        profit: itemProfit,
      };

      if (snap.type === ProductType.FABRIC) fabricSales.push(row);
      else hardwareSales.push(row);

      // Supplier Data Aggregation
      supplierReportData.push({
          supplierName: snap.supplierName || 'Unknown',
          supplierWechat: snap.supplierWechat || '-',
          userBrand: o.userBrand,
          sku: snap.sku,
          qty: item.factoryQty > 0 ? item.factoryQty : item.quantity,
          purchasePrice: purchasePrice, // Included for comparison
          username: o.username
      });
    });
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = revenue - totalCostOfGoods - totalLogistics;
  const netProfit = grossProfit - totalExpenses;

  return {
    revenue,
    avgCheck,
    fabricSales,
    hardwareSales,
    grossProfit,
    netProfit,
    totalExpenses,
    supplierReportData
  };
};
