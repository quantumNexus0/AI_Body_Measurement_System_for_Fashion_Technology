const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const ClothingItem = require('../models/ClothingItem');

const mockRecommendations = [
  {
    name: 'Premium Cotton Dress Shirt',
    category: 'shirts',
    brand: 'Taylor & Wright',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    price: '$89.99',
    image: 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Regular',
    material: '100% Cotton',
    rating: 4.8,
    reviews: 1247
  },
  {
    name: 'Slim Fit Business Shirt',
    category: 'shirts',
    brand: 'Modern Fit Co.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    price: '$69.99',
    image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Slim',
    material: 'Cotton Blend',
    rating: 4.6,
    reviews: 892
  },
  {
    name: 'Classic Chino Pants',
    category: 'pants',
    brand: 'Urban Essentials',
    sizes: ['28', '30', '32', '34', '36', '38', '40'],
    price: '$79.99',
    image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Regular',
    material: 'Cotton Twill',
    rating: 4.7,
    reviews: 1156
  },
  {
    name: 'Slim Fit Dress Pants',
    category: 'pants',
    brand: 'Executive Style',
    sizes: ['28', '30', '32', '34', '36', '38'],
    price: '$99.99',
    image: 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Slim',
    material: 'Wool Blend',
    rating: 4.5,
    reviews: 743
  },
  {
    name: 'Tailored Blazer',
    category: 'jackets',
    brand: 'Gentleman\'s Choice',
    sizes: ['36R', '38R', '40R', '42R', '44R', '46R'],
    price: '$249.99',
    image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Regular',
    material: 'Wool',
    rating: 4.9,
    reviews: 567
  },
  {
    name: 'Two-Piece Business Suit',
    category: 'suits',
    brand: 'Executive Collection',
    sizes: ['36R', '38R', '40R', '42R', '44R'],
    price: '$399.99',
    image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
    fit: 'Regular',
    material: 'Wool Blend',
    rating: 4.8,
    reviews: 234
  }
];

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bodyfitai';
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected for Seeding');

    const count = await ClothingItem.countDocuments();
    if (count === 0) {
      console.log('Inserting mock clothing items into DB...');
      await ClothingItem.insertMany(mockRecommendations);
      console.log('Items inserted successfully!');
    } else {
      console.log('ClothingItems collection is already populated. Skipping insert.');
    }
  } catch (error) {
    console.error('Seeding error:', error);
  }
};

module.exports = seedDatabase;
