const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'ventas.json');

function limpiarVentas() {
  let ventas = [];

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    ventas = JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo ventas.json:', err);
    return;
  }

  const ventasLimpias = ventas.map(venta => {
    if (!venta.items) {
      // Convertir venta "plana" a la estructura con items
      return {
        id: venta.id || Date.now(),
        fecha: venta.fecha || new Date().toISOString(),
        items: [
          {
            productoId: venta.productoId || 0,
            productoNombre: venta.productoNombre || '',
            cantidad: venta.cantidad || 1,
            toppings: venta.toppings || [],
            jarabes: venta.jarabes || [],
            total: venta.total || 0
          }
        ],
        total: venta.total || 0
      };
    }
    return venta; // Ya está correcto
  });

  try {
    fs.writeFileSync(filePath, JSON.stringify(ventasLimpias, null, 2));
    console.log('Archivo ventas.json limpio y actualizado.');
  } catch (err) {
    console.error('Error escribiendo ventas.json:', err);
  }
}

limpiarVentas();
