import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';

// Aviso del derecho de retracto que debe informarse al consumidor antes de
// comprar (Ley 1480 de 2011, art. 47).
export default function RetractoNotice({ className = '' }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/30 px-3.5 py-2.5 ${className}`}
    >
      <RotateCcw size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
      <p className="text-[11px] leading-snug text-sky-700 dark:text-sky-300">
        <strong>Derecho de retracto:</strong> puedes devolver tu compra dentro de los 5 días
        hábiles siguientes a la entrega, sin justificar tu decisión, si el producto está en las
        mismas condiciones en que lo recibiste.{' '}
        <Link to="/terminos" target="_blank" className="underline hover:text-sky-800 dark:hover:text-sky-200">
          Ver más
        </Link>
      </p>
    </div>
  );
}
