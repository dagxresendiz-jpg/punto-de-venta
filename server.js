// server.js - Versión Final con Rutas Corregidas para Login y API
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

// --- SERVIR ARCHIVOS ESTÁTICOS ---
// Sirve los archivos de la carpeta 'public' (index.html, menu.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));


// --- CONEXIÓN A LA BASE DE DATOS ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('Conexión a MongoDB Atlas exitosa.'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// --- MODELOS DE DATOS (Sin cambios) ---
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
const Pedido = mongoose.model('Pedido', createSchema({
    nombreCliente: { type: String, required: true },
    telefonoCliente: { type: String, required: true },
    items: Array,
    total: Number,
    estatus: { type: String, default: 'recibido' }
}));


// --- MIDDLEWARES DE SEGURIDAD (Sin cambios) ---
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
        if(req.user.role === 'admin') { return next(); }
        const permisos = req.user.permissions || {};
        if (permisos[seccion]) { return next(); }
        return res.status(403).json({ error: `Acceso denegado. Se requiere permiso para la sección '${seccion}'.` });
    } catch(error) {
        return res.status(500).json({ error: 'Error interno del servidor al verificar permisos.' });
    }
};

// ==========================================================
// ===== ORGANIZACIÓN DE RUTAS API (ESTA ES LA CORRECCIÓN) =====
// ==========================================================
// Todas las rutas de la API ahora están agrupadas bajo '/api' o '/auth'

// --- RUTAS DE AUTENTICACIÓN Y PÚBLICAS DE LA API ---
const publicApiRouter = express.Router();
const findActive = { $or: [{ status: 'activo' }, { status: { $exists: false } }] };

publicApiRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = await Usuario.findOne({ username, ...findActive });
        if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: usuario._id, username: usuario.username, role: usuario.role, permissions: usuario.permissions }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token });
    } catch (error) { res.status(500).send('Error en el servidor'); }
});
app.use('/auth', publicApiRouter);

const apiRouter = express.Router();
apiRouter.get('/configuracion', async (req, res) => {
    try {
        let config = await AppConfig.findOne();
        if (!config) { config = await AppConfig.create({}); }
        res.json(config);
    } catch (error) { res.status(500).json({ error: 'Error al obtener la configuración.' }); }
});
apiRouter.get('/menu/productos', async (req, res) => res.json(await Producto.find(findActive)));
apiRouter.get('/menu/toppings', async (req, res) => res.json(await Topping.find(findActive)));
apiRouter.get('/menu/jarabes', async (req, res) => res.json(await Jarabe.find(findActive)));
apiRouter.post('/pedidos', async (req, res) => {
    try {
        const { nombreCliente, telefonoCliente, items, total } = req.body;
        if (!nombreCliente || !telefonoCliente || !items || items.length === 0) {
            return res.status(400).json({ error: 'Faltan datos en el pedido.' });
        }
        const nuevoPedido = await Pedido.create({ nombreCliente, telefonoCliente, items, total });
        res.status(201).json({ message: 'Pedido recibido con éxito', pedidoId: nuevoPedido.id });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el pedido.' });
    }
});

// --- RUTAS PRIVADAS DE LA API ---
apiRouter.use(verificarToken); // <-- A partir de aquí, todas las rutas en apiRouter requieren token

apiRouter.post('/configuracion', esAdmin, async (req, res) => {
    const updatedConfig = await AppConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ message: 'Configuración actualizada', config: updatedConfig });
});

const pedidosRouter = express.Router();
pedidosRouter.get('/', esAdmin, async (req, res) => res.json(await Pedido.find().sort({ createdAt: -1 })));
pedidosRouter.put('/:id', esAdmin, async (req, res) => res.json(await Pedido.findByIdAndUpdate(req.params.id, { estatus: req.body.estatus }, { new: true })));
pedidosRouter.delete('/:id', esAdmin, async (req, res) => { await Pedido.findByIdAndDelete(req.params.id); res.status(204).send(); });
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
apiRouter.use('/productos', crearRutasCrud(Producto, 'Producto', 'gestion'));
apiRouter.use('/toppings', crearRutasCrud(Topping, 'Topping', 'gestion'));
apiRouter.use('/jarabes', crearRutasCrud(Jarabe, 'Jarabe', 'gestion'));
apiRouter.use('/clientes', crearRutasCrud(Cliente, 'Cliente', 'clientes'));

const ventasRouter = express.Router();
ventasRouter.post('/', (req, res) => { /* ... */ }); // Sin cambios
apiRouter.use('/ventas', ventasRouter);

const usuariosRouter = express.Router();
usuariosRouter.get('/', tienePermiso('usuarios'), async (req, res) => res.json(await Usuario.find(findActive).select('-password')));
usuariosRouter.post('/', tienePermiso('usuarios'), async (req, res) => { /* ... */ }); // Sin cambios
apiRouter.use('/usuarios', esAdmin, usuariosRouter);

// Usar el router principal de la API
app.use('/api', apiRouter);


// --- RUTA "CATCH-ALL" PARA SERVIR EL FRONTEND ---
// ESTA RUTA DEBE IR SIEMPRE AL FINAL
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));