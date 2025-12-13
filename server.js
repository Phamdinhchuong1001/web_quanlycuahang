const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

// Parse JSON và form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTES API — đặt trước static
app.use('/api/auth', authRoutes);      
app.use('/api', dashboardRoutes);      

// Static files — đặt sau API
app.use(express.static(path.join(__dirname, 'public')));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server chạy tại http://localhost:${port}`);
});
