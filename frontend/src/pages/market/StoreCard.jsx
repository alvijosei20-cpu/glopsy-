import React from 'react';
import { CirclePause, CirclePlay, Settings, Send, BarChart3 } from 'lucide-react';

const StoreCard = React.memo(function StoreCard({ tienda, updating, onToggleStatus, onConfig, onPublish, onAnalytics }) {
  if (!tienda) return null;
  return (
    <article className="store-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Superposición (Overlay) de carga cuando se está actualizando el estado */}
      {updating && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 20,
          color: '#7e22ce',
          fontWeight: 700,
          fontSize: '1rem',
          borderRadius: 'inherit'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(126, 34, 206, 0.2)',
            borderLeftColor: '#7e22ce',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          Actualizando estado...
        </div>
      )}

      <div className="store-card__identity">
        {tienda.imageUrl ? (
          <img 
            className="store-card__image" 
            src={tienda.imageUrl} 
            alt={`Logo de ${tienda.name}`} 
          />
        ) : (
          <div className="store-card__fallback" aria-hidden="true">
            {tienda.name?.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {/* Ancho fijo en el span de estado para evitar que se mueva al cambiar de Activa a Pausada */}
          <div>
            <span 
              className={`status ${tienda.isActive ? 'status--active' : 'status--paused'}`} 
              style={{ display: 'inline-flex', width: '90px', justifyContent: 'center', boxSizing: 'border-box' }}
            >
              <i /> {tienda.isActive ? 'Activa' : 'Pausada'}
            </span>
          </div>
          <h2 style={{ margin: 0 }}>{tienda.name}</h2>
          {/* Altura mínima fija en el párrafo para evitar que el diseño brinque al cambiar el texto */}
          <p style={{ minHeight: '2.6rem', margin: 0, display: 'flex', alignItems: 'center' }}>
            {tienda.isActive 
              ? 'Tu tienda está visible para los clientes.'
              : 'Tu tienda no está visible para los clientes.'
            }
          </p>
        </div>
      </div>
      <div className="store-card__actions">
        <button
          className="action-button action-button--pause"
          type="button"
          onClick={onToggleStatus}
          disabled={updating}
          style={{
            minWidth: '155px',
            backgroundColor: tienda.isActive ? '#d1fae5' : '#fef3c7',
            color: tienda.isActive ? '#047857' : '#b45309',
            borderColor: tienda.isActive ? '#6ee7b7' : '#fcd34d'
          }}
        >
          {tienda.isActive ? <CirclePlay size={18} /> : <CirclePause size={18} />}
          {tienda.isActive ? 'Activa' : 'Pausada'}
        </button>
        <button
          className="action-button action-button--settings"
          type="button"
          onClick={onConfig}
        >
          <Settings size={18} /> Configuración
        </button>
        <button
          className="action-button action-button--publish"
          type="button"
          onClick={onPublish}
        >
          <Send size={18} /> Publicar
        </button>
        <button
          className="action-button action-button--analytics"
          type="button"
          onClick={onAnalytics}
        >
          <BarChart3 size={18} /> Analytics
        </button>
      </div>
    </article>
  );
});

export default StoreCard;
