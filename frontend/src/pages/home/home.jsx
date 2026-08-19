import { useSEO } from '../../utils/seo';
import './home.css';

export default function Home() {
  useSEO({
    title: 'Compra y Vende Productos en Línea',
    description:
      'Glopsy es el marketplace donde compras y vendes productos en línea con pagos seguros, envíos a todo Colombia y autenticación biométrica. Crea tu tienda gratis.',
    path: '/',
  });

  return <h1>Página de Inicio (Home)</h1>;
}
