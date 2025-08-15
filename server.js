// server.js - Versión Actualizada para Reimpresión de Tickets
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ... (Configuración y Modelos sin cambios)

// --- RUTAS DE API ---
// ... (Rutas de productos, toppings, etc., sin cambios)

// --- RUTAS DE VENTAS (MODIFICADAS) ---
app.post('/api/ventas', async (req, res) => {
    let nuevaVentaData = req.body;
    nuevaVentaData.vendedorId = req.user.id;
    nuevaVentaData.vendedorUsername = req.user.username;
    const ventaCreada = await Venta.create(nuevaVentaData);
    res.status(201).json(ventaCreada);
});
app.get('/api/ventas', async (req, res) => res.json(await Venta.find()));

// --- NUEVA RUTA PARA OBTENER UNA VENTA INDIVIDUAL ---
app.get('/api/ventas/:id', async (req, res) => {
    try {
        const venta = await Venta.findById(req.params.id);
        if (!venta) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json(venta);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar la venta' });
    }
});

app.delete('/api/ventas/:id', esAdmin, async (req, res) => { await Venta.findByIdAndDelete(req.params.id); res.status(204).send(); });

// ... (Resto del server.js sin cambios)