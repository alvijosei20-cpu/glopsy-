import React from "react";

export const ProductCard = ({ data }) => {
  // Accedemos a la lista de productos
  const products = data.results;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {products.map((product) => {
        // Filtramos las variantes para omitir "Default Variant" si solo quieres mostrar las tallas reales
        const activeVariations = product.variation.filter(
          (v) => v.name !== "Default Variant"
        );

        return (
          <div
            key={product.idProduct}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden md:flex gap-6 p-6 mb-6"
          >
            {/* Imagen del Producto */}
            <div className="md:w-1/3 flex-shrink-0">
              <img
                src={product.urlImageProduct}
                alt={product.name}
                className="w-full h-80 object-cover rounded-xl"
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Vendedor: {product.productOwner.publicName}
              </p>
            </div>

            {/* Contenido Principal */}
            <div className="md:w-2/3 flex flex-col justify-between mt-4 md:mt-0">
              <div>
                {/* Título */}
                <h2 className="text-2xl font-bold text-gray-800 leading-tight">
                  {product.name}
                </h2>

                {/* Precios y Moneda */}
                <div className="flex items-baseline gap-3 my-3">
                  <span className="text-3xl font-extrabold text-emerald-600">
                    ${product.basePrice.toLocaleString()}{" "}
                    <span className="text-sm font-medium">
                      {product.baseCurrencyPrice}
                    </span>
                  </span>
                  {product.suggestedPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      Sugerido: ${product.suggestedPrice.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Descripción (preservando los saltos de línea con whitespace-pre-line) */}
                <div className="text-gray-600 text-sm whitespace-pre-line mb-4 max-h-40 overflow-y-auto pr-2 bg-gray-50 p-3 rounded-lg border">
                  {product.description}
                </div>

                {/* Variantes (Tallas) */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Tallas Disponibles (Stock total: {product.stockTotal}):
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {activeVariations.map((variant) => (
                      <div
                        key={variant.idVariant}
                        className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:border-emerald-500 hover:bg-emerald-50 transition"
                      >
                        Talla {variant.name} ({variant.stock} disponibles)
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pie de Tarjeta: Garantía y Soporte */}
              <div className="border-t pt-3 mt-2 text-xs text-gray-500 flex justify-between items-center">
                <span>🛡️ Garantía: {product.warrantyPeriod} días</span>
                <span>✉️ {product.supportEmail}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
