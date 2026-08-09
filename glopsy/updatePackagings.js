import { query } from './db.js';

async function updateProductPackagings() {
    try {
        const productos = await query('SELECT * FROM produc;');
        const empaques = await query("SELECT * FROM tipo_empaque WHERE nombre != 'Caja Grande';");

        for (const producto of productos.rows) {
            // Supongamos que medida por defecto es 30cm x 30cm x 30cm y peso 3kg
            const dimensions = {
                peso: producto.peso || 3,
                largo: producto.largo || 30,
                alto: producto.alto || 30,
                ancho: producto.ancho || 30
            };

            // Encuentra el empaquetado más pequeño que cumpla con el tamaño del producto
            const selectedPack = empaques.rows
                .filter(e => e.peso >= dimensions.peso) // Filtra por peso
                .filter(e => e.largo >= dimensions.largo)
                .filter(e => e.alto >= dimensions.alto)
                .filter(e => e.ancho >= dimensions.ancho)
                .reduce((prev, curr) => (prev.peso < curr.peso ? prev : curr), empaques.rows[0]);

            // Actualiza el producto con el tipo de empaque seleccionado
            if (selectedPack) {
                await query('UPDATE produc SET tipo_empaque_id = $1 WHERE id = $2;', [selectedPack.id, producto.id]);
                console.log(`Producto ${producto.name} actualizado con tipo_empaque_id ${selectedPack.id}`);
            }
        }
    } catch (error) {
        console.error('Error al actualizar empaques:', error);
    }
}

updateProductPackagings();
