import React, { useState, useEffect } from 'react';
import { Shirt, Package, TrendingUp, Star, ShoppingBag, Filter, X, Check, Info } from 'lucide-react';

interface Measurements {
  shoulder_width: { value: number; unit: string };
  chest: { value: number; unit: string };
  waist: { value: number; unit: string };
  hips: { value: number; unit: string };
  arm_length: { value: number; unit: string };
  leg_length: { value: number; unit: string };
  inseam: { value: number; unit: string };
  neck: { value: number; unit: string };
}

interface SizeRecommendation {
  primary_size: string;
  alternative_size: string;
  fit_notes: string;
  specific_recommendations: string[];
  size_chart: Record<string, string>;
  confidence: number;
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
  const [aiSize, setAiSize] = useState<SizeRecommendation | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFit, setSelectedFit] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [brand, setBrand] = useState<string>('standard');

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

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      // 1. Get Precision AI Size Recommendation
      const aiResponse = await fetch('http://localhost:3001/api/v2/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          measurements, 
          brand, 
          garment_type: selectedCategory === 'all' ? 'top' : selectedCategory 
        })
      });
      const aiData = await aiResponse.json();
      if (aiData.success) {
        setAiSize(aiData);
      }

      // 2. Get Marketplace items (Mock or real V1 endpoint for now)
      const response = await fetch('http://localhost:3001/api/v1/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurements })
      });
      
      const result = await response.json();
      if (result.success) {
        setRecommendations(result.data);
      }
    } catch (error) {
      console.error('Network error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="relative">
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <ShoppingBag className="w-8 h-8 text-teal-600" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Precision AI Size Recommendations</h3>
          </div>
          {aiSize && (
            <div className="bg-teal-50 px-4 py-2 rounded-2xl border border-teal-100 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-bold text-teal-700">{Math.round(aiSize.confidence * 100)}% Confidence</span>
            </div>
          )}
        </div>

        {/* V2 Precision AI Results Card */}
        {aiSize && (
            <div className="bg-gradient-to-br from-indigo-600 to-teal-600 rounded-3xl p-6 sm:p-8 text-white mb-10 shadow-xl shadow-indigo-100 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-100 mb-2">Recommended Primary Size</p>
                            <h2 className="text-6xl font-black mb-4">{aiSize.primary_size}</h2>
                            <div className="inline-flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md mb-6">
                                <span>Alternative: {aiSize.alternative_size}</span>
                            </div>
                            
                            <div className="space-y-2">
                                <h4 className="font-bold flex items-center space-x-2">
                                    <Check className="w-4 h-4" />
                                    <span>Fit Notes</span>
                                </h4>
                                <p className="text-sm text-indigo-50 leading-relaxed font-medium">
                                    {aiSize.fit_notes}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-center">Specific Style Advice</h4>
                            <ul className="space-y-4">
                                {aiSize.specific_recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start space-x-3">
                                        <div className="bg-white/20 p-1.5 rounded-lg mt-0.5">
                                            <Star className="w-3 h-3 fill-current" />
                                        </div>
                                        <span className="text-sm font-medium">{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            </div>
        )}

        <div className="flex items-center space-x-3 mb-6">
            <Filter className="w-5 h-5 text-gray-400" />
            <h4 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Marketplace Catalog</h4>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {fitTypes.map(fit => (
                <option key={fit.id} value={fit.id}>{fit.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recommendations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredRecommendations.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative">
                <img 
                  src={item.image} 
                  alt={item.name}
                  className="w-full h-40 sm:h-48 object-cover"
                />
                <div className="absolute top-2 right-2 bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  {item.confidence}% Match
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base pr-2">{item.name}</h4>
                  <span className="text-teal-600 font-bold text-sm sm:text-base whitespace-nowrap">{item.price}</span>
                </div>
                
                <p className="text-gray-600 text-xs sm:text-sm mb-2">{item.brand}</p>
                
                <div className="flex items-center space-x-2 sm:space-x-4 mb-3 text-xs text-gray-500">
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
                    <span className="text-xs sm:text-sm font-medium text-teal-800">Recommended Size:</span>
                    <span className="text-base sm:text-lg font-bold text-teal-600">{item.recommendedSize}</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 text-teal-500 mr-1" />
                    <span className="text-xs text-teal-600">{item.confidence}% confidence</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedItem(item)}
                  className="w-full bg-teal-500 text-white py-2 rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRecommendations.length === 0 && (
          <div className="text-center py-6 sm:py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-gray-500 px-4">No recommendations found for the selected filters.</p>
          </div>
        )}

        {/* Size Guide */}
        <div className="mt-6 sm:mt-8 bg-gray-50 rounded-lg p-4 sm:p-6">
          <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-base sm:text-lg">Size Guide Based on Your Measurements</h4>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 text-sm">
            <div>
              <h5 className="font-medium text-gray-800 mb-2">Shirts & Jackets</h5>
              <ul className="space-y-1 text-gray-600">
                <li>Chest: {measurements.chest.value} {measurements.chest.unit}</li>
                <li>Shoulder: {measurements.shoulder_width.value} {measurements.shoulder_width.unit}</li>
                <li>Neck: {measurements.neck.value} {measurements.neck.unit}</li>
                <li>Arm Length: {measurements.arm_length.value} {measurements.arm_length.unit}</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-gray-800 mb-2">Pants</h5>
              <ul className="space-y-1 text-gray-600">
                <li>Waist: {measurements.waist.value} {measurements.waist.unit}</li>
                <li>Hips: {measurements.hips.value} {measurements.hips.unit}</li>
                <li>Inseam: {measurements.inseam.value} {measurements.inseam.unit}</li>
                <li>Leg Length: {measurements.leg_length.value} {measurements.leg_length.unit}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Item Details Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-500 hover:text-gray-800 transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image Section */}
            <div className="w-full sm:w-1/2 h-64 sm:h-auto overflow-hidden">
              <img 
                src={selectedItem.image} 
                alt={selectedItem.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content Section */}
            <div className="w-full sm:w-1/2 p-6 sm:p-8 overflow-y-auto">
              <div className="mb-4">
                <span className="text-xs font-bold text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-1 rounded-md mb-2 inline-block">
                  {selectedItem.category}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedItem.name}</h3>
                <p className="text-gray-500 text-sm font-medium">{selectedItem.brand}</p>
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-2xl font-extrabold text-teal-600 font-mono tracking-tighter">{selectedItem.price}</span>
                <div className="flex items-center space-x-1 bg-yellow-50 px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                  <span className="text-xs font-bold text-yellow-700">{selectedItem.rating}</span>
                </div>
              </div>

              {/* Recommended Fit Section */}
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-5 mb-6 text-white shadow-lg shadow-teal-100">
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center space-x-2">
                     <TrendingUp className="w-4 h-4 text-teal-100" />
                     <span className="text-xs font-bold uppercase tracking-widest text-teal-50">Best Fit For You</span>
                   </div>
                   <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold">
                     {selectedItem.confidence}% Accuracy
                   </div>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-2xl font-black">{selectedItem.recommendedSize}</span>
                   <span className="text-xs opacity-90 font-medium">Based on your {measurements.chest} Chest</span>
                 </div>
              </div>

              {/* Product Info */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start space-x-3">
                   <div className="bg-gray-100 p-2 rounded-lg"><Check className="w-4 h-4 text-gray-600" /></div>
                   <div>
                     <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Material & Quality</h5>
                     <p className="text-xs text-gray-500 leading-relaxed">Premium {selectedItem.material} with ultra-soft finish. Breathable and durable for daily wear.</p>
                   </div>
                </div>
                <div className="flex items-start space-x-3">
                   <div className="bg-gray-100 p-2 rounded-lg"><Info className="w-4 h-4 text-gray-600" /></div>
                   <div>
                     <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Garment Fit</h5>
                     <p className="text-xs text-gray-500 leading-relaxed">{selectedItem.fit} fit designed to complement your {measurements.shoulder_width} shoulders perfectly.</p>
                   </div>
                </div>
              </div>

              <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-lg active:scale-95">
                <ShoppingBag className="w-4 h-4" />
                <span>Shop This Look</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClothingRecommendations;