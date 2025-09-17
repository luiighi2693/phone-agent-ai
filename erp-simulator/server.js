const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Base de datos simulada
const customers = [
  {
    id: 'CUST001',
    nombre: 'Empresa ABC',
    telefono: '+1234567890',
    email: 'contacto@empresaabc.com',
    descuento: 0.10,
    credito_disponible: 50000
  },
  {
    id: 'CUST002', 
    nombre: 'Distribuidora XYZ',
    telefono: '+0987654321',
    email: 'pedidos@xyz.com',
    descuento: 0.15,
    credito_disponible: 75000
  }
];

const products = [
  {
    id: 'PROD001',
    codigo: 'LAP001',
    nombre: 'Laptop Dell Inspiron 15',
    descripcion: 'Laptop para oficina, 8GB RAM, 256GB SSD',
    precio_unitario: 899.99,
    stock_disponible: 25,
    categoria: 'Computadoras',
    activo: true
  },
  {
    id: 'PROD002',
    codigo: 'MON001', 
    nombre: 'Monitor Samsung 24"',
    descripcion: 'Monitor Full HD 1920x1080',
    precio_unitario: 199.99,
    stock_disponible: 50,
    categoria: 'Monitores',
    activo: true
  },
  {
    id: 'PROD003',
    codigo: 'TEC001',
    nombre: 'Teclado Logitech MX Keys',
    descripcion: 'Teclado inalámbrico retroiluminado',
    precio_unitario: 99.99,
    stock_disponible: 100,
    categoria: 'Accesorios',
    activo: true
  }
];

let orders = [];
let orderCounter = 1;

// Middleware de autenticación simple
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== 'demo-erp-token-12345') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  next();
};

// Rutas de clientes
app.get('/api/customers/by-phone/:phone', authenticate, (req, res) => {
  const phone = req.params.phone;
  const customer = customers.find(c => c.telefono === phone);
  
  if (!customer) {
    return res.status(404).json({
      id: 'GUEST',
      nombre: 'Cliente',
      telefono: phone,
      descuento: 0,
      credito_disponible: 0
    });
  }
  
  res.json(customer);
});

// Rutas de productos
app.get('/api/products', authenticate, (req, res) => {
  res.json(products.filter(p => p.activo));
});

app.get('/api/products/:code', authenticate, (req, res) => {
  const product = products.find(p => p.codigo === req.params.code && p.activo);
  
  if (!product) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  res.json(product);
});

app.get('/api/products/search', authenticate, (req, res) => {
  const searchTerm = req.query.q?.toLowerCase() || '';
  
  const results = products.filter(p => 
    p.activo && (
      p.nombre.toLowerCase().includes(searchTerm) ||
      p.descripcion.toLowerCase().includes(searchTerm) ||
      p.codigo.toLowerCase().includes(searchTerm)
    )
  );
  
  res.json(results);
});

// Validación de pedidos
app.post('/api/orders/validate', authenticate, (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      valid: false,
      errors: ['Items requeridos'],
      validatedItems: []
    });
  }
  
  const validatedItems = [];
  const errors = [];
  
  for (const item of items) {
    const product = products.find(p => p.codigo === item.product_code);
    
    if (!product) {
      errors.push(`Producto ${item.product_code} no encontrado`);
      continue;
    }
    
    if (!product.activo) {
      errors.push(`Producto ${item.product_code} no está activo`);
      continue;
    }
    
    if (item.quantity > product.stock_disponible) {
      errors.push(`Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_disponible}`);
      continue;
    }
    
    validatedItems.push({
      product_code: product.codigo,
      product_name: product.nombre,
      quantity: item.quantity,
      unit_price: product.precio_unitario,
      total: item.quantity * product.precio_unitario
    });
  }
  
  res.json({
    valid: errors.length === 0,
    errors,
    validatedItems
  });
});

// Crear pedidos
app.post('/api/orders', authenticate, (req, res) => {
  const { customer_id, items } = req.body;
  
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) {
    return res.status(400).json({ error: 'Cliente no encontrado' });
  }
  
  // Validar items
  const validatedItems = [];
  let total = 0;
  
  for (const item of items) {
    const product = products.find(p => p.codigo === item.product_code);
    if (!product || item.quantity > product.stock_disponible) {
      return res.status(400).json({ error: `Problema con producto ${item.product_code}` });
    }
    
    validatedItems.push(item);
    total += item.quantity * item.unit_price;
    
    // Reducir stock
    product.stock_disponible -= item.quantity;
  }
  
  const order = {
    order_id: `ORD${String(orderCounter++).padStart(6, '0')}`,
    customer_id,
    customer_name: customer.nombre,
    items: validatedItems,
    total,
    status: 'confirmed',
    created_at: new Date().toISOString()
  };
  
  orders.push(order);
  
  res.json({
    success: true,
    order_id: order.order_id,
    total: order.total
  });
});

// Obtener pedidos
app.get('/api/orders', authenticate, (req, res) => {
  res.json(orders);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏢 Simulador ERP ejecutándose en puerto ${PORT}`);
  console.log(`📊 ${customers.length} clientes, ${products.length} productos cargados`);
});