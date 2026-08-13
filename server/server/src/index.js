const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const prisma = require('./config/prisma');
const seedDatabase = require('./config/seed');
const { startCronJobs } = require('./jobs/cronJobs');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const planRoutes = require('./routes/plan.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const paymentRoutes = require('./routes/payment.routes');

const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(cookieParser());

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const validateEnvironmentVariables = () => {
  const requiredVars = {
    STRIPE_SECRET_KEY: 'Stripe secret API key',
    STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret',
    JWT_SECRET: 'JWT signing secret'
  };

  const missing = [];
  for (const [varName, description] of Object.entries(requiredVars)) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(`${varName} (${description})`);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `Missing or empty required environment variables:\n  - ${missing.join('\n  - ')}\n\nPlease set these in your .env file before starting the server.`;
    console.error(errorMessage);
    process.exit(1);
  }
};

const initializeServer = async () => {
  try {
    // Validate environment variables before proceeding
    validateEnvironmentVariables();

    await prisma.$connect();
    console.log('MySQL connected via Prisma');

    await seedDatabase();

    startCronJobs();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

initializeServer();

module.exports = app;
