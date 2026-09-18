import { useState, useRef } from 'react';
import {
  AlertCircle,
  Save,
  Image as ImageIcon,
  MapPin,
  Package,
  Tag,
  DollarSign,
  Layers,
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { compressToWebp, MAX_IMAGES } from '../utils/imageCompress';

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  background: '#f4f4f5',
  color: '#18181b',
  border: '1px solid #d4d4d8',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  color: '#27272a',
  fontWeight: 600,
  fontSize: '0.9rem',
  display: 'block',
  marginBottom: '6px',
};

const errorStyle = { color: '#dc2626', fontSize: '0.78rem', marginTop: '4px', fontWeight: 500 };

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

const emptyForm = (currency) => ({
  name: '',
  description: '',
  categoriaId: '',
  suggestedPrice: '',
  basePrice: '',
  baseCurrencyPrice: currency || 'COP',
  stockTotal: '',
  images: [],
  variants: [],
  warrantyPeriod: '',
  warrantyConditions: '',
  supportEmail: '',
  warrantyPhone: '',
});

export default function ManualProductForm({
  tienda,
  fullments = [],
  selectedFullmentId,
  onFullmentChange,
  perfilesEnvio = [],
  selectedPerfilEnvioId,
  onPerfilChange,
  categories = [],
  publishing = false,
  publishError = '',
  onPublish,
}) {
  const currency = tienda?.moneda || 'COP';
  const [form, setForm] = useState(() => emptyForm(currency));
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageError, setImageError] = useState('');
  const [processingImages, setProcessingImages] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const setVariant = (idx, patch) => {
    setForm((prev) => {
      const variants = [...prev.variants];
      variants[idx] = { ...variants[idx], ...patch };
      return { ...prev, variants };
    });
  };

  const addVariant = () => update({ variants: [...form.variants, { name: '', stock: '' }] });

  const removeVariant = (idx) =>
    update({ variants: form.variants.filter((_, i) => i !== idx) });

  const handleFiles = async (fileList) => {
    setImageError('');
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      setImageError(`Máximo ${MAX_IMAGES} imágenes por producto.`);
      return;
    }
    setProcessingImages(true);
    const added = [];
    try {
      for (const file of files.slice(0, room)) {
        try {
          const compressed = await compressToWebp(file);
          const { data } = await api.post('/product/images', { images: [compressed.dataUrl] });
          const url = data?.images?.[0];
          if (!data?.ok || !url) throw new Error('No se pudo subir la imagen.');
          added.push({ url, name: file.name });
        } catch (err) {
          setImageError(err.response?.data?.message || err.message);
        }
      }
      if (added.length > 0) {
        setForm((prev) => ({ ...prev, images: [...prev.images, ...added].slice(0, MAX_IMAGES) }));
      }
      if (files.length > room) {
        setImageError(`Solo se permiten ${MAX_IMAGES} imágenes. Se agregaron las primeras ${room}.`);
      }
    } finally {
      setProcessingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx) => {
    update({ images: form.images.filter((_, i) => i !== idx) });
    setImageError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'El título es obligatorio.';
    else if (form.name.trim().length < 3) errors.name = 'El título debe tener al menos 3 caracteres.';

    if (!form.description.trim()) errors.description = 'La descripción es obligatoria.';
    else if (form.description.trim().length < 10) errors.description = 'Describe el producto (mínimo 10 caracteres).';

    const price = Number(form.suggestedPrice);
    if (form.suggestedPrice === '' || Number.isNaN(price) || price <= 0) {
      errors.suggestedPrice = 'Ingresa un precio de venta mayor a 0.';
    }
    if (form.basePrice !== '' && (Number.isNaN(Number(form.basePrice)) || Number(form.basePrice) < 0)) {
      errors.basePrice = 'El precio base no puede ser negativo.';
    }
    const stock = Number(form.stockTotal);
    if (form.stockTotal === '' || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.stockTotal = 'Ingresa un stock válido (entero mayor o igual a 0).';
    }
    if (!form.baseCurrencyPrice) errors.baseCurrencyPrice = 'La moneda es obligatoria.';

    if (form.images.length === 0) errors.images = 'Sube al menos una imagen.';
    if (form.images.length > MAX_IMAGES) errors.images = `Máximo ${MAX_IMAGES} imágenes.`;

    form.variants.forEach((v, idx) => {
      if (!String(v.name || '').trim()) {
        errors[`variant_name_${idx}`] = 'La variante necesita un nombre.';
      }
      const vStock = Number(v.stock);
      if (v.stock !== '' && (Number.isNaN(vStock) || vStock < 0 || !Number.isInteger(vStock))) {
        errors[`variant_stock_${idx}`] = 'Stock inválido.';
      }
    });

    if (form.warrantyPeriod !== '' && (Number.isNaN(Number(form.warrantyPeriod)) || Number(form.warrantyPeriod) < 0)) {
      errors.warrantyPeriod = 'El período de garantía no puede ser negativo.';
    }
    if (form.supportEmail && !isEmail(form.supportEmail)) {
      errors.supportEmail = 'Correo de soporte inválido.';
    }
    if (form.warrantyPhone && String(form.warrantyPhone).replace(/[^\d]/g, '').length < 7) {
      errors.warrantyPhone = 'Teléfono de soporte inválido.';
    }
    if (!selectedFullmentId) errors.fullment = 'Selecciona un centro de distribución.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(false);
    if (!validate()) return;

    const cleanVariants = form.variants
      .filter((v) => String(v.name || '').trim())
      .map((v, idx) => ({
        idVariant: `v${idx + 1}`,
        name: String(v.name).trim(),
        stock: v.stock === '' ? 0 : Number(v.stock),
      }));

    const payload = {
      provider: 'manual',
      name: form.name.trim(),
      description: form.description.replace(/\r?\n/g, '<br/>'),
      basePrice: form.basePrice === '' ? 0 : Number(form.basePrice),
      suggestedPrice: Number(form.suggestedPrice),
      baseCurrencyPrice: form.baseCurrencyPrice,
      stockTotal: Number(form.stockTotal),
      images: form.images.map((img) => img.url),
      variation: cleanVariants,
      selectedOptions: {},
      productOwner: { publicName: tienda?.nombres || 'Vendedor' },
      warrantyPeriod: form.warrantyPeriod === '' ? '' : String(Number(form.warrantyPeriod)),
      warrantyConditions: form.warrantyConditions,
      supportEmail: form.supportEmail.trim(),
      warrantyPhone: form.warrantyPhone.trim(),
      categoriaId: form.categoriaId ? Number(form.categoriaId) : null,
      fullmId: selectedFullmentId,
      perfilEnvioId: selectedPerfilEnvioId ? Number(selectedPerfilEnvioId) : null,
    };

    const ok = await onPublish(payload);
    if (ok) {
      setForm(emptyForm(currency));
      setFieldErrors({});
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 3500);
    }
  };

  const perfilesDelCentro = perfilesEnvio.filter(
    (p) => String(p.fullment_id) === String(selectedFullmentId)
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#ffffff',
        color: '#18181b',
        padding: '1.8rem',
        borderRadius: '12px',
        border: '1px solid #e4e4e7',
        boxShadow: '0 4px 12px #DCDBDA',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', paddingBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ color: '#18181b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
          <Layers size={22} style={{ color: '#db2777' }} /> Nuevo Producto
        </h3>
        {success && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#047857', background: 'rgba(16,185,129,0.12)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
            <CheckCircle2 size={16} /> Publicado
          </span>
        )}
      </div>

      {/* Centro de distribución (obligatorio) */}
      <div style={{ background: '#fdf2f8', padding: '1.2rem', borderRadius: '10px', border: '1px solid #f472b6', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <label htmlFor="manual-fullment" style={{ color: '#831843', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={16} style={{ color: '#db2777' }} /> Centro de Distribución (Obligatorio) *
        </label>
        <select
          id="manual-fullment"
          value={selectedFullmentId || ''}
          onChange={(e) => onFullmentChange(e.target.value)}
          style={{ ...inputStyle, background: '#ffffff', border: '1px solid #f472b6' }}
        >
          {fullments.length === 0 ? (
            <option value="">No tienes centros de distribución guardados. Configúralos en Mi Tienda.</option>
          ) : (
            <>
              <option value="">Selecciona un centro de distribución guardado</option>
              {fullments.map((f) => (
                <option key={f.fullment_id} value={f.fullment_id}>
                  {f.ciudad_nombre} ({f.departamento_nombre}, {f.pais_nombre})
                </option>
              ))}
            </>
          )}
        </select>
        {fieldErrors.fullment && <span style={errorStyle}>{fieldErrors.fullment}</span>}
      </div>

      {/* Perfil de envío (opcional) */}
      <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <label htmlFor="manual-perfil" style={{ color: '#334155', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={16} style={{ color: '#0284c7' }} /> Perfil de Envío (Opcional)
        </label>
        <select
          id="manual-perfil"
          value={selectedPerfilEnvioId || ''}
          onChange={(e) => onPerfilChange(e.target.value)}
          style={{ ...inputStyle, background: '#ffffff', border: '1px solid #cbd5e1' }}
        >
          <option value="">Ninguno (Usar cálculo automático de envío)</option>
          {perfilesDelCentro.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.nombre} — {String(perfil.tipo || '').toUpperCase()} ({perfil.alcance})
            </option>
          ))}
        </select>
      </div>

      {/* Título y categoría */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
        <div>
          <label style={labelStyle}>Título del Producto *</label>
          <input
            type="text"
            value={form.name}
            maxLength={255}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Ej. Camiseta deportiva"
            style={{ ...inputStyle, borderColor: fieldErrors.name ? '#dc2626' : '#d4d4d8' }}
          />
          {fieldErrors.name && <span style={errorStyle}>{fieldErrors.name}</span>}
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select
            value={form.categoriaId}
            onChange={(e) => update({ categoriaId: e.target.value })}
            style={inputStyle}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Imágenes */}
      <div>
        <label style={labelStyle}>
          Imágenes (máx {MAX_IMAGES}, se comprimen a webp) *
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
          {form.images.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', width: '120px', height: '120px' }}>
              <img
                src={img.url}
                alt={img.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px', border: '1px solid #d4d4d8' }}
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                title="Quitar imagen"
                style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {form.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processingImages}
              style={{ width: '120px', height: '120px', borderRadius: '10px', border: '2px dashed #c4b5fd', background: '#faf5ff', color: '#7e22ce', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: processingImages ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {processingImages ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
              {processingImages ? 'Comprimiendo…' : 'Subir imagen'}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        {imageError && <span style={errorStyle}>{imageError}</span>}
        {fieldErrors.images && <span style={errorStyle}>{fieldErrors.images}</span>}
        {form.images.length === 0 && !imageError && !fieldErrors.images && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            <ImageIcon size={14} /> Al menos una imagen es obligatoria.
          </span>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label style={labelStyle}>Descripción *</label>
        <textarea
          rows={5}
          value={form.description}
          maxLength={20000}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Describe características, materiales, usos, etc."
          style={{ ...inputStyle, resize: 'vertical', borderColor: fieldErrors.description ? '#dc2626' : '#d4d4d8' }}
        />
        {fieldErrors.description && <span style={errorStyle}>{fieldErrors.description}</span>}
      </div>

      {/* Precios y stock */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px', color: '#db2777' }}>
            <Tag size={16} /> Precio de Venta *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.suggestedPrice}
            onChange={(e) => update({ suggestedPrice: e.target.value })}
            placeholder="Ej. 49900"
            style={{ ...inputStyle, background: '#fdf2f8', border: `1px solid ${fieldErrors.suggestedPrice ? '#dc2626' : '#f472b6'}`, fontWeight: 700 }}
          />
          {fieldErrors.suggestedPrice && <span style={errorStyle}>{fieldErrors.suggestedPrice}</span>}
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} /> Precio Base (opcional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.basePrice}
            onChange={(e) => update({ basePrice: e.target.value })}
            placeholder="Costo de referencia"
            style={{ ...inputStyle, borderColor: fieldErrors.basePrice ? '#dc2626' : '#d4d4d8' }}
          />
          {fieldErrors.basePrice && <span style={errorStyle}>{fieldErrors.basePrice}</span>}
        </div>
        <div>
          <label style={labelStyle}>Moneda *</label>
          <select
            value={form.baseCurrencyPrice}
            onChange={(e) => update({ baseCurrencyPrice: e.target.value })}
            style={inputStyle}
          >
            {['COP', 'USD', 'VES', 'EUR', 'MXN'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {fieldErrors.baseCurrencyPrice && <span style={errorStyle}>{fieldErrors.baseCurrencyPrice}</span>}
        </div>
        <div>
          <label style={labelStyle}>Stock Total *</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.stockTotal}
            onChange={(e) => update({ stockTotal: e.target.value })}
            placeholder="Ej. 20"
            style={{ ...inputStyle, borderColor: fieldErrors.stockTotal ? '#dc2626' : '#d4d4d8' }}
          />
          {fieldErrors.stockTotal && <span style={errorStyle}>{fieldErrors.stockTotal}</span>}
        </div>
      </div>

      {/* Variantes / tallas */}
      <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} /> Variantes / Tallas (opcional)
          </h4>
          <button
            type="button"
            onClick={addVariant}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fdf2f8', color: '#db2777', border: '1px solid #f472b6', borderRadius: '8px', padding: '0.45rem 0.9rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <Plus size={15} /> Agregar variante
          </button>
        </div>
        {form.variants.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Si el producto tiene tallas/colores, agrégalos aquí (ej. "S / Rojo").
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {form.variants.map((v, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => setVariant(idx, { name: e.target.value })}
                    placeholder="Nombre de la variante (ej. S / Rojo)"
                    style={{ ...inputStyle, background: '#ffffff', borderColor: fieldErrors[`variant_name_${idx}`] ? '#dc2626' : '#cbd5e1' }}
                  />
                  {fieldErrors[`variant_name_${idx}`] && <span style={errorStyle}>{fieldErrors[`variant_name_${idx}`]}</span>}
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={v.stock}
                    onChange={(e) => setVariant(idx, { stock: e.target.value })}
                    placeholder="Stock"
                    style={{ ...inputStyle, background: '#ffffff', borderColor: fieldErrors[`variant_stock_${idx}`] ? '#dc2626' : '#cbd5e1' }}
                  />
                  {fieldErrors[`variant_stock_${idx}`] && <span style={errorStyle}>{fieldErrors[`variant_stock_${idx}`]}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  title="Quitar variante"
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Garantía y soporte */}
      <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Garantía e Información de Soporte</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ ...labelStyle, color: '#475569', fontSize: '0.85rem' }}>Período de Garantía (días)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.warrantyPeriod}
              onChange={(e) => update({ warrantyPeriod: e.target.value })}
              placeholder="Ej. 30"
              style={{ ...inputStyle, background: '#ffffff', borderColor: fieldErrors.warrantyPeriod ? '#dc2626' : '#cbd5e1' }}
            />
            {fieldErrors.warrantyPeriod && <span style={errorStyle}>{fieldErrors.warrantyPeriod}</span>}
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#475569', fontSize: '0.85rem' }}>Email de Soporte</label>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(e) => update({ supportEmail: e.target.value })}
              placeholder="soporte@tutienda.com"
              style={{ ...inputStyle, background: '#ffffff', borderColor: fieldErrors.supportEmail ? '#dc2626' : '#cbd5e1' }}
            />
            {fieldErrors.supportEmail && <span style={errorStyle}>{fieldErrors.supportEmail}</span>}
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#475569', fontSize: '0.85rem' }}>Teléfono de Soporte</label>
            <input
              type="tel"
              value={form.warrantyPhone}
              onChange={(e) => update({ warrantyPhone: e.target.value })}
              placeholder="Ej. 3001234567"
              style={{ ...inputStyle, background: '#ffffff', borderColor: fieldErrors.warrantyPhone ? '#dc2626' : '#cbd5e1' }}
            />
            {fieldErrors.warrantyPhone && <span style={errorStyle}>{fieldErrors.warrantyPhone}</span>}
          </div>
        </div>
        <div>
          <label style={{ ...labelStyle, color: '#475569', fontSize: '0.85rem' }}>Condiciones de Garantía</label>
          <textarea
            rows={2}
            value={form.warrantyConditions}
            onChange={(e) => update({ warrantyConditions: e.target.value })}
            placeholder="Ej. No cubre daños por mal uso."
            style={{ ...inputStyle, background: '#ffffff', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Publicar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        {publishError && (
          <div className="panel__error" role="alert" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box' }}>
            <AlertCircle size={18} /> {publishError}
          </div>
        )}
        <button
          type="submit"
          disabled={publishing || processingImages}
          style={{
            padding: '0.85rem 2.5rem',
            borderRadius: '8px',
            border: 'none',
            background: publishing ? '#a1a1aa' : 'linear-gradient(90deg, #db2777 0%, #9333ea 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: publishing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: publishing ? 'none' : '0 4px 12px rgba(219, 39, 119, 0.3)',
          }}
        >
          {publishing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {publishing ? 'Publicando…' : 'Publicar Producto'}
        </button>
      </div>
    </form>
  );
}
