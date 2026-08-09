import { Navigate } from 'react-router-dom';

// Conserva la ruta histórica del panel y dirige la gestión de tienda a Market.
const Panel = () => <Navigate to="/market" replace />;

export default Panel;
