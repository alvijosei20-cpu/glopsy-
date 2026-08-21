import React, { useState, useEffect } from 'react';
import { User, MapPin, CreditCard, Save, Plus, Trash2, Shield, Calendar, Phone, FileText } from 'lucide-react';
import api from '../../services/api';
import { SkeletonProfile } from '../../components/SkeletonLoader';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'addresses' | 'cards'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Personal Info
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthdate: '',
    document_type: 'CC',
    document_number: '',
    gender: 'otro',
    avatar_url: '',
  });

  // Addresses
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({
    title: 'Casa',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'Colombia',
    phone: '',
    notes: '',
  });
  const [showAddressForm, setShowAddressForm] = useState(false);

  // Cards
  const [cards, setCards] = useState([]);
  const [newCard, setNewCard] = useState({
    card_holder: '',
    card_number: '',
    expiry_month: '12',
    expiry_year: '28',
    card_brand: 'Visa',
  });
  const [showCardForm, setShowCardForm] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [userRes, addrRes, cardRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/auth/addresses'),
        api.get('/auth/cards'),
      ]);

      if (userRes.data.ok) {
        const u = userRes.data.user;
        setFormData({
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          birthdate: u.birthdate ? String(u.birthdate).split('T')[0] : '',
          document_type: u.document_type || 'CC',
          document_number: u.document_number || '',
          gender: u.gender || 'otro',
          avatar_url: u.avatar_url || '',
        });
      }

      if (addrRes.data.ok) {
        setAddresses(addrRes.data.addresses || []);
      }

      if (cardRes.data.ok) {
        setCards(cardRes.data.cards || []);
      }
    } catch (err) {
      console.error('Error al cargar datos del perfil:', err);
      setMessage({ text: 'Error al cargar los datos del perfil.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await api.put('/auth/me', formData);
      if (res.data.ok) {
        setMessage({ text: 'Perfil actualizado con éxito.', type: 'success' });
      } else {
        setMessage({ text: res.data.message || 'No fue posible actualizar.', type: 'error' });
      }
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      setMessage({ text: 'Error al actualizar el perfil.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (newAddress.phone && !/^3\d{9}$/.test(newAddress.phone)) {
      setMessage({ text: 'El número móvil debe tener 10 dígitos y empezar por 3 (Ej. 3001234567).', type: 'error' });
      return;
    }
    try {
      const res = await api.post('/auth/addresses', newAddress);
      if (res.data.ok) {
        setAddresses([res.data.address, ...addresses]);
        setNewAddress({
          title: 'Casa',
          street: '',
          city: '',
          state: '',
          zip_code: '',
          country: 'Colombia',
          phone: '',
          notes: '',
        });
        setShowAddressForm(false);
        setMessage({ text: 'Dirección guardada correctamente.', type: 'success' });
      }
    } catch (err) {
      console.error('Error al guardar dirección:', err);
      setMessage({ text: 'Error al guardar la dirección.', type: 'error' });
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta dirección?')) return;
    try {
      const res = await api.delete(`/auth/addresses/${id}`);
      if (res.data.ok) {
        setAddresses(addresses.filter(a => a.id !== id));
        setMessage({ text: 'Dirección eliminada.', type: 'success' });
      }
    } catch (err) {
      console.error('Error al eliminar dirección:', err);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/cards', newCard);
      if (res.data.ok) {
        setCards([res.data.card, ...cards]);
        setNewCard({
          card_holder: '',
          card_number: '',
          expiry_month: '12',
          expiry_year: '28',
          card_brand: 'Visa',
        });
        setShowCardForm(false);
        setMessage({ text: 'Tarjeta guardada correctamente.', type: 'success' });
      }
    } catch (err) {
      console.error('Error al guardar tarjeta:', err);
      setMessage({ text: 'Error al guardar la tarjeta.', type: 'error' });
    }
  };

  const handleDeleteCard = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;
    try {
      const res = await api.delete(`/auth/cards/${id}`);
      if (res.data.ok) {
        setCards(cards.filter(c => c.id !== id));
        setMessage({ text: 'Tarjeta eliminada.', type: 'success' });
      }
    } catch (err) {
      console.error('Error al eliminar tarjeta:', err);
    }
  };

  if (loading) {
    return <SkeletonProfile />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Encabezado */}
      <div className="mb-8 flex items-center gap-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 rounded-2xl text-slate-900 dark:text-white shadow-sm">
        <div className="relative">
          {formData.avatar_url ? (
            <img 
              src={formData.avatar_url} 
              alt={formData.name} 
              className="w-16 h-16 rounded-full object-cover ring-4 ring-slate-200 dark:ring-zinc-700 shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-slate-300 ring-4 ring-slate-200 dark:ring-zinc-700">
              <User size={32} />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{formData.name || 'Mi Perfil'}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{formData.email}</p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-8 space-x-8">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'personal' ? 'border-fuchsia-600 text-fuchsia-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <User size={18} />
          Información
        </button>
        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'addresses' ? 'border-fuchsia-600 text-fuchsia-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <MapPin size={18} />
          Direcciones
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'cards' ? 'border-fuchsia-600 text-fuchsia-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <CreditCard size={18} />
          Pagos
        </button>
      </div>

      {/* Tab 1: Información Personal */}
      {activeTab === 'personal' && (
        <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-fuchsia-100 shadow-sm p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield size={20} className="text-fuchsia-500" />
            Datos Personales y de Contacto
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Nombre completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Correo electrónico (No editable)</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Teléfono / Celular</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej. 3001234567"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Fecha de nacimiento</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Tipo de documento</label>
              <select
                value={formData.document_type}
                onChange={e => setFormData({ ...formData, document_type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm bg-white"
              >
                <option value="CC">Cédula de Ciudadanía (CC)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="NIT">NIT</option>
                <option value="PAS">Pasaporte (PAS)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Número de documento</label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej. 1020304050"
                  value={formData.document_number}
                  onChange={e => setFormData({ ...formData, document_number: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Género</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm bg-white"
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro / Prefiero no decir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">URL de Avatar / Foto</label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.avatar_url}
                onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-md shadow-fuchsia-600/20 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Direcciones */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mis Direcciones</h2>
            {addresses.length < 2 ? (
              <button
                onClick={() => {
                  setNewAddress(prev => ({ ...prev, title: addresses.length === 0 ? 'Principal' : 'Opcional' }));
                  setShowAddressForm(!showAddressForm);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Nueva Dirección
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                Máximo 2 direcciones (Principal y Opcional)
              </span>
            )}
          </div>

          {showAddressForm && (
            <form onSubmit={handleAddAddress} className="bg-white rounded-2xl border border-fuchsia-100 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Agregar Dirección</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Título (Ej. Casa, Oficina)"
                  value={newAddress.title}
                  onChange={e => setNewAddress({ ...newAddress, title: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Calle / Carrera / Transversal / Diagonal # N° - N° (Ej. Calle 100 # 15-20)"
                  value={newAddress.street}
                  onChange={e => setNewAddress({ ...newAddress, street: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Ciudad"
                  value={newAddress.city}
                  onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Departamento / Estado"
                  value={newAddress.state}
                  onChange={e => setNewAddress({ ...newAddress, state: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  type="text"
                  placeholder="Código postal"
                  value={newAddress.zip_code}
                  onChange={e => setNewAddress({ ...newAddress, zip_code: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Móvil / Celular (Ej. 3001234567)"
                  value={newAddress.phone}
                  onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddressForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700 shadow-sm"
                >
                  Guardar Dirección
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-fuchsia-100 p-8">
              <MapPin size={32} className="mx-auto text-fuchsia-400 mb-2" />
              <p className="text-slate-600 text-sm">No tienes direcciones registradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map(addr => (
                <div key={addr.id} className="bg-white rounded-2xl border border-fuchsia-100 p-5 shadow-sm flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm">{addr.title}</span>
                      <span className="bg-fuchsia-50 text-fuchsia-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {addr.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{addr.street}</p>
                    <p className="text-sm text-slate-600">{addr.city}, {addr.state} ({addr.country})</p>
                    {addr.phone && <p className="text-xs text-slate-500 mt-1">Tel: {addr.phone}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-slate-400 hover:text-pink-600 p-2 transition-colors"
                    title="Eliminar dirección"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Métodos de Pago */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pagos</h2>
            {cards.length < 4 ? (
              <button
                onClick={() => setShowCardForm(!showCardForm)}
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Nueva Tarjeta
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                Máximo 4 tarjetas permitidas
              </span>
            )}
          </div>

          {showCardForm && (
            <form onSubmit={handleAddCard} className="bg-white rounded-2xl border border-fuchsia-100 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Agregar Tarjeta</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Nombre del titular"
                  value={newCard.card_holder}
                  onChange={e => setNewCard({ ...newCard, card_holder: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Número de tarjeta (ej. ...1234)"
                  value={newCard.card_number}
                  onChange={e => setNewCard({ ...newCard, card_number: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  required
                />
                <div className="flex gap-2">
                  <select
                    value={newCard.expiry_month}
                    onChange={e => setNewCard({ ...newCard, expiry_month: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={newCard.expiry_year}
                    onChange={e => setNewCard({ ...newCard, expiry_year: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {['26', '27', '28', '29', '30', '31'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <select
                  value={newCard.card_brand}
                  onChange={e => setNewCard({ ...newCard, card_brand: e.target.value })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="American Express">American Express</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700 shadow-sm"
                >
                  Guardar Tarjeta
                </button>
              </div>
            </form>
          )}

          {cards.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-fuchsia-100 p-8">
              <CreditCard size={32} className="mx-auto text-fuchsia-400 mb-2" />
              <p className="text-slate-600 text-sm">No tienes tarjetas registradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cards.map(card => (
                <div key={card.id} className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md flex justify-between items-start relative overflow-hidden">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-fuchsia-400 font-bold">{card.card_brand || 'Tarjeta'}</span>
                    <div className="text-lg font-mono tracking-wider mt-2 mb-3">•••• •••• •••• {card.last_four}</div>
                    <div className="flex justify-between text-xs text-slate-300 gap-6">
                      <div>
                        <span className="block text-[10px] text-slate-400">Titular</span>
                        <span className="font-semibold">{card.card_holder}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">Expira</span>
                        <span className="font-semibold">{card.expiry_month}/{card.expiry_year}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-slate-400 hover:text-pink-400 p-2 transition-colors relative z-10"
                    title="Eliminar tarjeta"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
