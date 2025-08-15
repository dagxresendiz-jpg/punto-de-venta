// server.js - Versión Final, Completa y Verificada
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// --- CONFIGURACIÓN ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'tu_secreto_super_secreto_y_largo_y_diferente';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONEXIÓN A LA BASE DE DATOS ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('Conexión a MongoDB Atlas exitosa.'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// --- MODELOS DE DATOS ---
const createSchema = (definition) => new mongoose.Schema(definition, { 
    timestamps: true, 
    versionKey: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});
const Producto = mongoose.model('Producto', createSchema({ nombre: String, precio: Number }));
const Topping = mongoose.model('Topping', createSchema({ nombre: String, precio: Number }));
const Jarabe = mongoose.model('Jarabe', createSchema({ nombre: String, precio: Number }));
const Cliente = mongoose.model('Cliente', createSchema({ nombre: String, telefono: String, direccion: String }));
const Usuario = mongoose.model('Usuario', createSchema({ username: { type: String, unique: true, required: true }, password: { type: String, required: true }, role: { type: String, required: true }}));
const Venta = mongoose.model('Venta', createSchema({
    fecha: Date, clienteId: String, clienteNombre: String, items: Array,
    subtotal: Number, costoDomicilio: Number, total: Number, metodoPago: String,
    vendedorId: String, vendedorUsername: String
}));

// --- MIDDLEWARES DE SEGURIDAD ---
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

// --- RUTAS DE AUTENTICACIÓN (PÚBLICAS) ---
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = await Usuario.findOne({ username });
        if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = jwt.sign({ id: usuario._id, username: usuario.username, role: usuario.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token });
    } catch (error) { res.status(500).send('Error en el servidor'); }
});

// --- PROTECCIÓN DE RUTAS API ---
app.use('/api', verificarToken);

// --- RUTAS DE API ---
app.get('/api/productos', async (req, res) => res.json(await Producto.find()));
app.post('/api/productos', esAdmin, async (req, res) => res.status(201).json(await Producto.create(req.body)));
app.put('/api/productos/:id', esAdmin, async (req, res) => res.json(await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/productos/:id', esAdmin, async (req, res) => { await Producto.findByIdAndDelete(req.params.id); res.status(204).send(); });

app.get('/api/toppings', async (req, res) => res.json(await Topping.find()));
app.post('/api/toppings', esAdmin, async (req, res) => res.status(201).json(await Topping.create(req.body)));
app.put('/api/toppings/:id', esAdmin, async (req, res) => res.json(await Topping.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/toppings/:id', esAdmin, async (req, res) => { await Topping.findByIdAndDelete(req.params.id); res.status(204).send(); });

app.get('/api/jarabes', async (req, res) => res.json(await Jarabe.find()));
app.post('/api/jarabes', esAdmin, async (req, res) => res.status(201).json(await Jarabe.create(req.body)));
app.put('/api/jarabes/:id', esAdmin, async (req, res) => res.json(await Jarabe.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/jarabes/:id', esAdmin, async (req, res) => { await Jarabe.findByIdAndDelete(req.params.id); res.status(204).send(); });

app.get('/api/clientes', async (req, res) => res.json(await Cliente.find()));
app.post('/api/clientes', esAdmin, async (req, res) => res.status(201).json(await Cliente.create(req.body)));
app.put('/api/clientes/:id', esAdmin, async (req, res) => res.json(await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/clientes/:id', esAdmin, async (req, res) => { await Cliente.findByIdAndDelete(req.params.id); res.status(204).send(); });

app.post('/api/ventas', async (req, res) => {
    let nuevaVentaData = req.body;
    nuevaVentaData.vendedorId = req.user.id;
    nuevaVentaData.vendedorUsername = req.user.username;
    const ventaCreada = await Venta.create(nuevaVentaData);
    res.status(201).json(ventaCreada);
});
app.get('/api/ventas', async (req, res) => res.json(await Venta.find()));
app.get('/api/ventas/:id', async (req, res) => {
    try {
        const venta = await Venta.findById(req.params.id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json(venta);
    } catch (error) { res.status(500).json({ error: 'Error al buscar la venta' }); }
});
app.delete('/api/ventas/:id', esAdmin, async (req, res) => { await Venta.findByIdAndDelete(req.params.id); res.status(204).send(); });

app.get('/api/usuarios', esAdmin, async (req, res) => res.json(await Usuario.find().select('-password')));
app.post('/api/usuarios', esAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
    if (await Usuario.findOne({ username })) return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({ username, password: hashedPassword, role });
    res.status(201).json({id: nuevoUsuario._id, username: nuevoUsuario.username, role: nuevoUsuario.role});
});
app.put('/api/usuarios/:id', esAdmin, async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Se requiere una nueva contraseña.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const usuarioActualizado = await Usuario.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    if (!usuarioActualizado) return res.status(404).json({error: 'Usuario no encontrado'});
    res.json({ message: 'Contraseña actualizada' });
});
app.delete('/api/usuarios/:id', esAdmin, async (req, res) => {
    if (req.params.id === req.user.id) return res.status(403).json({ error: 'No puedes eliminarte a ti mismo.' });
    await Usuario.findByIdAndDelete(req.params.id);
    res.status(204).send();
});

// --- RUTA "CATCH-ALL" PARA SERVIR EL FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));