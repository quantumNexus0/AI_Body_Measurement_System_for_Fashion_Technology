import React, { useState, useEffect } from 'react';
import { Shirt, Package, TrendingUp, Star, ShoppingBag, Filter } from 'lucide-react';

interface Measurements {
  shoulder_width: string;
  chest: string;
  waist: string;
  hips: string;
  arm_length: string;
  leg_length: string;
  inseam: string;
  neck: string;
}

interface ClothingRecommendationsProps {
  measurements: Measurements;
}

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  sizes: string[];
  recommendedSize: string;
  confidence: number;
  price: string;
  image: string;
  fit: 'Slim' | 'Regular' | 'Relaxed';
  material: string;
  rating: number;
  reviews: number;
}

const ClothingRecommendations: React.FC<ClothingRecommendationsProps> = ({ measurements }) => {
  const [recommendations, setRecommendations] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFit, setSelectedFit] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'all', name: 'All Items', icon: Package },
    { id: 'shirts', name: 'Shirts', icon: Shirt },
    { id: 'pants', name: 'Pants', icon: Package },
    { id: 'jackets', name: 'Jackets', icon: Shirt },
    { id: 'suits', name: 'Suits', icon: Package }
  ];

  const fitTypes = [
    { id: 'all', name: 'All Fits' },
    { id: 'slim', name: 'Slim Fit' },
    { id: 'regular', name: 'Regular Fit' },
    { id: 'relaxed', name: 'Relaxed Fit' }
  ];

  useEffect(() => {
    generateRecommendations();
  }, [measurements]);

  const generateRecommendations = () => {
    setLoading(true);
    
    // Parse measurements
    const chest = parseFloat(measurements.chest.split(' ')[0]);
    const waist = parseFloat(measurements.waist.split(' ')[0]);
    const shoulderWidth = parseFloat(measurements.shoulder_width.split(' ')[0]);
    const inseam = parseFloat(measurements.inseam.split(' ')[0]);
    const neck = parseFloat(measurements.neck.split(' ')[0]);

    // Generate size recommendations based on measurements
    const shirtSize = determineShirtSize(chest, shoulderWidth);
    const pantsSize = determinePantsSize(waist, inseam);
    const jacketSize = determineJacketSize(chest, shoulderWidth);
    const suitSize = determineSuitSize(chest, waist, shoulderWidth);

    const mockRecommendations: ClothingItem[] = [
      // Shirts
      {
        id: '1',
        name: 'Premium Cotton Dress Shirt',
        category: 'shirts',
        brand: 'Taylor & Wright',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        recommendedSize: shirtSize,
        confidence: 95,
        price: '$89.99',
        image: 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Regular',
        material: '100% Cotton',
        rating: 4.8,
        reviews: 1247
      },
      {
        id: '2',
        name: 'Slim Fit Business Shirt',
        category: 'shirts',
        brand: 'Modern Fit Co.',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        recommendedSize: adjustSizeForFit(shirtSize, 'slim'),
        confidence: 92,
        price: '$69.99',
        image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Slim',
        material: 'Cotton Blend',
        rating: 4.6,
        reviews: 892
      },
      // Pants
      {
        id: '3',
        name: 'Classic Chino Pants',
        category: 'pants',
        brand: 'Urban Essentials',
        sizes: ['28', '30', '32', '34', '36', '38', '40'],
        recommendedSize: pantsSize,
        confidence: 94,
        price: '$79.99',
        image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Regular',
        material: 'Cotton Twill',
        rating: 4.7,
        reviews: 1156
      },
      {
        id: '4',
        name: 'Slim Fit Dress Pants',
        category: 'pants',
        brand: 'Executive Style',
        sizes: ['28', '30', '32', '34', '36', '38'],
        recommendedSize: adjustPantsSizeForFit(pantsSize, 'slim'),
        confidence: 91,
        price: '$99.99',
        image: 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Slim',
        material: 'Wool Blend',
        rating: 4.5,
        reviews: 743
      },
      // Jackets
      {
        id: '5',
        name: 'Tailored Blazer',
        category: 'jackets',
        brand: 'Gentleman\'s Choice',
        sizes: ['36R', '38R', '40R', '42R', '44R', '46R'],
        recommendedSize: jacketSize,
        confidence: 96,
        price: '$249.99',
        image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Regular',
        material: 'Wool',
        rating: 4.9,
        reviews: 567
      },
      // Suits
      {
        id: '6',
        name: 'Two-Piece Business Suit',
        category: 'suits',
        brand: 'Executive Collection',
        sizes: ['36R', '38R', '40R', '42R', '44R'],
        recommendedSize: suitSize,
        confidence: 93,
        price: '$399.99',
        image: 'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300',
        fit: 'Regular',
        material: 'Wool Blend',
        rating: 4.8,
        reviews: 234
      }
    ];

    setTimeout(() => {
      setRecommendations(mockRecommendations);
      setLoading(false);
    }, 1500);
  };

  const determineShirtSize = (chest: number, shoulder: number): string => {
    if (chest < 90) return 'S';
    if (chest < 100) return 'M';
    if (chest < 110) return 'L';
    if (chest < 120) return 'XL';
    return 'XXL';
  };

  const determinePantsSize = (waist: number, inseam: number): string => {
    const waistSize = Math.round(waist / 2.54); // Convert cm to inches
    return `${waistSize}`;
  };

  const determineJacketSize = (chest: number, shoulder: number): string => {
    const chestInches = Math.round(chest / 2.54);
    return `${chestInches}R`;
  };

  const determineSuitSize = (chest: number, waist: number, shoulder: number): string => {
    const chestInches = Math.round(chest / 2.54);
    return `${chestInches}R`;
  };

  const adjustSizeForFit = (size: string, fit: string): string => {
    if (fit === 'slim') {
      const sizeMap = { 'XS': 'XS', 'S': 'XS', 'M': 'S', 'L': 'M', 'XL': 'L', 'XXL': 'XL' };
      return sizeMap[size] || size;
    }
    return size;
  };

  const adjustPantsSizeForFit = (size: string, fit: string): string => {
    if (fit === 'slim') {
      const waistSize = parseInt(size);
      return `${waistSize - 1}`;
    }
    return size;
  };

  const filteredRecommendations = recommendations.filter(item => {
    const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
    const fitMatch = selectedFit === 'all' || item.fit.toLowerCase() === selectedFit;
    return categoryMatch && fitMatch;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating Recommendations</h3>
          <p className="text-gray-600">Analyzing your measurements to find perfect fits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center space-x-3 mb-6">
        <ShoppingBag className="w-8 h-8 text-teal-600" />
        <h3 className="text-2xl font-bold text-gray-900">Clothing Recommendations</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Fit:</span>
          <select
            value={selectedFit}
            onChange={(e) => setSelectedFit(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {fitTypes.map(fit => (
              <option key={fit.id} value={fit.id}>{fit.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecommendations.map(item => (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative">
              <img 
                src={item.image} 
                alt={item.name}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2 bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                {item.confidence}% Match
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                <span className="text-teal-600 font-bold text-sm">{item.price}</span>
              </div>
              
              <p className="text-gray-600 text-xs mb-2">{item.brand}</p>
              
              <div className="flex items-center space-x-4 mb-3 text-xs text-gray-500">
                <span>{item.material}</span>
                <span>{item.fit} Fit</span>
              </div>
              
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3 h-3 ${i < Math.floor(item.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500">({item.reviews})</span>
              </div>
              
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-teal-800">Recommended Size:</span>
                  <span className="text-lg font-bold text-teal-600">{item.recommendedSize}</span>
                </div>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 text-teal-500 mr-1" />
                  <span className="text-xs text-teal-600">{item.confidence}% confidence</span>
                </div>
              </div>
              
              <button className="w-full bg-teal-500 text-white py-2 rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRecommendations.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No recommendations found for the selected filters.</p>
        </div>
      )}

      {/* Size Guide */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Size Guide Based on Your Measurements</h4>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Shirts & Jackets</h5>
            <ul className="space-y-1 text-gray-600">
              <li>Chest: {measurements.chest}</li>
              <li>Shoulder: {measurements.shoulder_width}</li>
              <li>Neck: {measurements.neck}</li>
              <li>Arm Length: {measurements.arm_length}</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Pants</h5>
            <ul className="space-y-1 text-gray-600">
              <li>Waist: {measurements.waist}</li>
              <li>Hips: {measurements.hips}</li>
              <li>Inseam: {measurements.inseam}</li>
              <li>Leg Length: {measurements.leg_length}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClothingRecommendations;