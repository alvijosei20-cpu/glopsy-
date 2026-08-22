import { useState, useEffect } from 'react';
import { Search, AlertCircle, Save, CheckCircle2, DollarSign, Tag, Layers, Image as ImageIcon, MapPin, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import '../panel/panel.css';

export default function Publish() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [productId, setProductId] = useState('');
  const [productData, setProductData] = useState(null);
  const [apiStatus, setApiStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [publishError, setPublishError] = useState('');

  // Estados para Centros de Distribución (Fullments) y Perfiles de Envío de la tienda
  const [fullments, setFullments] = useState([]);
  const [selectedFullmentId, setSelectedFullmentId] = useState('');
  const [perfilesEnvio, setPerfilesEnvio] = useState([]);
  const [selectedPerfilEnvioId, setSelectedPerfilEnvioId] = useState('');

  // Formulario editable procesado
  const [editableProduct, setEditableProduct] = useState({
    name: '',
    idProduct: '',
    urlImageProduct: '',
    basePrice: 0,
    suggestedPrice: '',
    baseCurrencyPrice: 'USD',
    stockTotal: 0,
    productOwner: {},
    description: '',
    warrantyPeriod: '',
    warrantyConditions: '',
    supportEmail: '',
    warrantyPhone: '',
    productProperties: [],
    variation: [],
    selectedOptions: {},
    selectedVariantId: '',
  });

  // Cargar integraciones configuradas de la tienda, centros de distribución y perfiles de envío
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [intRes, fullRes, perfilesRes] = await Promise.all([
          api.get('/tienda/integraciones'),
          api.get('/geo/fullments/mine'),
          api.get('/tienda/perfiles-envio').catch(() => ({ data: { perfiles: [] } }))
        ]);

        if (intRes.data && intRes.data.integraciones) {
          const configured = Object.entries(intRes.data.integraciones)
            .filter(([_, apiKey]) => Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim()))
            .map(([provider]) => ({
              id: provider,
              name: provider === 'mastershop' ? 'Mastershop' : provider.charAt(0).toUpperCase() + provider.slice(1)
            }));
          setIntegrations(configured);
          if (configured.length > 0) {
            setSelectedProvider(configured[0].id);
          }
        }

        if (fullRes.data && fullRes.data.fullments) {
          setFullments(fullRes.data.fullments);
          if (fullRes.data.fullments.length > 0) {
            setSelectedFullmentId(fullRes.data.fullments[0].fullment_id);
          }
        }

        if (perfilesRes.data && perfilesRes.data.perfiles) {
          setPerfilesEnvio(perfilesRes.data.perfiles.filter(p => p.estado === 'activo' || p.estado === undefined));
        }
      } catch (err) {
        console.error('Error al cargar datos iniciales:', err);
        setError('No se pudieron cargar los datos iniciales de integraciones y distribución.');
      }
    };
    fetchInitialData();
  }, []);

  // Procesar JSON crudo de Mastershop a campos editables mapeando la plantilla de componentes
  useEffect(() => {
    if (productData) {
      const raw = productData?.results ? productData.results[0] : (productData?.product || productData?.data || productData?.item || productData || {});
      const productProperties = raw.productProperties || raw.options || [];
      const variation = raw.variation || raw.variants || [];
      const initialSelectedOptions = {};

      productProperties.forEach((prop, idx) => {
        const propName = prop.name || `property_${idx}`;
        const values = prop.values || [];
        const firstVal = values[0];
        const firstValName = typeof firstVal === 'object' ? (firstVal.nameValue || firstVal.name || firstVal.value || '') : firstVal;
        initialSelectedOptions[propName] = firstValName;
      });

      const initialVariantId = variation[0]?.idVariant || variation[0]?.id || '';

      setEditableProduct({
        name: raw.name || raw.title || raw.product_name || raw.nombre || 'Sin título',
        idProduct: raw.idProduct || raw.id || productId,
        urlImageProduct: raw.urlImageProduct || raw.image || raw.image_url || raw.foto || (raw.images && (raw.images[0]?.src || raw.images[0])) || '',
        basePrice: raw.basePrice || raw.price || 0,
        suggestedPrice: raw.suggestedPrice || raw.selling_price || raw.price || raw.precio || '0.00',
        baseCurrencyPrice: raw.baseCurrencyPrice || raw.currency || 'USD',
        stockTotal: raw.stockTotal || 0,
        productOwner: raw.productOwner || { publicName: 'Mastershop Seller' },
        description: raw.description || raw.body_html || raw.descripcion || '',
        warrantyPeriod: raw.warrantyPeriod || raw.warranty_period || '0',
        warrantyConditions: raw.warrantyConditions || raw.warranty_conditions || '',
        supportEmail: raw.supportEmail || raw.support_email || '',
        warrantyPhone: raw.warrantyPhone || raw.warranty_phone || '',
        productProperties,
        variation,
        selectedOptions: initialSelectedOptions,
        selectedVariantId: initialVariantId,
      });
    }
  }, [productData, productId]);

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!selectedProvider) {
      setError('Selecciona un proveedor de integración.');
      return;
    }
    if (!productId.trim()) {
      setError('Ingresa el ID del producto a consultar.');
      return;
    }

    setError('');
    setPublishError('');
    setProductData(null);
    setApiStatus('loading');

    try {
      const { data } = await api.get(`/tienda/integraciones/query?provider=${selectedProvider}&productId=${encodeURIComponent(productId.trim())}`);
      setProductData(data.data);
      setApiStatus('success');
      setTimeout(() => setApiStatus('idle'), 1200);
    } catch (err) {
      setApiStatus('error');
      if (err.response?.status === 404 || err.response?.data?.status === 404 || err.status === 404 || (err.response?.data?.message && String(err.response.data.message).includes('404')) || (err.message && String(err.message).includes('404'))) {
        setError('( es posible que no exista en articulo)');
      } else {
        setError(err.response?.data?.message || 'Error al consultar el producto en la API externa.');
      }
      setTimeout(() => setApiStatus('idle'), 2000);
    }
  };

  const handleOptionChange = (propName, value) => {
    const newSelectedOptions = {
      ...editableProduct.selectedOptions,
      [propName]: value,
    };

    let matchedVariant = null;
    if (editableProduct.variation && editableProduct.variation.length > 0) {
      matchedVariant = editableProduct.variation.find(v => {
        const vAttrs = v.options || v.attributes || v.values || v.selectedOptions || [];
        return Object.entries(newSelectedOptions).every(([optKey, optVal]) => {
          return vAttrs.some(attr => {
            const aName = attr.name || attr.title;
            const aVal = String(attr.nameValue || attr.value || attr.val || attr);
            return (aName === optKey || !aName) && aVal === String(optVal);
          });
        });
      }) || editableProduct.variation[0];
    }

    setEditableProduct((prev) => ({
      ...prev,
      selectedOptions: newSelectedOptions,
      selectedVariantId: matchedVariant?.idVariant || matchedVariant?.id || prev.selectedVariantId,
      suggestedPrice: matchedVariant?.suggestedPrice || matchedVariant?.price || matchedVariant?.precio || prev.suggestedPrice,
      urlImageProduct: matchedVariant?.urlImageProduct || matchedVariant?.image || matchedVariant?.image_url || prev.urlImageProduct,
    }));
  };

  const handleSaveOrPublish = async (e) => {
    e.preventDefault();
    setPublishError('');
    setNotice('');

    if (!selectedFullmentId) {
      setPublishError('Debes seleccionar un centro de distribución guardado para poder publicar el producto.');
      return;
    }

    const payloadToPublish = {
      idProduct: editableProduct.idProduct,
      idVariant: editableProduct.selectedVariantId,
      name: editableProduct.name,
      basePrice: editableProduct.basePrice,
      suggestedPrice: editableProduct.suggestedPrice,
      baseCurrencyPrice: editableProduct.baseCurrencyPrice,
      urlImageProduct: editableProduct.urlImageProduct,
      description: editableProduct.description,
      warrantyPeriod: editableProduct.warrantyPeriod,
      warrantyConditions: editableProduct.warrantyConditions,
      supportEmail: editableProduct.supportEmail,
      warrantyPhone: editableProduct.warrantyPhone,
      selectedOptions: editableProduct.selectedOptions,
      variation: editableProduct.variation,
      productOwner: editableProduct.productOwner,
      stockTotal: editableProduct.stockTotal,
      fullmId: selectedFullmentId,
      perfilEnvioId: selectedPerfilEnvioId ? Number(selectedPerfilEnvioId) : null,
      provider: selectedProvider,
    };

    setApiStatus('loading');

    try {
      await api.post('/product', payloadToPublish);
      setApiStatus('idle');
      setProductData(null);
      setProductId('');
      setNotice('¡Publicado con éxito!');
      setTimeout(() => setNotice(''), 3500);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setApiStatus('idle');
      console.error('Error al publicar producto:', err);
      const serverMsg = err.response?.data?.message || err.message;
      setPublishError(serverMsg ? `Error: ${serverMsg}` : 'Error al guardar el producto en la base de datos.');
    }
  };

  return (
    <section className="panel" aria-labelledby="publish-title">
      <ApiLoadingModal
        status={apiStatus}
        message="Consultando API..."
        successMessage="¡Datos cargados con éxito!"
        errorMessage="Error en la consulta"
      />

      <div className="panel__heading">
        <div>
          <p className="panel__eyebrow">Sincronización y Publicación</p>
          <h1 id="publish-title">Publicar Producto</h1>
          <p>Consulta productos, selecciona el centro de distribución guardado, edita y publica.</p>
        </div>
      </div>

      {error && (
        <div className="panel__error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {notice && (
        <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', padding: '1rem 1.2rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <CheckCircle2 size={20} /> {notice}
        </div>
      )}

      {/* Formulario de Consulta (Solo Integración e ID del Producto) */}
      <form onSubmit={handleQuery} style={{ background: '#ffffff', color: '#18181b', padding: '1.8rem', borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 12px #DCDBDA', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="provider-select" style={{ color: '#27272a', fontWeight: 600, fontSize: '0.95rem' }}>
            Selecciona la Integración
          </label>
          <select
            id="provider-select"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#18181b', border: '1px solid #d4d4d8', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
          >
            {integrations.length === 0 ? (
              <option value="">No hay integraciones configuradas</option>
            ) : (
              integrations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="product-id-input" style={{ color: '#27272a', fontWeight: 600, fontSize: '0.95rem' }}>
            ID del Producto
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
            <input
              id="product-id-input"
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Ej. 12345 o prod_abc"
              style={{ flex: '1 1 220px', minWidth: '0', padding: '0.75rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#18181b', border: '1px solid #d4d4d8', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={integrations.length === 0 || !productId.trim()}
              style={{
                flex: '0 0 auto',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(90deg, #db2777 0%, #9333ea 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(219, 39, 119, 0.3)',
              }}
            >
              <Search size={18} /> Consultar
            </button>
          </div>
        </div>
      </form>

      {/* Formulario Procesado y Editable del Producto con Centro de Distribución en los resultados */}
      {productData && (
        <form onSubmit={handleSaveOrPublish} style={{ background: '#ffffff', color: '#18181b', padding: '1.8rem', borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 12px #DCDBDA', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', paddingBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#18181b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
              <Layers size={22} style={{ color: '#db2777' }} /> Producto Procesado & Editable
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#047857', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
              Listo
            </span>
          </div>

          {/* Centro de Distribución (Obligatorio - Solo los guardados de la tienda) */}
          <div style={{ background: '#fdf2f8', padding: '1.2rem', borderRadius: '10px', border: '1px solid #f472b6', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label htmlFor="fullment-select" style={{ color: '#831843', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} style={{ color: '#db2777' }} /> Centro de Distribución (Obligatorio) *
            </label>
            <select
              id="fullment-select"
              value={selectedFullmentId}
              onChange={(e) => {
                setSelectedFullmentId(e.target.value);
                setSelectedPerfilEnvioId('');
              }}
              required
              style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#18181b', border: '1px solid #f472b6', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
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
          </div>

          {/* Perfil de Envío (Opcional - Asociado al centro de distribución seleccionado) */}
          <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label htmlFor="perfil-envio-select" style={{ color: '#334155', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={16} style={{ color: '#0284c7' }} /> Perfil de Envío (Opcional)
            </label>
            <select
              id="perfil-envio-select"
              value={selectedPerfilEnvioId}
              onChange={(e) => setSelectedPerfilEnvioId(e.target.value)}
              style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#18181b', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Ninguno (Usar cálculo automático de envío)</option>
              {perfilesEnvio
                .filter(p => String(p.fullment_id) === String(selectedFullmentId))
                .map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nombre} — {String(perfil.tipo || '').toUpperCase()} ({perfil.alcance})
                  </option>
                ))}
            </select>
            {perfilesEnvio.filter(p => String(p.fullment_id) === String(selectedFullmentId)).length === 0 && (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                No hay perfiles de envío para este centro de distribución. Créalos en Mi Tienda.
              </span>
            )}
          </div>

          {/* Imagen principal y Título */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                Imagen Principal
              </label>
              {editableProduct.urlImageProduct ? (
                <img src={editableProduct.urlImageProduct} alt={editableProduct.name} style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #d4d4d8' }} />
              ) : (
                <div style={{ width: '100%', height: '180px', background: '#f4f4f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
                  <ImageIcon size={32} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                  Título del Producto
                </label>
                <input
                  type="text"
                  value={editableProduct.name}
                  onChange={(e) => setEditableProduct({ ...editableProduct, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#18181b', border: '1px solid #d4d4d8', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                  ID Producto / Variante Seleccionada
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <input
                    type="text"
                    readOnly
                    value={`ID: ${editableProduct.idProduct}`}
                    style={{ flex: '1 1 120px', minWidth: '0', padding: '0.75rem 1rem', borderRadius: '8px', background: '#e4e4e7', color: '#52525b', border: '1px solid #d4d4d8', fontSize: '0.85rem', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                  <input
                    type="text"
                    readOnly
                    value={`Variante: ${editableProduct.selectedVariantId || 'N/A'}`}
                    style={{ flex: '1 1 120px', minWidth: '0', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fce7f3', color: '#db2777', border: '1px solid #f472b6', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Precios: Precio Base y Precio de Venta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <DollarSign size={16} /> Precio Base (${editableProduct.basePrice} {editableProduct.baseCurrencyPrice})
              </label>
              <input
                type="text"
                readOnly
                value={`$${editableProduct.basePrice} ${editableProduct.baseCurrencyPrice}`}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#52525b', border: '1px solid #d4d4d8', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#db2777' }}>
                <Tag size={16} /> Precio de Venta
              </label>
              <input
                type="text"
                value={editableProduct.suggestedPrice}
                onChange={(e) => setEditableProduct({ ...editableProduct, suggestedPrice: e.target.value })}
                placeholder="Ej. 49.99"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fdf2f8', color: '#18181b', border: '1px solid #f472b6', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Información adicional de Mastershop (Vendedor y Stock Total) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdf4ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #f5d0fe', fontSize: '0.9rem', color: '#701a75', flexWrap: 'wrap', gap: '8px' }}>
            <span>👤 Vendedor: <strong>{editableProduct.productOwner?.publicName || 'Mastershop Seller'}</strong></span>
            <span>📦 Stock Total: <strong>{editableProduct.stockTotal} unidades</strong></span>
          </div>

          {/* Selector de Talla (Select / Dropdown no editable directamente, solo selección) */}
          {editableProduct.productProperties && editableProduct.productProperties.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} /> Selector de Talla / Variantes
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {editableProduct.productProperties.map((prop, idx) => {
                  const propName = prop.name || `property_${idx}`;
                  const values = prop.values || [];
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#52525b' }}>{propName}</span>
                      <select
                        value={editableProduct.selectedOptions[propName] || ''}
                        onChange={(e) => handleOptionChange(propName, e.target.value)}
                        style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#18181b', border: '1px solid #d4d4d8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                      >
                        {values.map((val, vIdx) => {
                          const valName = typeof val === 'object' ? (val.nameValue || val.name || val.value || '') : val;
                          return (
                            <option key={vIdx} value={valName}>
                              {valName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Descripción (respetando saltos de línea) */}
          <div>
            <label style={{ color: '#27272a', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
              Descripción
            </label>
            <textarea
              rows={4}
              value={editableProduct.description}
              onChange={(e) => setEditableProduct({ ...editableProduct, description: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#f4f4f5', color: '#18181b', border: '1px solid #d4d4d8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', whiteSpace: 'pre-wrap' }}
            />
          </div>

          {/* Garantía e Info de Soporte */}
          <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Garantía e Información de Soporte</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ color: '#475569', fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                  Período de Garantía (días)
                </label>
                <input
                  type="text"
                  value={editableProduct.warrantyPeriod}
                  onChange={(e) => setEditableProduct({ ...editableProduct, warrantyPeriod: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: '#ffffff', color: '#18181b', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ color: '#475569', fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                  Email de Soporte
                </label>
                <input
                  type="text"
                  value={editableProduct.supportEmail}
                  onChange={(e) => setEditableProduct({ ...editableProduct, supportEmail: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: '#ffffff', color: '#18181b', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ color: '#475569', fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                  Teléfono de Soporte
                </label>
                <input
                  type="text"
                  value={editableProduct.warrantyPhone}
                  onChange={(e) => setEditableProduct({ ...editableProduct, warrantyPhone: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: '#ffffff', color: '#18181b', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div>
              <label style={{ color: '#475569', fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                Condiciones de Garantía
              </label>
              <textarea
                rows={2}
                value={editableProduct.warrantyConditions}
                onChange={(e) => setEditableProduct({ ...editableProduct, warrantyConditions: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: '#ffffff', color: '#18181b', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Botón de Publicar Producto */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            {publishError && (
              <div className="panel__error" role="alert" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box' }}>
                <AlertCircle size={18} /> {publishError}
              </div>
            )}
            <button
              type="submit"
              disabled={!selectedFullmentId}
              style={{
                padding: '0.85rem 2.5rem',
                borderRadius: '8px',
                border: 'none',
                background: selectedFullmentId ? 'linear-gradient(90deg, #db2777 0%, #9333ea 100%)' : '#a1a1aa',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: selectedFullmentId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: selectedFullmentId ? '0 4px 12px rgba(219, 39, 119, 0.3)' : 'none',
              }}
            >
              <Save size={18} /> Publicar Producto
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
