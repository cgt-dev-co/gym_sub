const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    const existingPlans = await prisma.plan.count();
    if (existingPlans > 0) {
      console.log('Database already seeded. Skipping...');
      return;
    }

    await prisma.plan.createMany({
      data: [
        {
          name: 'Basic Plan',
          duration: 'MONTHLY',
          price: 29.99,
          currency: 'USD',
          features: ['Access to gym equipment', 'Locker room access', 'Free Wi-Fi', 'Standard hours (6 AM - 10 PM)'],
          isActive: true
        },
        {
          name: 'Standard Plan',
          duration: 'QUARTERLY',
          price: 79.99,
          currency: 'USD',
          features: ['All Basic Plan features', 'Group fitness classes', '1 personal training session per month', '24/7 gym access', 'Towel service'],
          isActive: true
        },
        {
          name: 'Premium Plan',
          duration: 'YEARLY',
          price: 299.99,
          currency: 'USD',
          features: ['All Standard Plan features', 'Unlimited personal training', 'Nutrition consultation', 'Spa and sauna access', 'Guest passes (5 per month)', 'Priority class booking', 'Free parking'],
          isActive: true
        }
      ]
    });

    console.log('Plans seeded successfully');

    const hashedPassword = await bcrypt.hash('User123!', 10);

    await prisma.user.create({
      data: {
        email: 'user@gym.com',
        password: hashedPassword,
        name: 'Test User',
        phone: '+1987654321',
        address: '456 User Avenue, City',
        role: 'USER'
      }
    });

    console.log('Sample user seeded successfully');
    console.log('Database seeding completed!');
    console.log('\nSample credentials:');
    console.log('Email: user@gym.com');
    console.log('Password: User123!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

module.exports = seedDatabase;
