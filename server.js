// server.js - v8.1.1 (Backend con Lógica y Rutas para Repartidores)
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
    pedidos: { type: Boolean, default: false },
    gestion: { type: Boolean, default: false },
    clientes: { type: Boolean, default: false },
    historial: { type: Boolean, default: false },
    papelera: { type: Boolean, default: false },
    usuarios: { type: Boolean, default: false }
});
const Producto = mongoose.model('Producto', createSchema({ 
    nombre: String, 
    precio: Number, 
    agotado: { type: Boolean, default: false },
    ...commonFields 
}));
const Topping = mongoose.model('Topping', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Jarabe = mongoose.model('Jarabe', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Cliente = mongoose.model('Cliente', createSchema({ nombre: String, telefono: String, direccion: String, ...commonFields }));

const Usuario = mongoose.model('Usuario', createSchema({ 
    username: { type: String, unique: true, required: true }, 
    password: { type: String, required: true }, 
    role: { type: String, required: true, enum: ['seller', 'admin', 'repartidor'] },
    permissions: { type: userPermissionsSchema, default: () => ({}) },
    ...commonFields 
}));

const Venta = mongoose.model('Venta', createSchema({
    fecha: Date, clienteId: String, clienteNombre: String, items: Array,
    subtotal: Number, costoDomicilio: Number, total: Number, metodoPago: String,
    vendedorId: String, vendedorUsername: String, 
    repartidorId: { type: String, default: null },
    repartidorUsername: { type: String, default: null },
    estatus: String, 
    ...commonFields
}));

const AppConfig = mongoose.model('AppConfig', createSchema({
    logo_base64: { type: String },
    primary_color: { type: String, default: '#4f46e5' },
    accent_color: { type: String, default: '#FF85A2' }
}));

const Pedido = mongoose.model('Pedido', createSchema({
    nombreCliente: { type: String, required: true },
    telefonoCliente: { type: String, required: true },
    direccionEntrega: { type: String },
    items: Array,
    total: Number,
    estatus: { 
        type: String, 
        default: 'recibido', 
        enum: ['recibido', 'en_preparacion', 'listo', 'en_reparto', 'entregado', 'cancelado']
    },
    visto: { type: Boolean, default: false },
    repartidorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
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
function esRepartidor(req, res, next) {
    if (req.user.role !== 'repartidor') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de repartidor.' });
    }
    next();
}
const tienePermiso = (seccion) => async (req, res, next) => {
    try {
        if(req.user.role === 'admin') { return next(); }
        const permisos = req.user.permissions || {};
        if (permisos[seccion]) { return next(); }
        return res.status(403).json({ error: `Acceso denegado. Se requiere permiso para la sección '${seccion}'.` });
    } catch(error) {
        return res.status(500).json({ error: 'Error interno del servidor al verificar permisos.' });
    }
};

// --- RUTAS DE LA API ---
const apiRouter = express.Router();
const authRouter = express.Router();
const publicApiRouter = express.Router();
const repartidorRouter = express.Router();
const findActive = { $or: [{ status: 'activo' }, { status: { $exists: false } }] };

// --- RUTAS DE AUTENTICACIÓN (Públicas) ---
authRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = await Usuario.findOne({ username, ...findActive });
        if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: usuario._id, username: usuario.username, role: usuario.role, permissions: usuario.permissions }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token, role: usuario.role });
    } catch (error) { 
        console.error("Error en login:", error);
        res.status(500).send('Error en el servidor'); 
    }
});
app.use('/auth', authRouter);

// --- RUTAS PÚBLICAS DE LA API (Para el Menú) ---
publicApiRouter.get('/configuracion', async (req, res) => {
    try {
        let config = await AppConfig.findOne();
        if (!config) { config = await AppConfig.create({}); }
        res.json(config);
    } catch (error) { res.status(500).json({ error: 'Error al obtener la configuración.' }); }
});
publicApiRouter.get('/productos', async (req, res) => res.json(await Producto.find(findActive)));
publicApiRouter.get('/toppings', async (req, res) => res.json(await Topping.find(findActive)));
publicApiRouter.get('/jarabes', async (req, res) => res.json(await Jarabe.find(findActive)));
publicApiRouter.post('/pedidos', async (req, res) => {
    try {
        const { nombreCliente, telefonoCliente, direccionEntrega, items, total } = req.body;
        if (!nombreCliente || !telefonoCliente || !items || !items.length) {
            return res.status(400).json({ error: 'Faltan datos en el pedido.' });
        }
        const nuevoPedido = await Pedido.create({ nombreCliente, telefonoCliente, direccionEntrega, items, total, visto: false });
        res.status(201).json({ message: 'Pedido recibido con éxito', pedidoId: nuevoPedido.id });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el pedido.' });
    }
});
app.use('/api', publicApiRouter);

// --- RUTAS DE REPARTIDOR (Protegidas por Token y Rol) ---
repartidorRouter.use(verificarToken, esRepartidor);

repartidorRouter.get('/mis-pedidos', async (req, res) => {
    try {
        const pedidosAsignados = await Pedido.find({ repartidorId: req.user.id, estatus: 'en_reparto' }).sort({ createdAt: 1 });
        res.json(pedidosAsignados);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tus pedidos asignados.' });
    }
});

repartidorRouter.post('/finalizar-entrega/:id', async (req, res) => {
    try {
        const { metodoPago, estatus } = req.body;
        const pedido = await Pedido.findOneAndUpdate(
            { _id: req.params.id, repartidorId: req.user.id },
            { estatus: 'entregado' },
            { new: true }
        ).populate('repartidorId', 'username');

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado o no asignado a ti.' });
        }
        
        await Venta.create({
            fecha: new Date(),
            clienteNombre: pedido.nombreCliente,
            items: pedido.items,
            subtotal: pedido.total,
            costoDomicilio: 0,
            total: pedido.total,
            metodoPago: metodoPago,
            estatus: estatus,
            vendedorUsername: 'Pedido Online',
            repartidorId: pedido.repartidorId ? pedido.repartidorId.id : null,
            repartidorUsername: pedido.repartidorId ? pedido.repartidorId.username : null,
        });

        res.status(200).json({ message: 'Entrega finalizada y registrada con éxito.' });
    } catch (error) {
        console.error("Error al finalizar entrega:", error);
        res.status(500).json({ error: 'Error al finalizar la entrega.' });
    }
});
app.use('/api/repartidor', repartidorRouter);


// --- RUTAS PRIVADAS (Protegidas por Token) ---
apiRouter.use(verificarToken);

apiRouter.post('/configuracion', esAdmin, async (req, res) => {
    const updatedConfig = await AppConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ message: 'Configuración actualizada', config: updatedConfig });
});

const pedidosRouter = express.Router();
pedidosRouter.get('/', tienePermiso('pedidos'), async (req, res) => {
    const pedidos = await Pedido.find().populate('repartidorId', 'username').sort({ createdAt: -1 });
    res.json(pedidos);
});
pedidosRouter.put('/:id', tienePermiso('pedidos'), async (req, res) => res.json(await Pedido.findByIdAndUpdate(req.params.id, { estatus: req.body.estatus }, { new: true })));
pedidosRouter.delete('/:id', tienePermiso('pedidos'), async (req, res) => { await Pedido.findByIdAndDelete(req.params.id); res.status(204).send(); });
pedidosRouter.post('/:id/asignar', tienePermiso('pedidos'), async (req, res) => {
    try {
        const { repartidorId } = req.body;
        if (!repartidorId) return res.status(400).json({ error: 'Se requiere el ID del repartidor.' });
        const pedido = await Pedido.findByIdAndUpdate(
            req.params.id, 
            { repartidorId: repartidorId, estatus: 'en_reparto' }, 
            { new: true }
        ).populate('repartidorId', 'username');
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
        res.json(pedido);
    } catch (error) {
        console.error("Error al asignar repartidor:", error);
        res.status(500).json({ error: 'Error interno al asignar repartidor.' });
    }
});
pedidosRouter.post('/:id/convertir-a-venta', tienePermiso('pedidos'), async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.id).populate('repartidorId', 'username');
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
        const nuevaVenta = await Venta.create({
            fecha: new Date(),
            clienteNombre: pedido.nombreCliente,
            items: pedido.items,
            subtotal: pedido.total,
            costoDomicilio: 0,
            total: pedido.total,
            metodoPago: 'Pedido Online',
            estatus: 'Pagado',
            vendedorId: req.user.id,
            vendedorUsername: req.user.username,
            repartidorId: pedido.repartidorId ? pedido.repartidorId.id : null,
            repartidorUsername: pedido.repartidorId ? pedido.repartidorId.username : null,
        });
        await Pedido.findByIdAndDelete(req.params.id);
        res.status(201).json(nuevaVenta);
    } catch (error) {
        console.error("Error al convertir pedido:", error);
        res.status(500).json({ error: 'Error al convertir el pedido a venta.' });
    }
});
pedidosRouter.get('/nuevos/contador', tienePermiso('pedidos'), async (req, res) => {
    try {
        const count = await Pedido.countDocuments({ visto: false });
        res.json({ count });
    } catch (error) { res.status(500).json({ error: 'Error al contar pedidos nuevos.' }); }
});
pedidosRouter.post('/marcar-vistos', tienePermiso('pedidos'), async (req, res) => {
    try {
        await Pedido.updateMany({ visto: false }, { $set: { visto: true } });
        res.status(200).json({ message: 'Pedidos marcados como vistos.' });
    } catch (error) { res.status(500).json({ error: 'Error al marcar pedidos como vistos.' }); }
});
apiRouter.use('/pedidos', pedidosRouter);

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

const productosRouter = crearRutasCrud(Producto, 'Producto', 'gestion');
productosRouter.put('/:id/toggle-agotado', tienePermiso('gestion'), async (req, res) => {
    try {
        const producto = await Producto.findById(req.params.id);
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        producto.agotado = !producto.agotado;
        await producto.save();
        res.json(producto);
    } catch (error) { res.status(500).json({ error: 'Error al actualizar el estado del producto.' }); }
});
apiRouter.use('/productos', productosRouter);
apiRouter.use('/toppings', crearRutasCrud(Topping, 'Topping', 'gestion'));
apiRouter.use('/jarabes', crearRutasCrud(Jarabe, 'Jarabe', 'gestion'));
apiRouter.use('/clientes', crearRutasCrud(Cliente, 'Cliente', 'clientes'));

const ventasRouter = express.Router();
ventasRouter.post('/', (req, res, next) => {
    let nuevaVentaData = req.body;
    nuevaVentaData.vendedorId = req.user.id;
    nuevaVentaData.vendedorUsername = req.user.username;
    Venta.create(nuevaVentaData).then(venta => res.status(201).json(venta)).catch(next);
});
ventasRouter.get('/', tienePermiso('historial'), async (req, res) => res.json(await Venta.find(findActive)));
ventasRouter.get('/papelera', tienePermiso('papelera'), async (req, res) => res.json(await Venta.find({ status: 'eliminado' })));
ventasRouter.put('/:id', tienePermiso('historial'), async (req, res) => res.json(await Venta.findByIdAndUpdate(req.params.id, req.body, { new: true })));
ventasRouter.delete('/:id', tienePermiso('historial'), async (req, res) => { await Venta.findByIdAndUpdate(req.params.id, { status: 'eliminado' }); res.status(204).send(); });
ventasRouter.put('/:id/restaurar', tienePermiso('papelera'), async (req, res) => { await Venta.findByIdAndUpdate(req.params.id, { status: 'activo' }); res.json({ message: 'Venta restaurada' }); });
ventasRouter.delete('/:id/permanente', tienePermiso('papelera'), async (req, res) => { await Venta.findByIdAndDelete(req.params.id); res.status(204).send(); });
apiRouter.use('/ventas', ventasRouter);

const usuariosRouter = express.Router();
usuariosRouter.get('/', tienePermiso('usuarios'), async (req, res) => res.json(await Usuario.find(findActive).select('-password')));
usuariosRouter.get('/papelera', tienePermiso('papelera'), async (req, res) => res.json(await Usuario.find({ status: 'eliminado' }).select('-password')));
usuariosRouter.get('/repartidores', tienePermiso('pedidos'), async (req, res) => {
    try {
        const repartidores = await Usuario.find({ role: 'repartidor', ...findActive }).select('username');
        res.json(repartidores);
    } catch (error) { res.status(500).json({ error: 'Error al obtener la lista de repartidores.' }); }
});
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
    if (password) { datosActualizar.password = await bcrypt.hash(password, 10); }
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
apiRouter.use('/usuarios', esAdmin, usuariosRouter);

// Usar el router principal de la API PRIVADA
app.use('/api', apiRouter);

// --- RUTA "CATCH-ALL" PARA SERVIR EL FRONTEND ---
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/repartidor')) {
        res.sendFile(path.join(__dirname, 'public', 'repartidor.html'));
    } else if (req.originalUrl.startsWith('/menu')) {
        res.sendFile(path.join(__dirname, 'public', 'menu.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));