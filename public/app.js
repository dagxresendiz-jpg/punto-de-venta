// Variables globales
let ventaActual = [];

// --- Gestión productos ---
async function cargarProductos() {
  const res = await fetch('/api/productos');
  const productos = await res.json();
  const lista = document.getElementById('listaProductos');
  lista.innerHTML = '';
  productos.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.nombre} - $${p.precio.toFixed(2)}`;
    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.onclick = () => {
      document.getElementById('nombreProducto').value = p.nombre;
      document.getElementById('precioProducto').value = p.precio;
      document.getElementById('idProducto').value = p.id;
    };
    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.onclick = async () => {
      if(confirm('¿Eliminar producto?')) {
        await fetch(`/api/productos/${p.id}`, { method: 'DELETE' });
        cargarProductos();
        cargarVentaSelects();
      }
    };
    li.appendChild(btnEditar);
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });
}

async function guardarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('idProducto').value;
  const nombre = document.getElementById('nombreProducto').value;
  const precio = parseFloat(document.getElementById('precioProducto').value);

  if(!nombre || isNaN(precio)) {
    alert('Completa los datos correctamente');
    return;
  }

  if(id) {
    await fetch(`/api/productos/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  } else {
    await fetch('/api/productos', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  }
  document.getElementById('formProducto').reset();
  cargarProductos();
  cargarVentaSelects();
}

// --- Gestión toppings ---
async function cargarToppings() {
  const res = await fetch('/api/toppings');
  const toppings = await res.json();
  const lista = document.getElementById('listaToppings');
  lista.innerHTML = '';
  toppings.forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.nombre} - $${t.precio.toFixed(2)}`;
    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.onclick = () => {
      document.getElementById('nombreTopping').value = t.nombre;
      document.getElementById('precioTopping').value = t.precio;
      document.getElementById('idTopping').value = t.id;
    };
    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.onclick = async () => {
      if(confirm('¿Eliminar topping?')) {
        await fetch(`/api/toppings/${t.id}`, { method: 'DELETE' });
        cargarToppings();
        cargarVentaSelects();
      }
    };
    li.appendChild(btnEditar);
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });
}

async function guardarTopping(e) {
  e.preventDefault();
  const id = document.getElementById('idTopping').value;
  const nombre = document.getElementById('nombreTopping').value;
  const precio = parseFloat(document.getElementById('precioTopping').value);

  if(!nombre || isNaN(precio)) {
    alert('Completa los datos correctamente');
    return;
  }

  if(id) {
    await fetch(`/api/toppings/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  } else {
    await fetch('/api/toppings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  }
  document.getElementById('formTopping').reset();
  cargarToppings();
  cargarVentaSelects();
}

// --- Gestión jarabes ---
async function cargarJarabes() {
  const res = await fetch('/api/jarabes');
  const jarabes = await res.json();
  const lista = document.getElementById('listaJarabes');
  lista.innerHTML = '';
  jarabes.forEach(j => {
    const li = document.createElement('li');
    li.textContent = `${j.nombre} - $${j.precio.toFixed(2)}`;
    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.onclick = () => {
      document.getElementById('nombreJarabe').value = j.nombre;
      document.getElementById('precioJarabe').value = j.precio;
      document.getElementById('idJarabe').value = j.id;
    };
    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.onclick = async () => {
      if(confirm('¿Eliminar jarabe?')) {
        await fetch(`/api/jarabes/${j.id}`, { method: 'DELETE' });
        cargarJarabes();
        cargarVentaSelects();
      }
    };
    li.appendChild(btnEditar);
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });
}

async function guardarJarabe(e) {
  e.preventDefault();
  const id = document.getElementById('idJarabe').value;
  const nombre = document.getElementById('nombreJarabe').value;
  const precio = parseFloat(document.getElementById('precioJarabe').value);

  if(!nombre || isNaN(precio)) {
    alert('Completa los datos correctamente');
    return;
  }

  if(id) {
    await fetch(`/api/jarabes/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  } else {
    await fetch('/api/jarabes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre, precio})
    });
  }
  document.getElementById('formJarabe').reset();
  cargarJarabes();
  cargarVentaSelects();
}

// --- Cargar selects de venta ---
async function cargarVentaSelects() {
  const [productosRes, toppingsRes, jarabesRes] = await Promise.all([
    fetch('/api/productos'),
    fetch('/api/toppings'),
    fetch('/api/jarabes')
  ]);
  const productos = await productosRes.json();
  const toppings = await toppingsRes.json();
  const jarabes = await jarabesRes.json();

  const selectProducto = document.getElementById('ventaProducto');
  const selectToppings = document.getElementById('ventaToppings');
  const selectJarabes = document.getElementById('ventaJarabes');

  selectProducto.innerHTML = '<option value="">-- Selecciona un producto --</option>';
  selectToppings.innerHTML = '';
  selectJarabes.innerHTML = '';

  productos.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.nombre} - $${p.precio.toFixed(2)}`;
    selectProducto.appendChild(option);
  });

  toppings.forEach(t => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = `${t.nombre} - $${t.precio.toFixed(2)}`;
    selectToppings.appendChild(option);
  });

  jarabes.forEach(j => {
    const option = document.createElement('option');
    option.value = j.id;
    option.textContent = `${j.nombre} - $${j.precio.toFixed(2)}`;
    selectJarabes.appendChild(option);
  });
}

// --- Venta actual ---
function actualizarTotalVenta() {
  const total = ventaActual.reduce((acc, item) => acc + item.total, 0);
  document.getElementById('totalVenta').textContent = `Total venta actual: $${total.toFixed(2)}`;
}

function mostrarVentaActual() {
  const lista = document.getElementById('listaVentaActual');
  lista.innerHTML = '';
  ventaActual.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `${item.productoNombre} x${item.cantidad} - $${item.total.toFixed(2)}`;
    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.onclick = () => {
      ventaActual.splice(index, 1);
      mostrarVentaActual();
      actualizarTotalVenta();
    };
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });
}

document.getElementById('btnAgregarVenta').addEventListener('click', async (e) => {
  e.preventDefault();

  const productoId = parseInt(document.getElementById('ventaProducto').value);
  const cantidad = parseInt(document.getElementById('ventaCantidad').value);
  const toppingsSeleccionados = Array.from(document.getElementById('ventaToppings').selectedOptions).map(opt => parseInt(opt.value));
  const jarabesSeleccionados = Array.from(document.getElementById('ventaJarabes').selectedOptions).map(opt => parseInt(opt.value));

  if (isNaN(productoId)) {
    alert('Selecciona un producto');
    return;
  }
  if (cantidad < 1) {
    alert('Cantidad debe ser al menos 1');
    return;
  }

  const [productosRes, toppingsRes, jarabesRes] = await Promise.all([
    fetch('/api/productos'),
    fetch('/api/toppings'),
    fetch('/api/jarabes')
  ]);
  const productos = await productosRes.json();
  const toppings = await toppingsRes.json();
  const jarabes = await jarabesRes.json();

  const producto = productos.find(p => p.id === productoId);
  const toppingsSeleccionadosObjs = toppings.filter(t => toppingsSeleccionados.includes(t.id));
  const jarabesSeleccionadosObjs = jarabes.filter(j => jarabesSeleccionados.includes(j.id));

  let totalItem = producto.precio * cantidad;
  toppingsSeleccionadosObjs.forEach(t => totalItem += t.precio);
  jarabesSeleccionadosObjs.forEach(j => totalItem += j.precio);

  ventaActual.push({
    productoId: producto.id,
    productoNombre: producto.nombre,
    cantidad,
    toppings: toppingsSeleccionadosObjs,
    jarabes: jarabesSeleccionadosObjs,
    total: totalItem
  });

  mostrarVentaActual();
  actualizarTotalVenta();

  document.getElementById('formVenta').reset();
});

// --- Registrar venta completa ---
document.getElementById('btnRegistrarVenta').addEventListener('click', async () => {
  if(ventaActual.length === 0) {
    alert('Agrega al menos un producto a la venta');
    return;
  }

  const ventaCompleta = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    items: ventaActual,
    total: ventaActual.reduce((acc, item) => acc + item.total, 0)
  };

  const res = await fetch('/api/ventas', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(ventaCompleta)
  });

  if(res.ok) {
    alert('Venta registrada con éxito');
    ventaActual = [];
    mostrarVentaActual();
    actualizarTotalVenta();
    document.getElementById('formVenta').reset();
    document.getElementById('ticket').textContent = generarTextoTicket(ventaCompleta);
    cargarTotalDia();
  } else {
    alert('Error al registrar la venta');
  }
});

// --- Generar texto ticket ---
function generarTextoTicket(venta) {
  let texto = `--- Ticket Dulces Amigas ---\nFecha: ${new Date(venta.fecha).toLocaleString()}\n\n`;
  venta.items.forEach((item, i) => {
    texto += `${i + 1}. ${item.productoNombre} x${item.cantidad} = $${item.total.toFixed(2)}\n`;
    if(item.toppings.length) texto += `   Toppings: ${item.toppings.map(t => t.nombre).join(', ')}\n`;
    if(item.jarabes.length) texto += `   Jarabes: ${item.jarabes.map(j => j.nombre).join(', ')}\n`;
  });
  texto += `\nTOTAL: $${venta.total.toFixed(2)}\n`;
  texto += `---------------------------`;
  return texto;
}

// --- Cargar total del día ---
async function cargarTotalDia() {
  const res = await fetch('/api/ventas');
  const ventas = await res.json();

  const hoy = new Date().toISOString().slice(0,10);
  let totalDia = 0;

  ventas.forEach(v => {
    if(v.fecha.startsWith(hoy)) {
      totalDia += v.total;
    }
  });

  document.getElementById('totalDia').textContent = `Total del día: $${totalDia.toFixed(2)}`;
}

// --- Cargar historial ventas ---
async function cargarVentasHistorial() {
  const res = await fetch('/api/ventas');
  const ventas = await res.json();
  const tbody = document.getElementById('tablaVentasBody');
  tbody.innerHTML = '';

  let totalDia = 0;
  const hoy = new Date().toISOString().slice(0,10);

  ventas.forEach(venta => {
    if(venta.fecha.startsWith(hoy)) {
      totalDia += venta.total;
    }
    venta.items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${venta.id}</td>
        <td>${item.productoNombre}</td>
        <td>${item.cantidad}</td>
        <td>${item.toppings.map(t => t.nombre).join(', ')}</td>
        <td>${item.jarabes.map(j => j.nombre).join(', ')}</td>
        <td>$${item.total.toFixed(2)}</td>
        <td>${new Date(venta.fecha).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  document.getElementById('totalDiaHistorial').textContent = `Total vendido hoy: $${totalDia.toFixed(2)}`;
}

// --- Eventos formularios gestión ---
document.getElementById('formProducto').addEventListener('submit', guardarProducto);
document.getElementById('formTopping').addEventListener('submit', guardarTopping);
document.getElementById('formJarabe').addEventListener('submit', guardarJarabe);

// --- Carga inicial ---
window.onload = () => {
  cargarProductos();
  cargarToppings();
  cargarJarabes();
  cargarVentaSelects();
  cargarTotalDia();
  mostrarVentaActual();
  actualizarTotalVenta();
  cargarVentasHistorial();
};
// --- Enviar ticket por WhatsApp ---
function enviarTicketPorWhatsApp(textoTicket) {
  const numeroTelefono = '528132520539'; //   
const textoUrl = encodeURIComponent(textoTicket);
  const urlWhatsApp = `https://wa.me/${numeroTelefono}?text=${textoUrl}`;
  window.open(urlWhatsApp, '_blank');
}

document.getElementById('btnEnviarWhatsApp').addEventListener('click', () => {
  const ticket = document.getElementById('ticket').textContent.trim();
  if(!ticket) {
    alert('No hay ticket para enviar');
    return;
  }
  enviarTicketPorWhatsApp(ticket);
});

