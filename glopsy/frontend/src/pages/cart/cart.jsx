import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Trash2, CreditCard } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import './cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    try {
      const items = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
      setCartItems(items);
      if (items.length > 0) {
        trackEvent('view_cart', {
          currency: 'COP',
          value: items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0),
          items: items.map(item => ({
            item_id: String(item.external_id || item.id || ''),
            item_name: item.name || '',
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
          })),
        });
      }
    } catch {
      setCartItems([]);
    }
  }, []);

  const buildCartItemsPayload = (list) =>
    list.map(item => ({
      item_id: String(item.external_id || item.id || ''),
      item_name: item.name || '',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    }));

  const updateQuantity = (index, delta) => {
    const updated = [...cartItems];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      const removed = updated.splice(index, 1);
      if (removed.length > 0) {
        trackEvent('remove_from_cart', {
          currency: 'COP',
          value: Number(removed[0].price || 0) * Number(removed[0].quantity || 1),
          items: buildCartItemsPayload(removed),
        });
      }
    } else {
      updated[index].quantity = newQty;
    }
    setCartItems(updated);
    localStorage.setItem('glopsy_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const removeItem = (index) => {
    const updated = [...cartItems];
    const removed = updated.splice(index, 1);
    if (removed.length > 0) {
      trackEvent('remove_from_cart', {
        currency: 'COP',
        value: Number(removed[0].price || 0) * Number(removed[0].quantity || 1),
        items: buildCartItemsPayload(removed),
      });
    }
    setCartItems(updated);
    localStorage.setItem('glopsy_cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-fuchsia-100 p-12 text-center">
          <div className="w-20 h-20 bg-fuchsia-50 text-fuchsia-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <ShoppingCart size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Tu carrito está vacío</h2>
          <p className="text-slate-500 text-sm mb-8">
            Explora nuestro catálogo de productos y selecciona lo necesario para tu compra.
          </p>
          <Link
            to="/listpr"
            className="inline-block bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-fuchsia-600/30 text-sm"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
          <ShoppingCart size={32} className="text-fuchsia-600" />
          Carrito de Compras
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {cartItems.map((item, index) => {
              const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
              return (
                <div key={index} className="bg-white rounded-2xl p-4 sm:p-6 border border-fuchsia-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden border border-fuchsia-100 shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-1 mb-1">{item.name}</h3>
                      {item.options && (item.options.main || item.options.sub) && (
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.options.main && (
                            <span className="text-xs text-fuchsia-700 bg-fuchsia-50 px-2 py-0.5 rounded font-medium">
                              {item.options.main}
                            </span>
                          )}
                          {item.options.sub && (
                            <span className="text-xs text-pink-700 bg-pink-50 px-2 py-0.5 rounded font-medium">
                              {item.options.sub}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-slate-400 block">
                        Precio unitario: {formatPrice(item.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-fuchsia-50">
                    <span className="font-bold text-slate-900 text-base sm:text-lg">
                      {formatPrice(itemTotal)}
                    </span>

                    <div className="flex items-center border border-fuchsia-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-fuchsia-100 font-bold transition-colors cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1.5 font-bold text-slate-800 text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-fuchsia-100 font-bold transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(index)}
                      className="text-slate-400 hover:text-pink-600 p-2 transition-colors cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cart Summary Sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-fuchsia-100 shadow-sm sticky top-24">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Resumen de la orden</h3>
              
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
                </div>
                <div className="border-t border-fuchsia-100 pt-3 flex justify-between text-base font-bold text-slate-900">
                  <span>Total estimado</span>
                  <span className="text-fuchsia-600">{formatPrice(subtotal)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  trackEvent('begin_checkout', {
                    currency: 'COP',
                    value: subtotal,
                    items: buildCartItemsPayload(cartItems),
                  });
                  navigate('/checkout');
                }}
                className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-fuchsia-600/30 text-sm mb-4 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard size={18} />
                Pagar
              </button>

              <Link
                to="/listpr"
                className="block text-center text-xs font-semibold text-fuchsia-600 hover:underline"
              >
                ← Continuar comprando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
