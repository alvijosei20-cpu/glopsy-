import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Zap, Heart, ArrowLeft, Truck, ShieldCheck, Check, Star, MapPin, Store, Shield, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import './product.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedMainOption, setSelectedMainOption] = useState('');
  const [selectedSubOption, setSelectedSubOption] = useState('');
  const [addedToast, setAddedToast] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  
  // Fold/Unfold states for long texts
  const [warrantyExpanded, setWarrantyExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const userCity = sessionStorage.getItem('location_city') || 'Bogotá D.C.';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!id) return;
    setLoading(true);
    api.get(`/product/${id}`)
      .then(res => {
        if (res.data.ok) {
          const p = res.data.product;
          setProduct(p);
        } else {
          setError('No se pudo cargar el producto.');
        }
      })
      .catch(err => {
        console.error('Error al cargar detalle del producto:', err);
        setError('Producto no encontrado o error en el servidor.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const catId = product.categoria_id;
    api.get('/product', { params: { categoria_id: catId, limit: 12 } })
      .then(res => {
        if (res.data.ok) {
          const list = (res.data.products || []).filter(p => Number(p.id) !== Number(product.id));
          setRelatedProducts(list);
        }
      })
      .catch(err => console.error('Error al cargar relacionados:', err));
  }, [product]);

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const getImages = (p) => {
    try {
      if (Array.isArray(p.images) && p.images.length > 0) {
        return p.images.map(img => img.src || img).filter(Boolean);
      }
      if (typeof p.images === 'string') {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed)) {
          return parsed.map(img => img.src || img).filter(Boolean);
        }
      }
    } catch {}
    if (p.urlImageProduct) return [p.urlImageProduct];
    return ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60'];
  };

  const getProductOwner = (p) => {
    try {
      if (p.product_owner) {
        if (typeof p.product_owner === 'object') return p.product_owner;
        return JSON.parse(p.product_owner);
      }
    } catch {}
    return null;
  };

  const getWarranties = (p) => {
    try {
      if (p.warranties) {
        if (typeof p.warranties === 'object') return p.warranties;
        return JSON.parse(p.warranties);
      }
    } catch {}
    return null;
  };

  const owner = product ? getProductOwner(product) : null;
  const warranties = product ? getWarranties(product) : null;

  const getVariants = (p) => {
    try {
      if (Array.isArray(p.variants)) return p.variants;
      if (typeof p.variants === 'string') {
        return JSON.parse(p.variants);
      }
    } catch {}
    return [];
  };

  const variants = product ? getVariants(product) : [];

  const parsedVariants = variants.map((v, idx) => {
    const rawName = v.name || v.title || `Variante ${idx + 1}`;
    const parts = rawName.split('/').map(s => s.trim());
    const mainAttr = parts[0] || rawName;
    const subAttr = parts[1] || '';
    return {
      original: v,
      main: mainAttr,
      sub: subAttr,
      rawName: rawName,
    };
  });

  const uniqueMainOptions = [...new Set(parsedVariants.map(p => p.main))];

  const availableSubOptions = parsedVariants
    .filter(p => !selectedMainOption || p.main === selectedMainOption)
    .map(p => p.sub)
    .filter(Boolean);

  const uniqueSubOptions = [...new Set(availableSubOptions)];

  useEffect(() => {
    if (uniqueMainOptions.length > 0 && !selectedMainOption) {
      setSelectedMainOption(uniqueMainOptions[0]);
    }
  }, [uniqueMainOptions, selectedMainOption]);

  useEffect(() => {
    if (uniqueSubOptions.length > 0 && (!selectedSubOption || !uniqueSubOptions.includes(selectedSubOption))) {
      setSelectedSubOption(uniqueSubOptions[0]);
    } else if (uniqueSubOptions.length === 0) {
      setSelectedSubOption('');
    }
  }, [selectedMainOption, uniqueSubOptions, selectedSubOption]);

  const currentVariant = variants.length > 0
    ? parsedVariants.find(p => p.main === selectedMainOption && (!selectedSubOption || p.sub === selectedSubOption))?.original || variants[0]
    : null;

  const handleAddToCart = () => {
    if (!product) return;
    const cartItem = {
      id: product.id || id,
      external_id: product.external_product_id || product.id,
      name: product.name,
      price: Number(product.suggested_price || product.base_price || 0),
      image: getImages(product)[selectedImage] || getImages(product)[0],
      quantity: Number(quantity),
      variant: currentVariant,
      options: { main: selectedMainOption, sub: selectedSubOption },
    };

    try {
      const existingCart = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
      const existingIndex = existingCart.findIndex(item => 
        item.id === cartItem.id && item.variant?.name === cartItem.variant?.name
      );

      if (existingIndex > -1) {
        existingCart[existingIndex].quantity += cartItem.quantity;
      } else {
        existingCart.push(cartItem);
      }

      localStorage.setItem('glopsy_cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('storage'));

      setAddedToast(true);
      setTimeout(() => setAddedToast(false), 3000);
    } catch (err) {
      console.error('Error al agregar al carrito:', err);
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando detalles del producto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-fuchsia-100 p-8 text-center max-w-md w-full">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Producto no disponible</h2>
          <p className="text-slate-500 text-sm mb-6">{error || 'No se pudo encontrar el producto solicitado.'}</p>
          <button
            onClick={() => navigate('/listpr')}
            className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-fuchsia-600/20"
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  const images = getImages(product);
  const mainPrice = Number(product.suggested_price || product.base_price || 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      
      {/* Toast de agregado exitoso */}
      {addedToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
          <Check size={20} />
          <span className="font-semibold text-sm">¡Producto agregado al carrito con éxito!</span>
        </div>
      )}

      {/* Top Bar Navigation */}
      <div className="bg-white border-b border-fuchsia-100 shadow-sm py-3 px-4 sm:px-8 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-fuchsia-600 text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </button>
          <div className="flex items-center gap-2 text-fuchsia-800 text-xs sm:text-sm font-medium bg-fuchsia-50 px-3 py-1.5 rounded-xl border border-fuchsia-100">
            <MapPin size={16} className="text-fuchsia-600 shrink-0" />
            <span>Envío a <b>{userCity}</b></span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="bg-white rounded-3xl shadow-sm border border-fuchsia-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10">
          
          {/* Column 1: Horizontally Scrollable Image Banner (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="w-full flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
              {images.map((img, idx) => (
                <div 
                  key={idx} 
                  className="w-full shrink-0 snap-center h-80 sm:h-96 bg-slate-50 rounded-2xl border border-fuchsia-100 overflow-hidden flex items-center justify-center relative shadow-inner cursor-pointer"
                  onClick={() => setSelectedImage(idx)}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-fuchsia-700 text-xs font-bold px-3 py-1 rounded-lg shadow-sm border border-fuchsia-100">
                    {idx + 1} / {images.length}
                  </span>
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-14 h-14 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                      selectedImage === idx ? 'border-fuchsia-600 ring-2 ring-fuchsia-500/30' : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Product Info & Purchase Options (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              {/* Category & Brand */}
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-fuchsia-50 text-fuchsia-700 text-xs font-bold px-3 py-1 rounded-full border border-fuchsia-100">
                  {product.categoria_nombre || product.category || 'General'}
                </span>
                {product.stock_total > 0 && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100">
                    Stock disponible ({product.stock_total})
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 leading-snug">
                {product.name}
              </h1>

              {/* Price (Suggested Price) */}
              <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-fuchsia-100">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block mb-1">
                  {formatPrice(mainPrice)}
                </span>
                <p className="text-xs text-slate-500">
                  Precio sugerido • IVA incluido
                </p>
              </div>

              {/* Cascading Variants Selects split by '/' */}
              {variants.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Opción Principal (Color / Estilo):
                    </label>
                    <select
                      value={selectedMainOption}
                      onChange={(e) => setSelectedMainOption(e.target.value)}
                      className="w-full bg-slate-50 border border-fuchsia-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all"
                    >
                      {uniqueMainOptions.map((opt, idx) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {uniqueSubOptions.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Opción Secundaria (Talla / Medida):
                      </label>
                      <select
                        value={selectedSubOption}
                        onChange={(e) => setSelectedSubOption(e.target.value)}
                        className="w-full bg-slate-50 border border-fuchsia-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all"
                      >
                        {uniqueSubOptions.map((sub, idx) => (
                          <option key={idx} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Cantidad:
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-fuchsia-200 rounded-xl overflow-hidden bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-2 text-slate-600 hover:bg-fuchsia-100 font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 font-bold text-slate-800 text-sm">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-4 py-2 text-slate-600 hover:bg-fuchsia-100 font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Description with Fold/Unfold & Gradient Fade */}
              {product.description && (
                <div className="mb-6 border-t border-fuchsia-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Descripción del producto</h3>
                  <div className="relative">
                    <div 
                      className={`text-xs sm:text-sm text-slate-600 leading-relaxed prose max-none transition-all duration-300 ${!descExpanded ? 'max-h-24 overflow-hidden' : ''}`}
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                    {!descExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#121212] to-transparent pointer-events-none"></div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="mt-2 flex items-center gap-1 text-xs font-bold text-fuchsia-600 hover:text-fuchsia-700 transition-colors"
                  >
                    <span>{descExpanded ? 'Ver menos' : 'Ver más descripción'}</span>
                    {descExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons: Comprar y Agregar al Carrito */}
            <div className="pt-6 border-t border-fuchsia-100 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-fuchsia-600 text-fuchsia-600 hover:bg-fuchsia-50 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-sm text-sm"
              >
                <ShoppingCart size={18} />
                <span>Agregar al carrito</span>
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-fuchsia-600/30 text-sm"
              >
                <Zap size={18} />
                <span>Comprar ahora</span>
              </button>
            </div>

          </div>

        </div>

        {/* Tarjetas de Proveedor y Garantía con efecto plegue/despliegue degradante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Proveedor */}
          {owner && (
            <div className="bg-gradient-to-br from-fuchsia-50/70 to-pink-50/70 rounded-3xl border border-fuchsia-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all flex items-start gap-5">
              <div className="p-3.5 bg-fuchsia-600 text-white rounded-2xl shadow-md shadow-fuchsia-600/35 shrink-0">
                <Store size={26} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-fuchsia-700 uppercase tracking-wider mb-1">Proveedor / Vendedor</h4>
                <h3 className="text-lg font-extrabold text-slate-900 mb-1">{owner.publicName || owner.name || 'Proveedor Verificado'}</h3>
                {owner.idBusiness && (
                  <p className="text-xs text-slate-500 font-medium mb-3">ID de Negocio: <span className="font-mono text-slate-700 font-bold">{owner.idBusiness}</span></p>
                )}
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck size={14} />
                  <span>Vendedor Oficial Verificado</span>
                </div>
              </div>
            </div>
          )}

          {/* Garantías con Fold/Unfold & Gradient Fade */}
          {warranties && (
            <div className="bg-gradient-to-br from-purple-50/70 to-fuchsia-50/70 rounded-3xl border border-fuchsia-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all flex items-start gap-5">
              <div className="p-3.5 bg-gradient-to-tr from-fuchsia-600 to-pink-500 text-white rounded-2xl shadow-md shadow-fuchsia-500/35 shrink-0">
                <Shield size={26} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-fuchsia-700 uppercase tracking-wider mb-1">Garantía del Producto</h4>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  {warranties.period ? `${warranties.period} Días de Garantía` : 'Garantía Directa'}
                </h3>
                <div className="relative">
                  <p className={`text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line transition-all duration-300 ${!warrantyExpanded ? 'max-h-20 overflow-hidden' : ''}`}>
                    {warranties.conditions || 'Este producto cuenta con respaldo y garantía por defectos de fábrica.'}
                  </p>
                  {!warrantyExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-fuchsia-50/90 dark:from-[#1e1b2e]/90 to-transparent pointer-events-none"></div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setWarrantyExpanded(!warrantyExpanded)}
                  className="mt-2 flex items-center gap-1 text-xs font-bold text-fuchsia-600 hover:text-fuchsia-700 transition-colors"
                >
                  <span>{warrantyExpanded ? 'Ver menos' : 'Ver más detalles'}</span>
                  {warrantyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Slider Horizontal de Productos Relacionados (Tarjetas achicadas estilo listpr) */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 bg-white rounded-3xl border border-fuchsia-100 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-fuchsia-100 text-fuchsia-600 rounded-xl">
                  <Sparkles size={22} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-950">Productos Relacionados</h2>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{relatedProducts.length} disponibles</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory scrollbar-thin">
              {relatedProducts.map(rp => {
                const rpPrice = Number(rp.suggested_price || rp.base_price || 0);
                const rpImg = getImages(rp)[0];
                return (
                  <div
                    key={rp.id}
                    onClick={() => {
                      navigate(`/product/${rp.public_id || rp.id}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-48 sm:w-52 shrink-0 snap-start bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer group"
                  >
                    <div className="relative w-full h-36 bg-slate-100 overflow-hidden">
                      <img src={rpImg} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {rp.categoria_nombre && (
                        <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-fuchsia-700 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                          {rp.categoria_nombre}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1 justify-between">
                      <h3 className="font-normal text-slate-800 text-xs line-clamp-2 group-hover:text-fuchsia-600 transition-colors mb-2">
                        {rp.name}
                      </h3>
                      <div className="text-sm font-bold text-slate-950">
                        {formatPrice(rpPrice)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
