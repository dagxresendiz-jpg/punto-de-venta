// migration_script.js - Ejecutar una sola vez para actualizar datos antiguos
const mongoose = require('mongoose');

// URL de conexión a tu base de datos MongoDB
const MONGO_URI = "mongodb+srv://app_user:lqUN8YBniUnzJQRx@punto-de-venta.m7z4les.mongodb.net/dulcesamigas?retryWrites=true&w=majority&appName=punto-de-venta";

// --- Definición de los modelos (debe ser idéntica a la de server.js) ---
const createSchema = (definition) => new mongoose.Schema(definition, { strict: false, versionKey: false });
const commonFields = { status: { type: String, default: 'activo' } };

const Producto = mongoose.model('Producto', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Topping = mongoose.model('Topping', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Jarabe = mongoose.model('Jarabe', createSchema({ nombre: String, precio: Number, ...commonFields }));
const Cliente = mongoose.model('Cliente', createSchema({ nombre: String, telefono: String, direccion: String, ...commonFields }));
const Usuario = mongoose.model('Usuario', createSchema({ username: String, password: String, role: String, ...commonFields }));
const Venta = mongoose.model('Venta', createSchema({
    fecha: Date, clienteId: String, clienteNombre: String, items: Array,
    subtotal: Number, costoDomicilio: Number, total: Number, metodoPago: String,
    vendedorId: String, vendedorUsername: String, estatus: String, ...commonFields
}));

const modelos = [
    { model: Producto, name: 'Productos' },
    { model: Topping, name: 'Toppings' },
    { model: Jarabe, name: 'Jarabes' },
    { model: Cliente, name: 'Clientes' },
    { model: Usuario, name: 'Usuarios' },
    { model: Venta, name: 'Ventas' },
];

async function runMigration() {
    console.log('Iniciando script de migración...');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('Conexión a MongoDB exitosa.');

        for (const { model, name } of modelos) {
            console.log(`\nActualizando colección: ${name}...`);
            const resultado = await model.updateMany(
                { status: { $exists: false } }, // Busca todos los documentos que NO tengan el campo 'status'
                { $set: { status: 'activo' } }  // Añade el campo 'status' con el valor 'activo'
            );
            console.log(` -> Documentos encontrados para actualizar: ${resultado.matchedCount}`);
            console.log(` -> Documentos actualizados exitosamente: ${resultado.modifiedCount}`);
        }

        console.log('\n¡Migración completada exitosamente!');
        console.log('Todos tus registros antiguos ahora deberían ser visibles.');

    } catch (error) {
        console.error('\nOcurrió un error durante la migración:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Desconectado de MongoDB.');
    }
}

runMigration();