const mongoose = require('mongoose');

const ClothingItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true }, // 'shirts', 'pants', 'jackets', 'suits'
  brand: { type: String, required: true },
  sizes: [{ type: String }],
  price: { type: String, required: true },
  image: { type: String, required: true },
  fit: { type: String, required: true }, // 'Slim', 'Regular', 'Relaxed'
  material: { type: String, required: true },
  rating: { type: Number, default: 4.5 },
  reviews: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ClothingItem', ClothingItemSchema);
