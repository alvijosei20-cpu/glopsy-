import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Star, Package, ShoppingBag, Clock, Wallet, TrendingUp } from 'lucide-react';
import { Card } from '../../components/tremor/Card';
import { Badge } from '../../components/tremor/Badge';
import { BarChart } from '../../components/tremor/BarChart';
import { DonutChart } from '../../components/tremor/DonutChart';
import { BarList } from '../../components/tremor/BarList';
import { ProgressBar } from '../../components/tremor/ProgressBar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const formatCOP = (val) => {
  return Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val || 0));
};

const KpiCard = ({ icon: Icon, label, value, sub, accent = 'fuchsia' }) => (
  <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-[11px] font-medium text-slate-400">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${accent === 'emerald' ? 'bg-emerald-50 text-emerald-600' : accent === 'amber' ? 'bg-amber-50 text-amber-600' : accent === 'pink' ? 'bg-pink-50 text-pink-600' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
        <Icon size={20} />
      </div>
    </div>
  </Card>
);

const Analytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tienda/analytics')
      .then(res => {
        if (res.data.ok) setData(res.data.analytics);
        else setError(res.data.message || 'No se pudieron cargar las estadísticas.');
      })
      .catch(() => setError('No se pudieron cargar las estadísticas.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="!rounded-2xl max-w-md w-full !shadow-sm text-center">
          <p className="text-sm font-bold text-slate-800 mb-2">No disponible</p>
          <p className="text-xs text-slate-500 mb-5">{error || 'No hay datos de tu tienda todavía.'}</p>
          <button
            onClick={() => navigate('/market')}
            className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-fuchsia-600/20"
          >
            Volver a mi tienda
          </button>
        </Card>
      </div>
    );
  }

  const { summary, salesByDay, topProducts, salesByCategory, ordersByStatus } = data;

  const salesChartData = (salesByDay || []).map(d => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    Ventas: Number(d.ventas || 0),
  }));

  const categoryChartData = (salesByCategory || []).map(c => ({
    name: c.categoria,
    value: Number(c.ventas || 0),
  }));

  const productsList = (topProducts || []).map(p => ({
    name: p.name,
    value: Number(p.ventas || 0),
    href: undefined,
  }));

  const completedOrders = Number(summary.total_orders || 0);
  const avgRating = Number(summary.avg_rating || 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <div className="bg-white border-b border-fuchsia-100 shadow-sm py-3 px-4 sm:px-8 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/market')}
            className="flex items-center gap-2 text-slate-600 hover:text-fuchsia-600 text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Mi tienda</span>
          </button>
          <div className="flex items-center gap-2 text-fuchsia-800 text-xs sm:text-sm font-medium bg-fuchsia-50 px-3 py-1.5 rounded-xl border border-fuchsia-100">
            <BarChart3 size={16} className="text-fuchsia-600 shrink-0" />
            <span>Estadísticas de <b>{user?.name || 'tu tienda'}</b></span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">Rendimiento y ventas de tu tienda en los últimos 30 días.</p>
          </div>
          <Badge color="fuchsia" className="hidden sm:inline-flex">
            Últimos 30 días
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Wallet} label="Ventas totales" value={formatCOP(summary.total_revenue)} sub={`${completedOrders} pedidos completados`} accent="fuchsia" />
          <KpiCard icon={TrendingUp} label="Ticket promedio" value={formatCOP(summary.avg_order_value)} accent="emerald" />
          <KpiCard icon={Clock} label="Pedidos pendientes" value={summary.pending_orders} sub="No completados" accent="pink" />
          <KpiCard icon={Package} label="Productos" value={summary.total_products} sub={`${summary.total_stock} unidades en stock`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ventas por día */}
          <Card className="lg:col-span-2 !rounded-2xl !border-fuchsia-100 !shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Ventas diarias</p>
                <p className="text-xs text-slate-500">Ingresos completados por día</p>
              </div>
              <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-xl">
                <ShoppingBag size={18} />
              </div>
            </div>
            <BarChart
              className="h-72"
              data={salesChartData}
              index="date"
              categories={["Ventas"]}
              colors={["fuchsia"]}
              valueFormatter={(v) => formatCOP(v)}
              showLegend={false}
              showGridLines={false}
            />
          </Card>

          {/* Ventas por categoría */}
          <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
            <p className="text-sm font-bold text-slate-800 mb-1">Ventas por categoría</p>
            <p className="text-xs text-slate-500 mb-4">Distribución de ingresos</p>
            <div className="h-56">
              <DonutChart
                className="h-full"
                data={categoryChartData}
                category="name"
                value="value"
                colors={["fuchsia", "pink", "amber", "violet", "cyan", "emerald"]}
                valueFormatter={(v) => formatCOP(v)}
                showLabel={false}
                showTooltip
              />
            </div>
            {categoryChartData.length === 0 && (
              <p className="text-center text-xs text-slate-400 mt-4">Aún no hay ventas por categoría.</p>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Top productos */}
          <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Top productos</p>
                <p className="text-xs text-slate-500">Los más vendidos por ingresos</p>
              </div>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>
            {productsList.length > 0 ? (
              <BarList data={productsList} valueFormatter={(v) => formatCOP(v)} />
            ) : (
              <p className="text-center text-xs text-slate-400 py-10">Aún no tienes ventas.</p>
            )}
          </Card>

          {/* Pedidos por estado + rating */}
          <div className="space-y-6">
            <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
              <p className="text-sm font-bold text-slate-800 mb-4">Pedidos por estado</p>
              {(ordersByStatus || []).length > 0 ? (
                <div className="space-y-2.5">
                  {ordersByStatus.map(s => {
                    const totalAll = (ordersByStatus || []).reduce((a, b) => a + Number(b.cantidad || 0), 0);
                    const pct = totalAll > 0 ? Math.round((Number(s.cantidad || 0) / totalAll) * 100) : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 capitalize">{s.status}</span>
                          <span className="text-xs font-bold text-slate-800">{s.cantidad} ({pct}%)</span>
                        </div>
                        <ProgressBar value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-xs text-slate-400 py-8">Aún no hay pedidos.</p>
              )}
            </Card>

            <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-800">Calificación promedio</p>
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="text-lg font-extrabold text-slate-900">{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">/ 5</span>
                </div>
              </div>
              <ProgressBar value={avgRating * 20} className="h-2.5" />
              <p className="mt-2 text-[11px] text-slate-500">{summary.total_reviews} {summary.total_reviews === 1 ? 'reseña' : 'reseñas'} de compradores verificados</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
