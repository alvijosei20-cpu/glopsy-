import { useState, useEffect } from 'react';
import { ArrowLeft, ImagePlus, Pause, Play, Search, Trash2, Package, Plus, Sparkles, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';

export default function ProductsManage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [imageModal, setImageModal] = useState(null);
  const [newImages, setNewImages] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/product/manage');
      if (data.ok) setProducts(data.products || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      alert(err.response?.data?.message || 'Error al cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleStatus = async (product) => {
    setBusyId(product.id);
    try {
      const target = product.status === 'active' ? 'pause' : 'activate';
      const { data } = await api.patch(`/product/${product.id}/${target}`);
      if (data.ok) {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: data.product.status } : p)));
        showToast(data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo actualizar el producto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (product) => {
    setBusyId(product.id);
    try {
      const { data } = await api.delete(`/product/${product.id}`);
      if (data.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setConfirmDelete(null);
        showToast('Producto eliminado.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo eliminar el producto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddImages = async () => {
    const urls = newImages
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0 || !imageModal) return;
    setBusyId(imageModal.id);
    try {
      const { data } = await api.post(`/product/${imageModal.id}/images`, { images: urls });
      if (data.ok) {
        setProducts((prev) => prev.map((p) => (p.id === imageModal.id ? { ...p, images: data.product.images } : p)));
        setImageModal(null);
        setNewImages('');
        showToast('Imágenes agregadas.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudieron agregar las imágenes.');
    } finally {
      setBusyId(null);
    }
  };

  const formatPrice = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val || 0));

  const getImage = (product) => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      const first = product.images[0];
      return typeof first === 'string' ? first : first?.src || '';
    }
    if (typeof product.images === 'string') {
      try {
        const parsed = JSON.parse(product.images);
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        return typeof first === 'string' ? first : first?.src || '';
      } catch { return ''; }
    }
    return '';
  };

  const filtered = query.trim()
    ? products.filter((p) => (p.name || '').toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  const activeCount = products.filter((p) => p.status === 'active').length;
  const pausedCount = products.filter((p) => p.status === 'paused').length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-xl w-1/3 animate-pulse"></div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/market"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Mi tienda
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="text-fuchsia-600 dark:text-fuchsia-400" size={30} />
            Mis Productos
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
            Gestiona los productos publicados de tu tienda.
          </p>
        </div>
        <Link
          to="/publish"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all text-sm"
        >
          <Plus size={18} /> Publicar Producto
        </Link>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <Sparkles className="text-fuchsia-400" size={18} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Resumen + Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
        <div className="flex gap-4">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Activos</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
          </div>
          <div className="border-l border-slate-200 dark:border-zinc-700 pl-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Pausados</span>
            <span className="text-xl font-extrabold text-amber-500">{pausedCount}</span>
          </div>
        </div>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-fuchsia-100/60 dark:border-zinc-800 shadow-sm p-8">
          <div className="w-16 h-16 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-500 dark:text-fuchsia-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Package size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No hay productos</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
            Publica tu primer producto para comenzar a vender.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((product) => {
            const isActive = product.status === 'active';
            const img = getImage(product);
            const imageCount = Array.isArray(product.images) ? product.images.length : 0;
            return (
              <article
                key={product.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row overflow-hidden group min-h-[16rem] sm:min-h-[15rem]"
              >
                <div className="relative w-full sm:w-2/5 h-44 sm:h-full sm:min-h-[15rem] bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-zinc-800 shrink-0">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-zinc-600">
                      <Package size={40} />
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 shadow-md ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <i className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isActive ? 'Activo' : 'Pausado'}
                  </span>
                </div>

                <div className="w-full sm:w-3/5 p-3.5 sm:p-4 flex flex-col flex-grow justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-2 group-hover:text-fuchsia-600 transition-colors leading-snug">
                      {product.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5">
                      {formatPrice(product.suggested_price || product.base_price)} · Stock: {product.stock_total}
                    </p>
                    {imageCount > 0 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {imageCount} imagen(es)
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      onClick={() => setImageModal(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:border-fuchsia-300 dark:hover:border-fuchsia-800 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ImagePlus size={14} /> Imágenes
                    </button>
                    <button
                      onClick={() => toggleStatus(product)}
                      disabled={busyId === product.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-800 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isActive ? <Pause size={14} /> : <Play size={14} />}
                      {isActive ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(product)}
                      disabled={busyId === product.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal agregar imágenes */}
      {imageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setImageModal(null)}>
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Agregar imágenes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{imageModal.name}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {Array.isArray(imageModal.images) && imageModal.images.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Imágenes actuales</label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {imageModal.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={typeof img === 'string' ? img : img?.src}
                        alt={`${imageModal.name} ${idx + 1}`}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  URLs de imágenes (una por línea)
                </label>
                <textarea
                  value={newImages}
                  onChange={(e) => setNewImages(e.target.value)}
                  rows={4}
                  placeholder="https://...\nhttps://..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setImageModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddImages}
                disabled={busyId === imageModal.id}
                className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ImagePlus size={15} />
                {busyId === imageModal.id ? 'Agregando...' : 'Agregar imágenes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-3">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar producto?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                "{confirmDelete.name}" dejará de estar visible en tu tienda.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {busyId === confirmDelete.id ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
