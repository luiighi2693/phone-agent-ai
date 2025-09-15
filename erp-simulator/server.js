const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Base de datos simulada en memoria
let products = [
  {
    codigo: "ABC-123",
    nombre: "Laptop Dell Inspiron 15",
    stock_disponible: 150,
    precio_unitario: 899.99,
    moneda: "USD",
    categoria: "Electrónicos"
  },
  {
    codigo: "XYZ-456",
    nombre: "Monitor Samsung 27 pulgadas",
    stock_disponible: 75,
    precio_unitario: 299.99,
    moneda: "USD",
    categoria: "Electrónicos"
  },
  {
    codigo: "DEF-789",
    nombre: "Teclado Mecánico Logitech",
    stock_disponible: 200,
    precio_unitario: 129.99,
    moneda: "USD",
    categoria: "Accesorios"
  },
  {
    codigo: "GHI-101",
    nombre: "Mouse Inalámbrico",
    stock_disponible: 0,
    precio_unitario: 49.99,
    moneda: "USD",
    categoria: "Accesorios"
  }
];

let customers = [
  {
    id: "CUST-001",
    nombre: "Empresa Tech Solutions",
    telefono: "+1234567890",
    email: "pedidos@techsolutions.com",
    descuento: 0.10
  },
  {
    id: "CUST-002",
    nombre: "Distribuidora Nacional",
    telefono: "+0987654321",
    email: "compras@distribuidora.com",
    descuento: 0.15
  }
];

let orders = [];

// Middleware de autenticación simple
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token !== 'demo-erp-token-12345') {
    return res.status(401).json({ error: 'Token de acceso inválido' });
  }
  
  next();
};

// Rutas de la API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Obtener inventario completo
app.get('/api/inventory', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: products,
    total_products: products.length
  });
});

// Consultar producto específico
app.get('/api/inventory/:productCode', authenticateToken, (req, res) => {
  const { productCode } = req.params;
  const product = products.find(p => p.codigo === productCode.toUpperCase());
  
  if (!product) {
    return res.status(404).json({
      success: false,
      error: `Producto ${productCode} no encontrado`
    });
  }
  
  // Simular latencia de red
  setTimeout(() => {
    res.json({
      success: true,
      data: product
    });
  }, 200 + Math.random() * 300); // 200-500ms delay
});

// Buscar productos por nombre
app.get('/api/products/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Parámetro de búsqueda requerido'
    });
  }
  
  const results = products.filter(p => 
    p.nombre.toLowerCase().includes(q.toLowerCase()) ||
    p.codigo.toLowerCase().includes(q.toLowerCase())
  );
  
  res.json({
    success: true,
    data: results,
    query: q
  });
});

// Obtener información de cliente
app.get('/api/customers/:phone', authenticateToken, (req, res) => {
  const { phone } = req.params;
  const customer = customers.find(c => c.telefono === phone);
  
  if (!customer) {
    return res.json({
      success: true,
      data: {
        id: "GUEST",
        nombre: "Cliente Invitado",
        telefono: phone,
        email: null,
        descuento: 0
      }
    });
  }
  
  res.json({
    success: true,
    data: customer
  });
});

// Crear nueva orden
app.post('/api/orders', authenticateToken, (req, res) => {
  const { customer_id, items, order_date, source } = req.body;
  
  // Validar items
  let totalAmount = 0;
  const processedItems = [];
  
  for (const item of items) {
    const product = products.find(p => p.codigo === item.product_code);
    
    if (!product) {
      return res.status(400).json({
        success: false,
        error: `Producto ${item.product_code} no encontrado`
      });
    }
    
    if (product.stock_disponible < item.quantity) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_disponible}, Solicitado: ${item.quantity}`
      });
    }
    
    const itemTotal = product.precio_unitario * item.quantity;
    totalAmount += itemTotal;
    
    processedItems.push({
      product_code: item.product_code,
      product_name: product.nombre,
      quantity: item.quantity,
      unit_price: product.precio_unitario,
      total_price: itemTotal
    });
    
    // Actualizar stock
    product.stock_disponible -= item.quantity;
  }
  
  // Crear orden
  const order = {
    id: `ORD-${Date.now()}`,
    customer_id,
    items: processedItems,
    total_amount: totalAmount,
    currency: "USD",
    status: "confirmed",
    order_date: order_date || new Date().toISOString
