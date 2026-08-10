import { useState, useEffect } from 'react';
import { Truck, Tag, Receipt, Warehouse, CreditCard, Plus, CheckCircle, Trash2, Code, KeyRound, Shield, Hash, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './marketConfig.css';

const MarketConfig = () => {
  const { tienda } = useAuth();
  const [activeTab, setActiveTab] = useState('envios');
  const [notice, setNotice] = useState('');
  const [ciudades, setCiudades] = useState([]);
  const [fullments, setFullments] = useState([]);
  const [selectedCiudadId, setSelectedCiudadId] = useState('');
  const [dianConfig, setDianConfig] = useState({
    sw_id: '',
    sw_pin: '',
    technical_key: '',
    prefix: '',
    test_set_id: ''
  });
  const [mpMode, setMpMode] = useState('prueba');
  const [enviaMode, setEnviaMode] = useState('prueba');

  const [mercadoPagoConfigs, setMercadoPagoConfigs] = useState({
    prueba: { public_key: '', access_token: '' },
    produccion: { public_key: '', access_token: '' }
  });
  const [initialMercadoPagoConfigs, setInitialMercadoPagoConfigs] = useState({
    prueba: { public_key: '', access_token: '' },
    produccion: { public_key: '', access_token: '' }
  });

  const [enviaConfigs, setEnviaConfigs] = useState({
    prueba: { access_token: '' },
    produccion: { access_token: '' }
  });
  const [initialEnviaConfigs, setInitialEnviaConfigs] = useState({
    prueba: { access_token: '' },
    produccion: { access_token: '' }
  });

  const mercadoPagoConfig = mercadoPagoConfigs[mpMode];
  const initialMercadoPagoConfig = initialMercadoPagoConfigs[mpMode];
  const enviaConfig = enviaConfigs[enviaMode];
  const initialEnviaConfig = initialEnviaConfigs[enviaMode];

  const setMercadoPagoConfig = (updater) => {
    setMercadoPagoConfigs(prev => ({
      ...prev,
      [mpMode]: typeof updater === 'function' ? updater(prev[mpMode]) : updater
    }));
  };

  const setEnviaConfig = (updater) => {
    setEnviaConfigs(prev => ({
      ...prev,
      [enviaMode]: typeof updater === 'function' ? updater(prev[enviaMode]) : updater
    }));
  };

  const [savedCheckoutIntegrations, setSavedCheckoutIntegrations] = useState([]);

  // Cargar ciudades, centros de distribución, configuración DIAN e integraciones de checkout al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resCiudades, resFullments, resDian, resCheckout] = await Promise.all([
          api.get('/geo/ciudades'),
          api.get('/geo/fullments/mine'),
          api.get('/tienda/dian').catch(() => ({ data: {} })),
          api.get('/tienda/checkout-integrations').catch(() => ({ data: { integrations: [] } }))
        ]);
        if (resCiudades.data && resCiudades.data.ciudades) {
          setCiudades(resCiudades.data.ciudades);
        }
        if (resFullments.data && resFullments.data.fullments) {
          const uniqueFullments = Array.from(
            new Map(resFullments.data.fullments.map(item => [item.fullment_id, item])).values()
          );
          setFullments(uniqueFullments);
        }
        if (resDian.data && resDian.data.dian) {
          setDianConfig(resDian.data.dian);
        }
        if (resCheckout.data && resCheckout.data.integrations) {
          const integrations = resCheckout.data.integrations;
          setSavedCheckoutIntegrations(integrations);

          const mpPrueba = integrations.find(i => i.provider === 'mercadopago' && (i.mode === 'prueba' || !i.mode));
          const mpProd = integrations.find(i => i.provider === 'mercadopago' && i.mode === 'produccion');
          const newMp = {
            prueba: { public_key: mpPrueba?.public_key || '', access_token: mpPrueba?.access_token || '' },
            produccion: { public_key: mpProd?.public_key || '', access_token: mpProd?.access_token || '' }
          };
          setMercadoPagoConfigs(newMp);
          setInitialMercadoPagoConfigs(JSON.parse(JSON.stringify(newMp)));

          const enviaPrueba = integrations.find(i => i.provider === 'envia' && (i.mode === 'prueba' || !i.mode));
          const enviaProd = integrations.find(i => i.provider === 'envia' && i.mode === 'produccion');
          const newEnvia = {
            prueba: { access_token: enviaPrueba?.access_token || '' },
            produccion: { access_token: enviaProd?.access_token || '' }
          };
          setEnviaConfigs(newEnvia);
          setInitialEnviaConfigs(JSON.parse(JSON.stringify(newEnvia)));
        }
        // fetch shipping profiles
        const resPerfiles = await api.get('/tienda/perfiles-envio').catch(() => ({ data: { perfiles: [] } }));
        if (resPerfiles.data?.perfiles) {
          const p = resPerfiles.data.perfiles.map(pp => ({ id: pp.id, nombre: pp.nombre, tipo: pp.tipo, fullment_id: pp.fullment_id, costo: pp.costo, isGlobal: pp.alcance === 'global' }));
          setPerfilesEnvio(p);
          setEnvioGratisTienda(p.some(x => x.isGlobal));
        }
      } catch (err) {
        console.error('Error al cargar datos de configuración:', err);
      }
    };
    fetchData();
  }, []);

  const hasMercadoPagoChanges = () => {
    return (
      mercadoPagoConfig.public_key !== initialMercadoPagoConfig.public_key ||
      mercadoPagoConfig.access_token !== initialMercadoPagoConfig.access_token
    );
  };

  const hasEnviaChanges = () => {
    return (
      enviaConfig.access_token !== initialEnviaConfig.access_token
    );
  };

  const handleSaveMercadoPago = async (e) => {
    e.preventDefault();
    if (!mercadoPagoConfig.public_key || !mercadoPagoConfig.public_key.trim() || !mercadoPagoConfig.access_token || !mercadoPagoConfig.access_token.trim()) {
      setNotice('Error: Todos los campos de Mercado Pago son obligatorios y no pueden quedar vacíos.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    try {
      const res = await api.post('/tienda/checkout-integrations', {
        provider: 'mercadopago',
        mode: mpMode,
        public_key: mercadoPagoConfig.public_key,
        access_token: mercadoPagoConfig.access_token
      });
      setNotice(res.data.message || 'Configuración de Mercado Pago guardada con éxito.');
      setTimeout(() => setNotice(''), 3000);
      setInitialMercadoPagoConfigs({
        ...initialMercadoPagoConfigs,
        [mpMode]: { ...mercadoPagoConfig }
      });
      const resCheckout = await api.get('/tienda/checkout-integrations');
      if (resCheckout.data && resCheckout.data.integrations) {
        setSavedCheckoutIntegrations(resCheckout.data.integrations);
      }
    } catch (err) {
      console.error('Error al guardar Mercado Pago:', err);
      setNotice(err.response?.data?.message || 'Error al guardar la configuración de Mercado Pago.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleSaveEnvia = async (e) => {
    e.preventDefault();
    if (!enviaConfig.access_token || !enviaConfig.access_token.trim()) {
      setNotice('Error: El token de acceso de ENVIA es obligatorio y no puede quedar vacío.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    try {
      const res = await api.post('/tienda/checkout-integrations', {
        provider: 'envia',
        mode: enviaMode,
        access_token: enviaConfig.access_token
      });
      setNotice(res.data.message || 'Configuración de ENVIA guardada con éxito.');
      setTimeout(() => setNotice(''), 3000);
      setInitialEnviaConfigs({
        ...initialEnviaConfigs,
        [enviaMode]: { ...enviaConfig }
      });
      const resCheckout = await api.get('/tienda/checkout-integrations');
      if (resCheckout.data && resCheckout.data.integrations) {
        setSavedCheckoutIntegrations(resCheckout.data.integrations);
      }
    } catch (err) {
      console.error('Error al guardar ENVIA:', err);
      setNotice(err.response?.data?.message || 'Error al guardar la configuración de ENVIA.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleDeleteCheckoutIntegration = async (provider) => {
    const currentMode = provider === 'mercadopago' ? mpMode : enviaMode;
    const modeName = currentMode === 'prueba' ? 'Prueba' : 'Producción';
    const provName = provider === 'mercadopago' ? 'Mercado Pago' : 'ENVIA';
    if (!window.confirm(`¿Estás seguro de eliminar la configuración de ${provName} (${modeName})?`)) {
      return;
    }
    try {
      await api.delete(`/tienda/checkout-integrations/${provider}?mode=${currentMode}`);
      if (provider === 'mercadopago') {
        setMercadoPagoConfigs({
          ...mercadoPagoConfigs,
          [currentMode]: { public_key: '', access_token: '' }
        });
        setInitialMercadoPagoConfigs({
          ...initialMercadoPagoConfigs,
          [currentMode]: { public_key: '', access_token: '' }
        });
      } else {
        setEnviaConfigs({
          ...enviaConfigs,
          [currentMode]: { access_token: '' }
        });
        setInitialEnviaConfigs({
          ...initialEnviaConfigs,
          [currentMode]: { access_token: '' }
        });
      }
      setNotice(`Configuración de ${provName} (${modeName}) eliminada con éxito.`);
      setTimeout(() => setNotice(''), 3000);
      const resCheckout = await api.get('/tienda/checkout-integrations');
      if (resCheckout.data && resCheckout.data.integrations) {
        setSavedCheckoutIntegrations(resCheckout.data.integrations);
      }
    } catch (err) {
      console.error('Error al eliminar integración:', err);
      setNotice(err.response?.data?.message || 'Error al eliminar la configuración.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleSaveDian = async (e) => {
    e.preventDefault();
    if (
      !dianConfig.sw_id || !dianConfig.sw_id.trim() ||
      !dianConfig.sw_pin || !dianConfig.sw_pin.trim() ||
      !dianConfig.technical_key || !dianConfig.technical_key.trim() ||
      !dianConfig.prefix || !dianConfig.prefix.trim() ||
      !dianConfig.test_set_id || !dianConfig.test_set_id.trim()
    ) {
      setNotice('Error: Todos los campos de la DIAN son obligatorios y no pueden quedar vacíos.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    try {
      await api.put('/tienda/dian', dianConfig);
      setNotice('Configuración DIAN guardada con éxito.');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      console.error('Error al guardar DIAN:', err);
      setNotice(err.response?.data?.message || 'Error al guardar la configuración DIAN.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // Estados locales para perfiles de envío y promociones
  const [envioGratisTienda, setEnvioGratisTienda] = useState(false);
  const [perfilesEnvio, setPerfilesEnvio] = useState([
    { id: 1, nombre: 'Envío Estándar', tipo: 'cobro', fullment_id: null }
  ]);

  const [promociones, setPromociones] = useState([
    { id: 1, titulo: 'Descuento de Bienvenida', tipo: 'porcentaje', valor: 15, alcance: 'global', fullment_id: null }
  ]);

  const [nuevoEnvio, setNuevoEnvio] = useState({ nombre: '', tipo: 'cobro', fullment_id: '' });
  const [nuevaPromo, setNuevaPromo] = useState({ titulo: '', tipo: 'porcentaje', valor: '', alcance: 'global', fullment_id: '' });

  const [editingFullment, setEditingFullment] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [initialSelectedProductIds, setInitialSelectedProductIds] = useState([]);
  const [productAssignments, setProductAssignments] = useState({});
  const [productProfiles, setProductProfiles] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  const handleOpenEditFullment = async (fullment) => {
    setEditingFullment(fullment);
    setLoadingProducts(true);
    try {
      const promises = [
        api.get('/product/mine'),
        ...fullments.map(f => api.get(`/geo/fullments/${f.fullment_id}/products`).catch(() => ({ data: { products: [] } })))
      ];

      const results = await Promise.all(promises);
      const resProducts = results[0];
      const fullmentProductResponses = results.slice(1);

      const profilesMap = {};
      if (resProducts.data && resProducts.data.products) {
        setStoreProducts(resProducts.data.products);
        resProducts.data.products.forEach(p => {
          if (p.perfil_envio_id) profilesMap[p.id] = p.perfil_envio_id;
        });
      }
      setProductProfiles(profilesMap);

      const assignments = {};
      fullments.forEach((f, idx) => {
        const prodRes = fullmentProductResponses[idx];
        const assignedProds = prodRes?.data?.products || [];
        assignedProds.forEach(p => {
          assignments[p.id] = {
            fullment_id: f.fullment_id,
            ciudad_nombre: f.ciudad_nombre,
            departamento_nombre: f.departamento_nombre
          };
        });
      });
      setProductAssignments(assignments);

      const currentAssigned = fullmentProductResponses[fullments.findIndex(f => f.fullment_id === fullment.fullment_id)]?.data?.products || [];
      const assignedIds = currentAssigned.map(p => p.id);
      setSelectedProductIds(assignedIds);
      setInitialSelectedProductIds(assignedIds);
    } catch (err) {
      console.error('Error al cargar productos para el centro:', err);
      setNotice('Error al cargar productos de la tienda.');
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setLoadingProducts(false);
    }
  };

  const hasProductChanges = () => {
    return true;
  };

  const handleToggleProductSelection = (productId) => {
    const assignment = productAssignments[productId];
    if (assignment && assignment.fullment_id !== editingFullment.fullment_id) {
      return;
    }
    setSelectedProductIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleSaveFullmentProducts = async (e) => {
    e.preventDefault();
    if (!editingFullment) return;
    try {
      await api.put(`/geo/fullments/${editingFullment.fullment_id}/products`, {
        product_ids: selectedProductIds,
        product_profiles: productProfiles
      });
      setNotice('Productos y perfiles de envío actualizados correctamente en el centro de distribución.');
      setTimeout(() => setNotice(''), 3000);
      setEditingFullment(null);
    } catch (err) {
      console.error('Error al actualizar productos del centro:', err);
      setNotice('Error al actualizar los productos.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleToggleEnvioGratis = async (checked) => {
    try {
      if (checked) {
        const res = await api.post('/tienda/perfiles-envio', {
          nombre: 'Envío Gratis en Toda la Tienda',
          tipo: 'gratis',
          alcance: 'global',
          costo: 0
        });
        if (res.data?.ok) {
          const pp = res.data.perfil;
          const globalProfile = { id: pp.id, nombre: pp.nombre, tipo: pp.tipo, fullment_id: pp.fullment_id, costo: pp.costo, isGlobal: true };
          setPerfilesEnvio(prev => [globalProfile, ...prev.filter(p => !p.isGlobal)]);
          setEnvioGratisTienda(true);
          setNotice('Envío gratis en toda la tienda activado. Los demás perfiles quedan congelados.');
        }
      } else {
        const globalProfile = perfilesEnvio.find(p => p.isGlobal);
        if (globalProfile && globalProfile.id && globalProfile.id !== 'store-wide-gratis') {
          await api.delete(`/tienda/perfiles-envio/${globalProfile.id}`);
        }
        setPerfilesEnvio(prev => prev.filter(p => !p.isGlobal));
        setEnvioGratisTienda(false);
        setNotice('Envío gratis en toda la tienda desactivado.');
      }
    } catch (err) {
      console.error('Error al alternar envío gratis global:', err);
      setNotice(err.response?.data?.message || 'Error al actualizar el estado de envío gratis.');
    }
    setTimeout(() => setNotice(''), 4000);
  };

  const handleAddEnvio = (e) => {
    e.preventDefault();
    if (!nuevoEnvio.nombre) return;

    if (fullments.length === 0) {
      setNotice('Error: No puedes crear perfiles de envío porque no tienes ningún centro de distribución registrado.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }

    if (!nuevoEnvio.fullment_id) {
      setNotice('Error: Debes seleccionar un centro de distribución.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }

    (async () => {
      try {
        const res = await api.post('/tienda/perfiles-envio', {
          nombre: nuevoEnvio.nombre,
          tipo: nuevoEnvio.tipo,
          alcance: nuevoEnvio.fullment_id ? 'ciudad' : 'global',
          fullment_id: nuevoEnvio.fullment_id ? Number(nuevoEnvio.fullment_id) : null,
          costo: 0
        });
        if (res.data?.ok) {
          setPerfilesEnvio(prev => [
            ...prev,
            { id: res.data.perfil.id, nombre: res.data.perfil.nombre, tipo: res.data.perfil.tipo, fullment_id: res.data.perfil.fullment_id, costo: res.data.perfil.costo, isGlobal: res.data.perfil.alcance === 'global' }
          ]);
          setNuevoEnvio({ nombre: '', tipo: 'cobro', fullment_id: '' });
          setNotice('Perfil de envío creado correctamente.');
          setTimeout(() => setNotice(''), 3000);
        }
      } catch (err) {
        console.error('Error al crear perfil en backend:', err);
        setNotice(err.response?.data?.message || 'Error al crear perfil.');
        setTimeout(() => setNotice(''), 3000);
      }
    })();
  };

  const handleDeleteEnvio = (id) => {
    (async () => {
      try {
        await api.delete(`/tienda/perfiles-envio/${id}`);
        setPerfilesEnvio(prev => prev.filter(p => p.id !== id));
        setNotice('Perfil de envío eliminado.');
        setTimeout(() => setNotice(''), 3000);
      } catch (err) {
        console.error('Error al eliminar perfil:', err);
        setNotice(err.response?.data?.message || 'Error al eliminar perfil.');
        setTimeout(() => setNotice(''), 3000);
      }
    })();
  };

  const handleAddPromo = (e) => {
    e.preventDefault();
    if (!nuevaPromo.titulo) return;

    if (fullments.length === 0) {
      setNotice('Error: No puedes crear promociones porque no tienes ningún centro de distribución registrado.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }

    // Verificar si ya existe una promoción global
    const hasGlobal = promociones.some((p) => p.alcance === 'global');
    if (hasGlobal) {
      setNotice('Ya existe una promoción global activa. No se pueden añadir nuevas promociones.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }

    if (nuevaPromo.alcance === 'ciudad' && !nuevaPromo.fullment_id) {
      setNotice('Error: Debes seleccionar un centro de distribución.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }

    setPromociones([
      ...promociones,
      {
        id: Date.now(),
        ...nuevaPromo,
        valor: Number(nuevaPromo.valor) || 0,
        fullment_id: nuevaPromo.alcance === 'ciudad' ? Number(nuevaPromo.fullment_id) : null
      }
    ]);
    setNuevaPromo({ titulo: '', tipo: 'porcentaje', valor: '', alcance: 'global', fullment_id: '' });
    setNotice('Promoción creada correctamente.');
    setTimeout(() => setNotice(''), 3000);
  };

  const handleDeletePromo = (id) => {
    setPromociones(promociones.filter((p) => p.id !== id));
    setNotice('Promoción eliminada.');
    setTimeout(() => setNotice(''), 3000);
  };

  const handleAddFullment = async (e) => {
    e.preventDefault();
    if (!selectedCiudadId) return;
    try {
      const { data } = await api.post('/geo/fullments', { ciudad_id: Number(selectedCiudadId) });
      if (data && data.fullment) {
        const resFullments = await api.get('/geo/fullments/mine');
        if (resFullments.data && resFullments.data.fullments) {
          const uniqueFullments = Array.from(
            new Map(resFullments.data.fullments.map(item => [item.fullment_id, item])).values()
          );
          setFullments(uniqueFullments);
        }
        setSelectedCiudadId('');
        setNotice('Centro de distribución añadido correctamente.');
        setTimeout(() => setNotice(''), 3000);
      }
    } catch (err) {
      console.error('Error al guardar centro de distribución:', err);
      const msg = err.response?.data?.message || 'Error al guardar el centro de distribución.';
      setNotice(msg);
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleDeleteFullment = async (fullmentId) => {
    try {
      await api.delete(`/geo/fullments/${fullmentId}`);
      setFullments(fullments.filter((f) => f.fullment_id !== fullmentId));
      setNotice('Centro de distribución eliminado.');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      console.error('Error al eliminar centro de distribución:', err);
      setNotice('Error al eliminar el centro de distribución.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const getFullmentNombre = (fullmentId) => {
    const f = fullments.find((item) => item.fullment_id === fullmentId);
    return f ? `${f.ciudad_nombre} (${f.departamento_nombre})` : 'Centro específico';
  };

  if (!tienda) return null;

  return (
    <div className="panel" style={{ paddingBottom: '3rem', position: 'relative' }}>
      {notice && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '1rem 1.75rem',
          background: notice.includes('Ya existe') || notice.includes('Error') ? '#fee2e2' : '#d1fae5',
          color: notice.includes('Ya existe') || notice.includes('Error') ? '#991b1b' : '#065f46',
          border: `1px solid ${notice.includes('Ya existe') || notice.includes('Error') ? '#fca5a5' : '#6ee7b7'}`,
          borderRadius: '1rem',
          fontWeight: 700,
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <CheckCircle size={22} />
          <span>{notice}</span>
        </div>
      )}

      <div className="panel__heading" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="panel__eyebrow">Configuración avanzada</p>
          <h1>{tienda.name}</h1>
          <p>Administra la configuración comercial, envíos, pagos y promociones.</p>
        </div>
      </div>

      <div className="config-layout">
        {/* Sidebar con iconos */}
        <aside className="config-sidebar">
          <div className="config-sidebar__header">
            <Warehouse size={22} color="#7e22ce" />
            <h2>Opciones de Tienda</h2>
          </div>
          <nav className="config-nav">
            <button
              className={`config-nav__item ${activeTab === 'envios' ? 'active' : ''}`}
              onClick={() => setActiveTab('envios')}
            >
              <Truck size={18} /> Perfil de envíos
            </button>
            <button
              className={`config-nav__item ${activeTab === 'promociones' ? 'active' : ''}`}
              onClick={() => setActiveTab('promociones')}
            >
              <Tag size={18} /> Promociones
            </button>
            <button
              className={`config-nav__item ${activeTab === 'facturacion' ? 'active' : ''}`}
              onClick={() => setActiveTab('facturacion')}
            >
              <Receipt size={18} /> Facturación
            </button>
            <button
              className={`config-nav__item ${activeTab === 'distribucion' ? 'active' : ''}`}
              onClick={() => setActiveTab('distribucion')}
            >
              <Warehouse size={18} /> Centros de distribución
            </button>
            <button
              className={`config-nav__item ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              <CreditCard size={18} /> Payments y checkout
            </button>
          </nav>
        </aside>

        {/* Contenido Principal de cada Sección */}
        <main className="config-content">
          {activeTab === 'envios' && (
            <div>
              <div className="config-section-header">
                <div>
                  <h3>Perfiles de Envíos</h3>
                  <p>Configura perfiles de envío gratis o de cobro asociados a un centro de distribución registrado.</p>
                </div>
              </div>

              {/* Toggle Switch Envío Gratis en Toda la Tienda */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b', fontSize: '1rem' }}>Envío Gratis en Toda la Tienda</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>Activa para aplicar envío gratis global. Al estar activo, los demás perfiles quedan congelados.</p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={envioGratisTienda}
                    onChange={(e) => handleToggleEnvioGratis(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: envioGratisTienda ? '#7e22ce' : '#cbd5e1',
                    transition: '.4s', borderRadius: '24px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px',
                      left: envioGratisTienda ? '28px' : '3px', bottom: '3px',
                      backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Formulario de nuevo perfil (deshabilitado si envío gratis tienda está activo) */}
              <form onSubmit={handleAddEnvio} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', opacity: envioGratisTienda ? 0.5 : 1, pointerEvents: envioGratisTienda ? 'none' : 'auto' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1rem' }}>Crear nuevo perfil de envío</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Nombre del perfil</label>
                    <input
                      type="text"
                      placeholder="Ej. Envío Exprés"
                      value={nuevoEnvio.nombre}
                      disabled={envioGratisTienda}
                      onChange={(e) => setNuevoEnvio({ ...nuevoEnvio, nombre: e.target.value })}
                    />
                  </div>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Tipo de envío</label>
                    <select
                      value={nuevoEnvio.tipo}
                      disabled={envioGratisTienda}
                      onChange={(e) => setNuevoEnvio({ ...nuevoEnvio, tipo: e.target.value })}
                    >
                      <option value="gratis">Gratis</option>
                      <option value="cobro">De cobro</option>
                    </select>
                  </div>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Seleccionar Centro de Distribución</label>
                    <select
                      value={nuevoEnvio.fullment_id}
                      disabled={envioGratisTienda}
                      onChange={(e) => setNuevoEnvio({ ...nuevoEnvio, fullment_id: e.target.value })}
                    >
                      <option value="">Selecciona un centro registrado</option>
                      {fullments.map((f) => (
                        <option key={f.fullment_id} value={f.fullment_id}>{f.ciudad_nombre} ({f.departamento_nombre})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button type="submit" className="config-btn-primary" disabled={envioGratisTienda}>
                    <Plus size={16} /> Añadir perfil
                  </button>
                </div>
              </form>

              {envioGratisTienda && (
                <div style={{ padding: '0.75rem 1rem', background: '#f3e8ff', color: '#6b21a8', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  ⚠️ Envío gratis en toda la tienda activo: Los demás perfiles de envío se encuentran congelados.
                </div>
              )}

              <div className="config-card-grid">
                {perfilesEnvio.map((perfil) => (
                  <div className="config-item-card" key={perfil.id} style={{ opacity: envioGratisTienda && !perfil.isGlobal ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <h4 style={{ margin: 0 }}>{perfil.nombre} {perfil.isGlobal && '🌟'}</h4>
                      {!perfil.isGlobal && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEnvio(perfil.id)}
                          disabled={envioGratisTienda}
                          style={{ background: '#fee2e2', border: '0', color: '#dc2626', padding: '0.35rem', borderRadius: '0.5rem', cursor: envioGratisTienda ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Eliminar perfil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p style={{ margin: '0.2rem 0' }}>Tipo: <strong>{perfil.tipo.toUpperCase()}</strong></p>
                    {perfil.fullment_id ? (
                      <p style={{ margin: 0 }}>Centro de distribución: <strong>{getFullmentNombre(perfil.fullment_id)}</strong></p>
                    ) : (
                      <p style={{ margin: 0 }}>Alcance: <strong>Global (Toda la tienda)</strong></p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'promociones' && (
            <div>
              <div className="config-section-header">
                <div>
                  <h3>Promociones y Ofertas</h3>
                  <p>Crea descuentos porcentuales o de monto fijo aplicados globalmente o por centros de distribución registrados.</p>
                </div>
              </div>

              <form onSubmit={handleAddPromo} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1rem' }}>Crear nueva promoción</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Título de la promoción</label>
                    <input
                      type="text"
                      placeholder="Ej. Black Friday 20%"
                      value={nuevaPromo.titulo}
                      onChange={(e) => setNuevaPromo({ ...nuevaPromo, titulo: e.target.value })}
                    />
                  </div>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Tipo de descuento</label>
                    <select
                      value={nuevaPromo.tipo}
                      onChange={(e) => setNuevaPromo({ ...nuevaPromo, tipo: e.target.value })}
                    >
                      <option value="porcentaje">Porcentaje (%)</option>
                      <option value="monto_fijo">Monto Fijo ($)</option>
                    </select>
                  </div>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Valor del descuento</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej. 10"
                      value={nuevaPromo.valor}
                      onChange={(e) => setNuevaPromo({ ...nuevaPromo, valor: e.target.value })}
                    />
                  </div>
                  <div className="config-form-group" style={{ margin: 0 }}>
                    <label>Alcance</label>
                    <select
                      value={nuevaPromo.alcance}
                      onChange={(e) => setNuevaPromo({ ...nuevaPromo, alcance: e.target.value })}
                    >
                      <option value="global">Global</option>
                      <option value="ciudad">Por centro de distribución</option>
                    </select>
                  </div>
                  {nuevaPromo.alcance === 'ciudad' && (
                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label>Seleccionar Centro de Distribución</label>
                      <select
                        value={nuevaPromo.fullment_id}
                        onChange={(e) => setNuevaPromo({ ...nuevaPromo, fullment_id: e.target.value })}
                      >
                        <option value="">Selecciona un centro registrado</option>
                        {fullments.map((f) => (
                          <option key={f.fullment_id} value={f.fullment_id}>{f.ciudad_nombre} ({f.departamento_nombre})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button type="submit" className="config-btn-primary">
                    <Plus size={16} /> Crear promoción
                  </button>
                </div>
              </form>

              <div className="config-card-grid">
                {promociones.map((promo) => (
                  <div className="config-item-card" key={promo.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <h4 style={{ margin: 0 }}>{promo.titulo}</h4>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo.id)}
                        style={{ background: '#fee2e2', border: '0', color: '#dc2626', padding: '0.35rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Eliminar promoción"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p style={{ margin: '0.2rem 0' }}>Descuento: <strong>{promo.valor}{promo.tipo === 'porcentaje' ? '%' : '$'}</strong> ({promo.tipo})</p>
                    <p style={{ margin: '0.2rem 0' }}>Alcance: <strong>{promo.alcance.toUpperCase()}</strong></p>
                    {promo.alcance === 'ciudad' && <p style={{ margin: 0 }}>Centro de distribución: <strong>{getFullmentNombre(promo.fullment_id)}</strong></p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'facturacion' && (
            <div>
              <div className="config-section-header">
                <div>
                  <h3>Facturación</h3>
                  <p>Gestiona los datos fiscales y la información de cobro de tu tienda.</p>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                <div className="config-form-group">
                  <label>Razón Social / Nombre Legal</label>
                  <input type="text" placeholder="Ej. Empresa S.A.S." defaultValue="Comercializadora Glopsy S.A.S." />
                </div>
                <div className="config-form-group">
                  <label>NIT / RUT / Identificación Fiscal</label>
                  <input type="text" placeholder="Ej. 900123456-1" defaultValue="901234567-8" />
                </div>
                <div className="config-form-group">
                  <label>Dirección Fiscal</label>
                  <input type="text" placeholder="Dirección principal" defaultValue="Calle 100 # 15-20, Bogotá" />
                </div>
                <button className="config-btn-primary" onClick={() => { setNotice('Datos de facturación actualizados.'); setTimeout(() => setNotice(''), 3000); }}>
                  Guardar datos fiscales
                </button>
              </div>

              {/* Sección DIAN - Facturación Electrónica */}
              <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '1rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', opacity: 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: '#0284c7', color: 'white', fontWeight: 900, padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontSize: '1.1rem', letterSpacing: '1px' }}>
                      DIAN
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Facturación Electrónica DIAN (Colombia)</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Configuración de habilitación y software para emisión de documentos electrónicos.</p>
                    </div>
                  </div>
                  <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                    Próximamente
                  </span>
                </div>

                <form onSubmit={handleSaveDian}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <Code size={16} color="#0284c7" /> ID del SW
                      </label>
                      <input
                        type="text"
                        placeholder="ID del Software DIAN"
                        value={dianConfig.sw_id}
                        onChange={(e) => setDianConfig({ ...dianConfig, sw_id: e.target.value })}
                        disabled
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <KeyRound size={16} color="#0284c7" /> PIN del SW
                      </label>
                      <input
                        type="password"
                        placeholder="PIN del Software"
                        value={dianConfig.sw_pin}
                        onChange={(e) => setDianConfig({ ...dianConfig, sw_pin: e.target.value })}
                        disabled
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="config-form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <Shield size={16} color="#0284c7" /> Llave Técnica
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Llave técnica proporcionada por la DIAN"
                        value={dianConfig.technical_key}
                        onChange={(e) => setDianConfig({ ...dianConfig, technical_key: e.target.value })}
                        disabled
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical', backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <Hash size={16} color="#0284c7" /> Prefijo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. SETT"
                        value={dianConfig.prefix}
                        onChange={(e) => setDianConfig({ ...dianConfig, prefix: e.target.value })}
                        disabled
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <Terminal size={16} color="#0284c7" /> TestSetId
                      </label>
                      <input
                        type="text"
                        placeholder="TestSetId de pruebas"
                        value={dianConfig.test_set_id}
                        onChange={(e) => setDianConfig({ ...dianConfig, test_set_id: e.target.value })}
                        disabled
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                    <button type="submit" className="config-btn-primary" disabled style={{ background: '#cbd5e1', color: '#64748b', cursor: 'not-allowed' }}>
                      Guardar configuración DIAN (Próximamente)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'distribucion' && editingFullment && (
            <div>
              <div className="config-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <button
                    type="button"
                    onClick={() => setEditingFullment(null)}
                    style={{ background: 'none', border: '0', color: '#7e22ce', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: 0 }}
                  >
                    ← Volver a centros de distribución
                  </button>
                  <h3>Gestionar Productos para {editingFullment.ciudad_nombre} ({editingFullment.departamento_nombre})</h3>
                  <p>Selecciona los productos de tu tienda que estarán asignados a este centro de distribución.</p>
                </div>
              </div>

              {loadingProducts ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Cargando productos...</p>
              ) : (
                <form onSubmit={handleSaveFullmentProducts}>
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {storeProducts.length === 0 ? (
                      <p style={{ color: '#64748b' }}>No tienes productos registrados en tu tienda.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {storeProducts.map((p) => {
                          const assignment = productAssignments[p.id];
                          const isAssignedElsewhere = assignment && assignment.fullment_id !== editingFullment.fullment_id;
                          const isChecked = selectedProductIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '0.75rem 1rem',
                                background: isAssignedElsewhere ? '#f1f5f9' : (isChecked ? '#f3e8ff' : 'white'),
                                border: `1px solid ${isAssignedElsewhere ? '#cbd5e1' : (isChecked ? '#d8b4fe' : '#e2e8f0')}`,
                                borderRadius: '0.75rem',
                                opacity: isAssignedElsewhere ? 0.7 : 1,
                                transition: 'all 0.2s',
                                gap: '0.5rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isAssignedElsewhere}
                                    onChange={() => handleToggleProductSelection(p.id)}
                                    style={{ width: '18px', height: '18px', accentColor: '#7e22ce', cursor: isAssignedElsewhere ? 'not-allowed' : 'pointer' }}
                                  />
                                  <div>
                                    <strong style={{ color: '#1e293b' }}>{p.name}</strong>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Precio sugerido: ${Number(p.suggested_price || p.base_price || 0).toFixed(2)} | Stock: {p.stock_total || 0}</div>
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isAssignedElsewhere ? '#b91c1c' : (isChecked ? '#7e22ce' : '#64748b') }}>
                                  {isAssignedElsewhere ? `Asignado en ${assignment.ciudad_nombre}` : (isChecked ? 'Asignado' : 'No asignado')}
                                </span>
                              </div>
                              {isChecked && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '2rem' }}>
                                  <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Perfil de envío:</label>
                                  <select
                                    value={productProfiles[p.id] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : '';
                                      setProductProfiles(prev => ({ ...prev, [p.id]: val }));
                                    }}
                                    className="config-select"
                                    style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
                                  >
                                    <option value="">Predeterminado del Centro</option>
                                    {perfilesEnvio
                                      .filter(pe => pe.isGlobal || Number(pe.fullment_id) === Number(editingFullment.fullment_id))
                                      .map(pe => (
                                        <option key={pe.id} value={pe.id}>{pe.nombre} {pe.isGlobal ? '(Global)' : ''}</option>
                                      ))
                                    }
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditingFullment(null)}
                      style={{ padding: '0.75rem 1.5rem', background: '#e2e8f0', color: '#334155', border: '0', borderRadius: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="config-btn-primary" disabled={!hasProductChanges()}>
                      Guardar cambios
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'distribucion' && !editingFullment && (
            <div>
              <div className="config-section-header">
                <div>
                  <h3>Centros de Distribución (Fullments)</h3>
                  <p>Selecciona una ciudad de la base de datos para añadirla como centro de distribución y administra los centros guardados de tu tienda.</p>
                </div>
              </div>

              <form onSubmit={handleAddFullment} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1rem' }}>Añadir centro de distribución</h4>
                <div className="config-form-group">
                  <label>Seleccionar Ciudad</label>
                  <select
                    value={selectedCiudadId}
                    onChange={(e) => setSelectedCiudadId(e.target.value)}
                  >
                    <option value="">Selecciona una ciudad de la base de datos</option>
                    {ciudades.filter((c) => !fullments.some((f) => f.ciudad_id === c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button type="submit" className="config-btn-primary">
                    <Plus size={16} /> Añadir centro
                  </button>
                </div>
              </form>

              <div className="config-card-grid">
                {fullments.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No hay centros de distribución guardados.</p>
                ) : (
                  fullments.map((f) => (
                  <div className="config-item-card" key={f.fullment_id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <h4 style={{ margin: 0 }}>{f.ciudad_nombre}</h4>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditFullment(f)}
                              style={{ background: '#f3e8ff', border: '0', color: '#7e22ce', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="Gestionar productos"
                            >
                              Editar productos
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFullment(f.fullment_id)}
                              style={{ background: '#fee2e2', border: '0', color: '#dc2626', padding: '0.35rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Eliminar centro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p style={{ margin: '0.2rem 0' }}>Departamento: <strong>{f.departamento_nombre}</strong> ({f.pais_nombre})</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

              {activeTab === 'payments' && (
            <div>
              <div className="config-section-header">
                <div>
                  <h3>Payments y Checkout</h3>
                  <p>Configura la pasarela de pago de Mercado Pago y el servicio de envío ENVIA para tu tienda.</p>
                </div>
              </div>

              {/* Mercado Pago Section */}
              <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '1rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: '#009ee3', color: 'white', fontWeight: 900, padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontSize: '1.1rem', letterSpacing: '1px' }}>
                      MP
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Mercado Pago</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Configura tus credenciales para procesar pagos en línea.</p>
                    </div>
                  </div>
                  {savedCheckoutIntegrations.some(i => i.provider === 'mercadopago' && (i.mode === mpMode || (!i.mode && mpMode === 'prueba'))) && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                      Guardado ({mpMode === 'prueba' ? 'Prueba' : 'Producción'})
                    </span>
                  )}
                </div>

                {/* Toggle Prueba / Produccion */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Modo de credenciales:</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setMpMode('prueba')}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #009ee3',
                        background: mpMode === 'prueba' ? '#009ee3' : 'white',
                        color: mpMode === 'prueba' ? 'white' : '#009ee3',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      Prueba
                    </button>
                    <button
                      type="button"
                      onClick={() => setMpMode('produccion')}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #009ee3',
                        background: mpMode === 'produccion' ? '#009ee3' : 'white',
                        color: mpMode === 'produccion' ? 'white' : '#009ee3',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      Producción
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveMercadoPago}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <KeyRound size={16} color="#009ee3" /> Public Key ({mpMode === 'prueba' ? 'Prueba' : 'Producción'})
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. APP_USR-..."
                        value={mercadoPagoConfig.public_key}
                        onChange={(e) => setMercadoPagoConfig({ ...mercadoPagoConfig, public_key: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <Shield size={16} color="#009ee3" /> Access Token ({mpMode === 'prueba' ? 'Prueba' : 'Producción'})
                      </label>
                      <input
                        type="password"
                        placeholder="Ej. APP_USR-..."
                        value={mercadoPagoConfig.access_token}
                        onChange={(e) => setMercadoPagoConfig({ ...mercadoPagoConfig, access_token: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {savedCheckoutIntegrations.some(i => i.provider === 'mercadopago' && (i.mode === mpMode || (!i.mode && mpMode === 'prueba'))) ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckoutIntegration('mercadopago')}
                        style={{ background: '#fee2e2', color: '#991b1b', border: '0', padding: '0.6rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
                      >
                        <Trash2 size={16} /> Borrar ({mpMode === 'prueba' ? 'Prueba' : 'Producción'})
                      </button>
                    ) : <div />}
                    <button
                      type="submit"
                      disabled={!hasMercadoPagoChanges()}
                      className="config-btn-primary"
                      style={{
                        background: hasMercadoPagoChanges() ? 'linear-gradient(90deg, #009ee3 0%, #0073a8 100%)' : '#cbd5e1',
                        color: hasMercadoPagoChanges() ? 'white' : '#64748b',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.9rem',
                        cursor: hasMercadoPagoChanges() ? 'pointer' : 'not-allowed',
                        opacity: hasMercadoPagoChanges() ? 1 : 0.7
                      }}
                    >
                      Guardar ({mpMode === 'prueba' ? 'Prueba' : 'Producción'})
                    </button>
                  </div>
                </form>
              </div>

              {/* ENVIA Section */}
              <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '1rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: '#7e22ce', color: 'white', fontWeight: 900, padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontSize: '1.1rem', letterSpacing: '1px' }}>
                      ENVÍA
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>ENVIA (Checkout Envío)</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Configura el token de acceso para cotización y gestión de envíos.</p>
                    </div>
                  </div>
                  {savedCheckoutIntegrations.some(i => i.provider === 'envia' && (i.mode === enviaMode || (!i.mode && enviaMode === 'prueba'))) && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                      Guardado ({enviaMode === 'prueba' ? 'Prueba' : 'Producción'})
                    </span>
                  )}
                </div>

                {/* Toggle Prueba / Produccion */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Modo de credenciales:</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEnviaMode('prueba')}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #7e22ce',
                        background: enviaMode === 'prueba' ? '#7e22ce' : 'white',
                        color: enviaMode === 'prueba' ? 'white' : '#7e22ce',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      Prueba
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnviaMode('produccion')}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #7e22ce',
                        background: enviaMode === 'produccion' ? '#7e22ce' : 'white',
                        color: enviaMode === 'produccion' ? 'white' : '#7e22ce',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      Producción
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveEnvia}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="config-form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 600 }}>
                        <KeyRound size={16} color="#7e22ce" /> Token de Acceso ({enviaMode === 'prueba' ? 'Prueba' : 'Producción'})
                      </label>
                      <input
                        type="password"
                        placeholder="Token de acceso ENVIA"
                        value={enviaConfig.access_token}
                        onChange={(e) => setEnviaConfig({ ...enviaConfig, access_token: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {savedCheckoutIntegrations.some(i => i.provider === 'envia' && (i.mode === enviaMode || (!i.mode && enviaMode === 'prueba'))) ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckoutIntegration('envia')}
                        style={{ background: '#fee2e2', color: '#991b1b', border: '0', padding: '0.6rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
                      >
                        <Trash2 size={16} /> Borrar ({enviaMode === 'prueba' ? 'Prueba' : 'Producción'})
                      </button>
                    ) : <div />}
                    <button
                      type="submit"
                      disabled={!hasEnviaChanges()}
                      className="config-btn-primary"
                      style={{
                        background: hasEnviaChanges() ? 'linear-gradient(90deg, #7e22ce 0%, #6b21a8 100%)' : '#cbd5e1',
                        color: hasEnviaChanges() ? 'white' : '#64748b',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.9rem',
                        cursor: hasEnviaChanges() ? 'pointer' : 'not-allowed',
                        opacity: hasEnviaChanges() ? 1 : 0.7
                      }}
                    >
                      Guardar ({enviaMode === 'prueba' ? 'Prueba' : 'Producción'})
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MarketConfig;
