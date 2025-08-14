const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'tu_secreto_super_secreto_y_largo_y_diferente'; // Es buena práctica cambiar este secreto

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dataDir = path.join(__dirname, 'data');

// Leer JSON
function leerArchivo(nombre) {
  const filePath = path.join(dataDir, nombre);
  if (!fs.existsSync(filePath)) {
    return []; // Si el archivo no existe, devuelve array vacío
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Si el archivo está vacío, la data será una cadena vacía, lo que causa error en JSON.parse
    return data ? JSON.parse(data) : [];
  } catch (e) { 
    return []; // Si hay un error de parseo, devuelve array vacío
  }
}

// Escribir JSON
function escribirArchivo(nombre, contenido) {
  fs.writeFileSync(path.join(dataDir, nombre), JSON.stringify(contenido, null, 2));
}

// =======================================================
//                RUTAS DE AUTENTICACIÓN (PÚBLICAS)
// =======================================================

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const usuarios = leerArchivo('usuarios.json');
    const usuario = usuarios.find(u => u.username === username);

    if (!usuario) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: usuario.id, username: usuario.username, role: usuario.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ message: 'Login exitoso', token });
});

// =======================================================
//      MIDDLEWARES DE SEGURIDAD
// =======================================================
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(403).json({ error: 'Acceso denegado. Se requiere un token.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Token inválido o expirado.' });
        req.user = user;
        next();
    });
}

function esAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
}

app.use('/api', verificarToken);

// =======================================================
//                RUTAS DE API PROTEGIDAS
// =======================================================

// --- RUTAS DE SOLO LECTURA (PARA TODOS LOS USUARIOS LOGUEADOS) ---
app.get('/api/productos', (req, res) => { res.json(leerArchivo('productos.json')); });
app.get('/api/toppings', (req, res) => { res.json(leerArchivo('toppings.json')); });
app.get('/api/jarabes', (req, res) => { res.json(leerArchivo('jarabes.json')); });
app.get('/api/clientes', (req, res) => { res.json(leerArchivo('clientes.json')); });
app.get('/api/ventas', (req, res) => { res.json(leerArchivo('ventas.json')); });

// --- RUTAS DE ESCRITURA (PARA TODOS LOS USUARIOS LOGUEADOS) ---
app.post('/api/ventas', (req, res) => { 
    const ventas = leerArchivo('ventas.json'); 
    const nuevaVenta = req.body; 
    
    // Añadir automáticamente la información del usuario desde el token verificado
    nuevaVenta.vendedorId = req.user.id;
    nuevaVenta.vendedorUsername = req.user.username;
    
    nuevaVenta.id = nuevaVenta.id || Date.now(); 
    ventas.push(nuevaVenta); 
    escribirArchivo('ventas.json', ventas); 
    res.status(201).json(nuevaVenta); 
});

// --- RUTAS DE GESTIÓN (SOLO PARA ADMINS) ---
app.post('/api/productos', esAdmin, (req, res) => { const productos = leerArchivo('productos.json'); const nuevo = { ...req.body, id: Date.now() }; productos.push(nuevo); escribirArchivo('productos.json', productos); res.status(201).json(nuevo); });
app.put('/api/productos/:id', esAdmin, (req, res) => { const productos = leerArchivo('productos.json'); const id = parseInt(req.params.id); const index = productos.findIndex(p => p.id === id); if(index === -1) return res.status(404).json({error: 'Producto no encontrado'}); productos[index] = {...productos[index], ...req.body, id: id}; escribirArchivo('productos.json', productos); res.json(productos[index]); });
app.delete('/api/productos/:id', esAdmin, (req, res) => { const productos = leerArchivo('productos.json'); const id = parseInt(req.params.id); const nuevos = productos.filter(p => p.id !== id); if(nuevos.length === productos.length) return res.status(404).json({error: 'Producto no encontrado'}); escribirArchivo('productos.json', nuevos); res.status(204).send(); });

app.post('/api/toppings', esAdmin, (req, res) => { const toppings = leerArchivo('toppings.json'); const nuevo = { ...req.body, id: Date.now() }; toppings.push(nuevo); escribirArchivo('toppings.json', toppings); res.status(201).json(nuevo); });
app.put('/api/toppings/:id', esAdmin, (req, res) => { const toppings = leerArchivo('toppings.json'); const id = parseInt(req.params.id); const index = toppings.findIndex(t => t.id === id); if(index === -1) return res.status(404).json({error: 'Topping no encontrado'}); toppings[index] = {...toppings[index], ...req.body, id: id}; escribirArchivo('toppings.json', toppings); res.json(toppings[index]); });
app.delete('/api/toppings/:id', esAdmin, (req, res) => { const toppings = leerArchivo('toppings.json'); const id = parseInt(req.params.id); const nuevos = toppings.filter(t => t.id !== id); if(nuevos.length === toppings.length) return res.status(404).json({error: 'Topping no encontrado'}); escribirArchivo('toppings.json', nuevos); res.status(204).send(); });

app.post('/api/jarabes', esAdmin, (req, res) => { const jarabes = leerArchivo('jarabes.json'); const nuevo = { ...req.body, id: Date.now() }; jarabes.push(nuevo); escribirArchivo('jarabes.json', jarabes); res.status(201).json(nuevo); });
app.put('/api/jarabes/:id', esAdmin, (req, res) => { const jarabes = leerArchivo('jarabes.json'); const id = parseInt(req.params.id); const index = jarabes.findIndex(j => j.id === id); if(index === -1) return res.status(404).json({error: 'Jarabe no encontrado'}); jarabes[index] = {...jarabes[index], ...req.body, id: id}; escribirArchivo('jarabes.json', jarabes); res.json(jarabes[index]); });
app.delete('/api/jarabes/:id', esAdmin, (req, res) => { const jarabes = leerArchivo('jarabes.json'); const id = parseInt(req.params.id); const nuevos = jarabes.filter(j => j.id !== id); if(nuevos.length === jarabes.length) return res.status(404).json({error: 'Jarabe no encontrado'}); escribirArchivo('jarabes.json', nuevos); res.status(204).send(); });

app.post('/api/clientes', esAdmin, (req, res) => { const clientes = leerArchivo('clientes.json'); const nuevo = { ...req.body, id: Date.now() }; clientes.push(nuevo); escribirArchivo('clientes.json', clientes); res.status(201).json(nuevo); });
app.put('/api/clientes/:id', esAdmin, (req, res) => { const clientes = leerArchivo('clientes.json'); const id = parseInt(req.params.id); const index = clientes.findIndex(c => c.id === id); if (index === -1) return res.status(404).json({ error: 'Cliente no encontrado' }); clientes[index] = { ...clientes[index], ...req.body, id: id }; escribirArchivo('clientes.json', clientes); res.json(clientes[index]); });
app.delete('/api/clientes/:id', esAdmin, (req, res) => { const clientes = leerArchivo('clientes.json'); const id = parseInt(req.params.id); const nuevos = clientes.filter(c => c.id !== id); if(nuevos.length === clientes.length) return res.status(404).json({error: 'Cliente no encontrado'}); escribirArchivo('clientes.json', nuevos); res.status(204).send(); });

app.get('/api/usuarios', esAdmin, (req, res) => {
    const usuarios = leerArchivo('usuarios.json');
    const usuariosSinPassword = usuarios.map(({ password, ...resto }) => resto);
    res.json(usuariosSinPassword);
});

app.post('/api/usuarios', esAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
    if (role !== 'admin' && role !== 'seller') return res.status(400).json({ error: 'El rol debe ser "admin" o "seller".' });
    const usuarios = leerArchivo('usuarios.json');
    if (usuarios.find(u => u.username === username)) return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = { id: Date.now(), username, password: hashedPassword, role };
    usuarios.push(nuevoUsuario);
    escribirArchivo('usuarios.json', usuarios);
    const { password: _, ...usuarioCreado } = nuevoUsuario;
    res.status(201).json(usuarioCreado);
});

app.put('/api/usuarios/:id', esAdmin, async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Se requiere una nueva contraseña.' });
    const usuarios = leerArchivo('usuarios.json');
    const idUsuario = parseInt(req.params.id);
    const index = usuarios.findIndex(u => u.id === idUsuario);
    if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    usuarios[index].password = hashedPassword;
    escribirArchivo('usuarios.json', usuarios);
    res.json({ message: 'Contraseña actualizada correctamente.' });
});

app.delete('/api/usuarios/:id', esAdmin, (req, res) => {
    let usuarios = leerArchivo('usuarios.json');
    const idUsuario = parseInt(req.params.id);
    if (idUsuario === 1) return res.status(403).json({ error: 'No se puede eliminar al administrador principal.' });
    const totalInicial = usuarios.length;
    usuarios = usuarios.filter(u => u.id !== idUsuario);
    if (usuarios.length === totalInicial) return res.status(404).json({ error: 'Usuario no encontrado.' });
    escribirArchivo('usuarios.json', usuarios);
    res.status(204).send();
});

app.delete('/api/ventas/:id', esAdmin, (req, res) => { const ventas = leerArchivo('ventas.json'); const id = parseInt(req.params.id); const nuevos = ventas.filter(v => v.id !== id); if (nuevos.length === ventas.length) { return res.status(404).json({ error: 'Venta no encontrada' }); } escribirArchivo('ventas.json', nuevos); res.status(204).send(); });

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});