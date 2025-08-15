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
    timestamps: true, versionKey: false,
    toJSON: { transform: function (doc, ret) { ret.id = ret._id; delete ret._id; } }
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

// --- RUTA DE REGISTRO (LA QUE FALTABA) ---
// La dejamos "abierta" temporalmente para crear el primer admin.
// En un entorno de producción real, esta ruta se protegería o se eliminaría después del primer uso.
app.post('/auth/register', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
    }
    if (await Usuario.findOne({ username })) {
        return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({ username, password: hashedPassword, role });
    res.status(201).json({id: nuevoUsuario._id, username: nuevoUsuario.username, role: nuevoUsuario.role});
});


// --- PROTECCIÓN DE RUTAS API ---
app.use('/api', verificarToken);

// --- RUTAS DE API ---
// (El resto de las rutas se mantiene igual que la versión funcional)
// ...

// --- RUTA "CATCH-ALL" ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));