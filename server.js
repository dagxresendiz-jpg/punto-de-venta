// server.js - Versión con Menú para Clientes y Sistema de Pedidos
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// --- CONFIGURACIÓN ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_secreto_y_largo_y_diferente';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
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

const commonFields = { status: { type: String, default: 'activo' } };
const userPermissionsSchema = createSchema({
    gestion: { type: Boolean, default: false },
    clientes: { type: Boolean, default: false },
    historial: { type: Boolean, default: false },
    papelera: { type: Boolean, default: false },
    usuarios: { type: Boolean, default: false }
});

const Producto = mongoose.model('Producto', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Topping = mongoose.model('Topping', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Jarabe = mongoose.model('Jarabe', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Cliente = mongoose.model('Cliente', createSchema({ nombre: String, telefono: String, direccion: String, ...commonFields }));
const Usuario = mongoose.model('Usuario', createSchema({ 
    username: { type: String, unique: true, required: true }, 
    password: { type: String, required: true }, 
    role: { type: String, required: true }, 
    permissions: { type: userPermissionsSchema, default: () => ({}) },
    ...commonFields 
}));
const Venta = mongoose.model('Venta', createSchema({
    fecha: Date, clienteId: String, clienteNombre: String, items: Array,
    subtotal: Number, costoDomicilio: Number, total: Number, metodoPago: String,
    vendedorId: String, vendedorUsername: String, estatus: String, ...commonFields
}));
const AppConfig = mongoose.model('AppConfig', createSchema({
    logo_base64: { type: String },
    primary_color: { type: String, default: '#4f46e5' },
    accent_color: { type: String, default: '#FF85A2' }
}));

// ===== NUEVO MODELO: PEDIDOS DE CLIENTES =====
const Pedido = mongoose.model('Pedido', createSchema({
    nombreCliente: { type: String, required: true },
    telefonoCliente: { type: String, required: true },
    items: Array,
    total: Number,
    estatus: { type: String, default: 'recibido' } // Ej: recibido, en_preparacion, listo, entregado
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
const tienePermiso = (seccion) => async (req, res, next) => {
    try {
        if(req.user.role === 'admin') {
            return next();
        }
        const permisos = req.user.permissions || {};
        if (permisos[seccion]) {
            return next();
        }
        return res.status(403).json({ error: `Acceso denegado. Se requiere permiso para la sección '${seccion}'.` });
    } catch(error) {
        return res.status(500).json({ error: 'Error interno del servidor al verificar permisos.' });
    }
};

// --- RUTAS PÚBLICAS (NO REQUIEREN TOKEN) ---

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = await Usuario.findOne({ 
            username,
            $or: [{ status: 'activo' }, { status: { $exists: false } }] 
        });
        if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) return res.status(401).json({ error: 'Credenciales inválidas' });
        
        const token = jwt.sign({ id: usuario._id, username: usuario.username, role: usuario.role, permissions: usuario.permissions }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token });
    } catch (error) { res.status(500).send('Error en el servidor'); }
});

app.get('/api/configuracion', async (req, res) => {
    try {
        let config = await AppConfig.findOne();
        if (!config) {
            config = await AppConfig.create({
                primary_color: '#4f46e5',
                accent_color: '#FF85A2'
            });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la configuración de la aplicación.' });
    }
});

// ===== NUEVAS RUTAS PÚBLICAS PARA EL MENÚ DEL CLIENTE =====
const findActive = { $or: [{ status: 'activo' }, { status: { $exists: false } }] };
app.get('/api/menu/productos', async (req, res) => res.json(await Producto.find(findActive)));
app.get('/api/menu/toppings', async (req, res) => res.json(await Topping.find(findActive)));
app.get('/api/menu/jarabes', async (req, res) => res.json(await Jarabe.find(findActive)));

// Ruta pública para que los clientes envíen sus pedidos
app.post('/api/pedidos', async (req, res) => {
    try {
        const { nombreCliente, telefonoCliente, items, total } = req.body;
        if (!nombreCliente || !telefonoCliente || !items || items.length === 0) {
            return res.status(400).json({ error: 'Faltan datos en el pedido.' });
        }
        // Aquí podrías añadir una validación de precios del lado del servidor por seguridad
        const nuevoPedido = await Pedido.create({ nombreCliente, telefonoCliente, items, total });
        res.status(201).json({ message: 'Pedido recibido con éxito', pedidoId: nuevoPedido.id });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el pedido.' });
    }
});

// --- PROTECCIÓN DE RUTAS API ---
app.use('/api', verificarToken);

// --- RUTAS PRIVADAS (REQUIEREN TOKEN) ---

app.post('/api/configuracion', esAdmin, async (req, res) => {
    try {
        const configData = req.body;
        const updatedConfig = await AppConfig.findOneAndUpdate({}, configData, { new: true, upsert: true });
        res.json({ message: 'Configuración actualizada con éxito', config: updatedConfig });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la configuración de la aplicación.' });
    }
});

// ===== NUEVAS RUTAS PRIVADAS PARA GESTIONAR PEDIDOS =====
const pedidosRouter = express.Router();
pedidosRouter.get('/', async (req, res) => res.json(await Pedido.find().sort({ createdAt: -1 })));
pedidosRouter.put('/:id', async (req, res) => {
    const { estatus } = req.body;
    if (!estatus) return res.status(400).json({ error: 'Se requiere un nuevo estatus.' });
    const pedidoActualizado = await Pedido.findByIdAndUpdate(req.params.id, { estatus }, { new: true });
    res.json(pedidoActualizado);
});
pedidosRouter.delete('/:id', async (req, res) => {
    await Pedido.findByIdAndDelete(req.params.id);
    res.status(204).send();
});
app.use('/api/pedidos', esAdmin, pedidosRouter);


const crearRutasCrud = (modelo, nombre, permiso) => {
    const router = express.Router();
    
    router.get('/', tienePermiso(permiso), async (req, res) => res.json(await modelo.find(findActive)));
    router.get('/papelera', tienePermiso('papelera'), async (req, res) => res.json(await modelo.find({ status: 'eliminado' })));
    router.post('/', tienePermiso(permiso), async (req, res) => res.status(201).json(await modelo.create(req.body)));
    router.put('/:id', tienePermiso(permiso), async (req, res) => res.json(await modelo.findByIdAndUpdate(req.params.id, req.body, { new: true })));
    router.delete('/:id', tienePermiso(permiso), async (req, res) => { await modelo.findByIdAndUpdate(req.params.id, { status: 'eliminado' }); res.status(204).send(); });
    router.put('/:id/restaurar', tienePermiso('papelera'), async (req, res) => { await modelo.findByIdAndUpdate(req.params.id, { status: 'activo' }); res.json({ message: `${nombre} restaurado` }); });
    router.delete('/:id/permanente', tienePermiso('papelera'), async (req, res) => { await modelo.findByIdAndDelete(req.params.id); res.status(204).send(); });
    
    return router;
};

app.use('/api/productos', crearRutasCrud(Producto, 'Producto', 'gestion'));
app.use('/api/toppings', crearRutasCrud(Topping, 'Topping', 'gestion'));
app.use('/api/jarabes', crearRutasCrud(Jarabe, 'Jarabe', 'gestion'));
app.use('/api/clientes', crearRutasCrud(Cliente, 'Cliente', 'clientes'));

const ventasRouter = express.Router();
ventasRouter.post('/', async (req, res) => {
    let nuevaVentaData = req.body;
    nuevaVentaData.vendedorId = req.user.id;
    nuevaVentaData.vendedorUsername = req.user.username;
    const ventaCreada = await Venta.create(nuevaVentaData);
    res.status(201).json(ventaCreada);
});
ventasRouter.get('/', tienePermiso('historial'), async (req, res) => res.json(await Venta.find(findActive)));
ventasRouter.get('/papelera', tienePermiso('papelera'), async (req, res) => res.json(await Venta.find({ status: 'eliminado' })));
ventasRouter.put('/:id', tienePermiso('historial'), async (req, res) => {
    res.json(await Venta.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});
ventasRouter.delete('/:id', tienePermiso('historial'), async (req, res) => { await Venta.findByIdAndUpdate(req.params.id, { status: 'eliminado' }); res.status(204).send(); });
ventasRouter.put('/:id/restaurar', tienePermiso('papelera'), async (req, res) => { await Venta.findByIdAndUpdate(req.params.id, { status: 'activo' }); res.json({ message: 'Venta restaurada' }); });
ventasRouter.delete('/:id/permanente', tienePermiso('papelera'), async (req, res) => { await Venta.findByIdAndDelete(req.params.id); res.status(204).send(); });
app.use('/api/ventas', ventasRouter);

const usuariosRouter = express.Router();
usuariosRouter.get('/', tienePermiso('usuarios'), async (req, res) => res.json(await Usuario.find(findActive).select('-password')));
usuariosRouter.get('/papelera', tienePermiso('papelera'), async (req, res) => res.json(await Usuario.find({ status: 'eliminado' }).select('-password')));
usuariosRouter.post('/', tienePermiso('usuarios'), async (req, res) => {
    const { username, password, role, permissions } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
    if (await Usuario.findOne({ username })) return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({ username, password: hashedPassword, role, permissions: permissions || {} });
    const userResponse = nuevoUsuario.toJSON();
    delete userResponse.password;
    res.status(201).json(userResponse);
});
usuariosRouter.put('/:id', tienePermiso('usuarios'), async (req, res) => {
    const primerAdmin = await Usuario.findOne({}).sort({ createdAt: 1 });
    if (req.params.id === primerAdmin.id.toString()) return res.status(403).json({ error: 'No se puede modificar al superusuario.' });
    
    const { username, role, permissions, password } = req.body;
    let datosActualizar = { username, role, permissions };
    if (password) {
        datosActualizar.password = await bcrypt.hash(password, 10);
    }
    const usuarioActualizado = await Usuario.findByIdAndUpdate(req.params.id, datosActualizar, { new: true }).select('-password');
    if (!usuarioActualizado) return res.status(404).json({error: 'Usuario no encontrado'});
    res.json(usuarioActualizado);
});
usuariosRouter.put('/:id/restaurar', tienePermiso('papelera'), async (req, res) => { await Usuario.findByIdAndUpdate(req.params.id, { status: 'activo' }); res.json({ message: 'Usuario restaurado' }); });
usuariosRouter.delete('/:id', tienePermiso('usuarios'), async (req, res) => {
    const primerAdmin = await Usuario.findOne({}).sort({ createdAt: 1 });
    if (req.params.id === primerAdmin.id.toString()) return res.status(403).json({ error: 'No se puede eliminar al superusuario.' });
    if (req.params.id === req.user.id) return res.status(403).json({ error: 'No puedes eliminarte a ti mismo.' });
    await Usuario.findByIdAndUpdate(req.params.id, { status: 'eliminado' });
    res.status(204).send();
});
usuariosRouter.delete('/:id/permanente', tienePermiso('papelera'), async (req, res) => { await Usuario.findByIdAndDelete(req.params.id); res.status(204).send(); });
app.use('/api/usuarios', esAdmin, usuariosRouter);

// --- RUTA "CATCH-ALL" PARA SERVIR EL FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));