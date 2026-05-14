require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const comp    = require('compression');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(comp());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api',           require('./routes/misc'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route negăsită' }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  PharmaNET Pro Backend  port: ${PORT}    ║`);
  console.log('╚══════════════════════════════════════╝\n');
  console.log(`  → http://localhost:${PORT}/api/health\n`);
});
module.exports = app;
