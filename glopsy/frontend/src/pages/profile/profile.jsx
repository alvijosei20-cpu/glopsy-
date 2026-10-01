import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Save, Plus, Trash2, Shield, Calendar, Phone, FileText, CheckCircle2, AlertCircle, Lock, Download, Trash } from 'lucide-react';
import api from '../../services/api';
import { SkeletonProfile } from '../../components/SkeletonLoader';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'addresses' | 'privacy'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [consents, setConsents] = useState([]);
  const [privacyBusy, setPrivacyBusy] = useState(false);

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
    type: 'original',
    title: 'Principal',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'Colombia',
    phone: '',
    notes: '',
  });
  const [showAddressForm, setShowAddressForm] = useState(false);

  const toastTimer = useRef(null);
  const showToast = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage({ text: '', type: '' }), 3500);
  }, []);

  useEffect(() => {
    fetchProfileData();
    return () => clearTimeout(toastTimer.current);
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [userRes, addrRes, consentRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/auth/addresses'),
        api.get('/auth/consents').catch(() => ({ data: { consents: [] } })),
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

      if (consentRes.data?.ok) {
        setConsents(consentRes.data.consents || []);
      }
    } catch (err) {
      console.error('Error al cargar datos del perfil:', err);
      showToast('Error al cargar los datos del perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/me', formData);
      if (res.data.ok) {
        showToast('Perfil actualizado con éxito.', 'success');
      } else {
        showToast(res.data.message || 'No fue posible actualizar.', 'error');
      }
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      showToast('Error al actualizar el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    const hasOriginal = addresses.some(a => a.type === 'original');
    const hasOpcional = addresses.some(a => a.type === 'opcional');
    if ((newAddress.type === 'original' && hasOriginal) || (newAddress.type === 'opcional' && hasOpcional)) {
      showToast(`Ya tienes registrada una dirección ${newAddress.type === 'original' ? 'Principal' : 'Opcional'}.`, 'error');
      return;
    }
    if (newAddress.phone && !/^3\d{9}$/.test(newAddress.phone)) {
      showToast('El número móvil debe tener 10 dígitos y empezar por 3 (Ej. 3001234567).', 'error');
      return;
    }
    try {
      const res = await api.post('/auth/addresses', newAddress);
      if (res.data.ok) {
        setAddresses([res.data.address, ...addresses]);
        setNewAddress({
          type: 'original',
          title: 'Principal',
          street: '',
          city: '',
          state: '',
          zip_code: '',
          country: 'Colombia',
          phone: '',
          notes: '',
        });
        setShowAddressForm(false);
        showToast('Dirección guardada correctamente.', 'success');
      }
    } catch (err) {
      console.error('Error al guardar dirección:', err);
      showToast('Error al guardar la dirección.', 'error');
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta dirección?')) return;
    try {
      const res = await api.delete(`/auth/addresses/${id}`);
      if (res.data.ok) {
        setAddresses(addresses.filter(a => a.id !== id));
        showToast('Dirección eliminada.', 'success');
      }
    } catch (err) {
      console.error('Error al eliminar dirección:', err);
    }
  };

  const handleExportData = async () => {
    setPrivacyBusy(true);
    try {
      const res = await api.get('/auth/me/export');
      if (!res.data?.ok) throw new Error('export failed');
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glopsy-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Descarga de tus datos generada.', 'success');
    } catch (err) {
      console.error('Error al exportar datos:', err);
      showToast('No fue posible exportar tus datos.', 'error');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleDeleteBiometric = async () => {
    if (!window.confirm('¿Eliminar tus datos biométricos y revocar esta autorización?')) return;
    setPrivacyBusy(true);
    try {
      await api.delete('/auth/biometric');
      await api.post('/auth/consent', { consentType: 'biometric', accepted: false, source: 'revoke' }).catch(() => {});
      const consentRes = await api.get('/auth/consents').catch(() => ({ data: { consents: [] } }));
      if (consentRes.data?.ok) setConsents(consentRes.data.consents || []);
      showToast('Datos biométricos eliminados.', 'success');
    } catch (err) {
      console.error('Error al eliminar datos biométricos:', err);
      showToast('No se pudieron eliminar tus datos biométricos.', 'error');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    const first = window.confirm(
      '¿Eliminar tu cuenta? Esta acción es irreversible y borrará tus datos personales (direcciones, métodos de pago guardados, huellas y sesión).'
    );
    if (!first) return;
    const typed = window.prompt('Escribe ELIMINAR para confirmar la eliminación definitiva de tu cuenta:');
    if (typed !== 'ELIMINAR') {
      showToast('Eliminación cancelada.', 'error');
      return;
    }
    setPrivacyBusy(true);
    try {
      await api.delete('/auth/me', { data: { confirm: true } });
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error al eliminar cuenta:', err);
      showToast('No fue posible eliminar la cuenta.', 'error');
      setPrivacyBusy(false);
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
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white animate-in fade-in slide-in-from-bottom-4 duration-200 ${message.type === 'error' ? 'bg-pink-600' : 'bg-emerald-600'}`}>
          {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
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
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'privacy' ? 'border-fuchsia-600 text-fuchsia-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <Lock size={18} />
          Privacidad
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
                  const freeType = addresses.some(a => a.type === 'original') ? 'opcional' : 'original';
                  setNewAddress(prev => ({ ...prev, type: freeType, title: freeType === 'original' ? 'Principal' : 'Opcional' }));
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
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-700 uppercase">Tipo de dirección</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    disabled={addresses.some(a => a.type === 'original')}
                    onClick={() => setNewAddress(prev => ({ ...prev, type: 'original', title: 'Principal' }))}
                    className={`px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${newAddress.type === 'original' ? 'bg-fuchsia-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Principal
                  </button>
                  <button
                    type="button"
                    disabled={addresses.some(a => a.type === 'opcional')}
                    onClick={() => setNewAddress(prev => ({ ...prev, type: 'opcional', title: 'Opcional' }))}
                    className={`px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${newAddress.type === 'opcional' ? 'bg-fuchsia-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Opcional
                  </button>
                </div>
              </div>
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
                        {addr.type === 'original' ? 'Principal' : 'Opcional'}
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

      {/* Tab 3: Privacidad y datos personales */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-fuchsia-100 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download size={20} className="text-fuchsia-500" />
              Tus datos personales
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              En cumplimiento de la Ley 1581 de 2012, puedes acceder, actualizar, rectificar y suprimir
              tus datos personales, así como conocer las autorizaciones que has otorgado.
            </p>
            <button
              type="button"
              onClick={handleExportData}
              disabled={privacyBusy}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-md shadow-fuchsia-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download size={17} />
              Descargar mis datos
            </button>

            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                Historial de autorizaciones
              </h3>
              {consents.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No hay autorizaciones registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {consents.map((c) => (
                    <li
                      key={c.id}
                      className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 border border-slate-100 dark:border-zinc-800 rounded-xl px-3 py-2"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {c.accepted_at ? new Date(c.accepted_at).toLocaleString('es-CO') : '—'}
                      </span>
                      {c.metadata?.consentType ? (
                        <span>
                          {c.metadata.consentType === 'biometric' ? 'Datos biométricos' : c.metadata.consentType}
                          {c.accepted === false ? ' (revocada)' : ''}
                        </span>
                      ) : (
                        <>
                          <span>Términos: {c.terms_version || '—'}</span>
                          <span>Privacidad: {c.privacy_version || '—'}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-fuchsia-100 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield size={20} className="text-fuchsia-500" />
              Datos biométricos
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              La autenticación biométrica (huella o rostro) es opcional. Puedes revocar esta autorización y
              eliminar tus datos biométricos en cualquier momento; seguirás pudiendo iniciar sesión con tu
              contraseña.
            </p>
            <button
              type="button"
              onClick={handleDeleteBiometric}
              disabled={privacyBusy}
              className="inline-flex items-center gap-2 border border-fuchsia-600 text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30 font-medium px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash size={17} />
              Revocar y eliminar mis datos biométricos
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash size={20} />
              Eliminar mi cuenta
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Esta acción es irreversible. Se eliminarán tus datos personales (perfil, direcciones, métodos
              de pago guardados, credenciales biométricas y sesiones). Conservaremos únicamente la
              información que la ley nos obliga a mantener por motivos fiscales y contables.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={privacyBusy}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash size={17} />
              Eliminar mi cuenta y mis datos
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
