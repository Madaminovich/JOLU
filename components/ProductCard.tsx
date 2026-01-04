
import React from 'react';
import { Product, AvailabilityStatus, ProductType } from '../types';
import { I18N } from '../constants';

interface ProductCardProps {
  product: Product;
  lang: 'ru' | 'en' | 'ky';
  isAdmin?: boolean;
  currentQtyInCart?: number;
  isFavorite?: boolean;
  onClick: (p: Product) => void;
  onAddToCart: (p: Product, qty: number) => void;
  onEdit?: (p: Product) => void;
  onToggleFavorite?: (p: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  lang, 
  isAdmin, 
  currentQtyInCart, 
  isFavorite,
  onClick, 
  onAddToCart, 
  onEdit,
  onToggleFavorite
}) => {
  const t = I18N[lang];
  const thumb = product.media?.[0]?.thumbUrl || product.media?.[0]?.url;
  const available = product.available_qty - product.reserved_qty;

  return (
    <div 
      onClick={() => onClick(product)}
      className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm active:shadow-md transition-all group flex flex-col relative"
    >
      {/* Availability Badge */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {available > 0 ? (
          <div className="bg-green-500/90 backdrop-blur-sm text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
            {t.inStock}
          </div>
        ) : (
          <div className="bg-orange-500/90 backdrop-blur-sm text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
            {t.preorder}
          </div>
        )}
      </div>

      {/* Favorite Button (User Only) */}
      {!isAdmin && onToggleFavorite && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          >
              <span className={`text-sm leading-none ${isFavorite ? 'text-red-500' : 'text-gray-300 grayscale'}`}>
                  {isFavorite ? '❤️' : '🤍'}
              </span>
          </button>
      )}

      <div className="aspect-square relative overflow-hidden bg-gray-50">
        <img 
          src={thumb} 
          alt={product.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />
        {currentQtyInCart && (
          <div className="absolute bottom-2 right-2 bg-blue-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg border border-white/20">
            {currentQtyInCart}
          </div>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-1 space-y-0.5">
        <p className="text-[8px] font-black text-gray-300 uppercase truncate tracking-tight">{product.sku}</p>
        <h3 className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight flex-1">{product.title}</h3>
        
        {product.type === ProductType.FABRIC && (
          <div className="flex gap-2 mb-1">
            {product.gsm && <span className="text-[7px] font-black bg-blue-50 text-blue-500 px-1 rounded">GSM:{product.gsm}</span>}
            {product.width_cm && <span className="text-[7px] font-black bg-blue-50 text-blue-500 px-1 rounded">W:{product.width_cm}cm</span>}
          </div>
        )}

        <div className="flex justify-between items-end pt-1">
          <div className="flex flex-col">
            <span className="text-xs font-black text-blue-600">${product.price.toFixed(2)}</span>
            <div className="flex flex-col">
               <span className="text-[7px] font-black text-gray-400 uppercase">{t.minOrder}: {product.moq}{product.unit}</span>
               <span className={`text-[8px] font-black uppercase ${available > 0 ? 'text-green-600' : 'text-orange-400'}`}>
                 Stock: {available} {product.unit}
               </span>
            </div>
          </div>
          {isAdmin ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit?.(product); }}
              className="bg-gray-100 p-1.5 rounded-lg text-xs hover:bg-gray-200 transition-colors"
            >
              ✏️
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddToCart(product, product.moq); }}
              className="bg-blue-600 text-white w-6 h-6 rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-all"
            >
              <span className="text-base leading-none font-bold">+</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
