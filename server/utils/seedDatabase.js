const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const ClothingItem = require("../models/ClothingItem");

// ============================================================
// HEIGHT-BASED SIZE CHART UTILITY
// Returns recommended size based on height (cm) and category
// ============================================================
const getSizeByHeight = (heightCm, category, gender = "male") => {
  if (gender === "male") {
    if (
      category === "shirts" ||
      category === "jackets" ||
      category === "suits"
    ) {
      if (heightCm < 160) return "XS";
      if (heightCm < 168) return "S";
      if (heightCm < 176) return "M";
      if (heightCm < 184) return "L";
      if (heightCm < 192) return "XL";
      return "XXL";
    }
    if (category === "pants") {
      // Returns waist-inseam size like "32x30"
      if (heightCm < 160) return "28x28";
      if (heightCm < 168) return "30x30";
      if (heightCm < 176) return "32x30";
      if (heightCm < 184) return "34x32";
      if (heightCm < 192) return "36x32";
      return "38x34";
    }
  }
  if (gender === "female") {
    if (
      category === "dresses" ||
      category === "tops" ||
      category === "jackets"
    ) {
      if (heightCm < 155) return "XS";
      if (heightCm < 163) return "S";
      if (heightCm < 171) return "M";
      if (heightCm < 179) return "L";
      return "XL";
    }
    if (category === "pants" || category === "skirts") {
      if (heightCm < 155) return "2 (XS)";
      if (heightCm < 163) return "4 (S)";
      if (heightCm < 171) return "6 (M)";
      if (heightCm < 179) return "8 (L)";
      return "10 (XL)";
    }
  }
  if (gender === "kids") {
    if (heightCm < 100) return "2T";
    if (heightCm < 110) return "4T";
    if (heightCm < 120) return "6";
    if (heightCm < 130) return "8";
    if (heightCm < 140) return "10";
    if (heightCm < 150) return "12";
    return "14";
  }
  return "M"; // default
};

// ============================================================
// HEIGHT RANGES AND RECOMMENDED SIZES (for all genders)
// Used in the "heightSizing" field of each item
// ============================================================
const buildHeightSizingChart = (gender, category) => {
  const ranges =
    gender === "male"
      ? [
          {
            range: "< 160 cm (Short)",
            recommended: getSizeByHeight(155, category, gender),
          },
          {
            range: "160–167 cm",
            recommended: getSizeByHeight(164, category, gender),
          },
          {
            range: "168–175 cm",
            recommended: getSizeByHeight(172, category, gender),
          },
          {
            range: "176–183 cm",
            recommended: getSizeByHeight(180, category, gender),
          },
          {
            range: "184–191 cm",
            recommended: getSizeByHeight(188, category, gender),
          },
          {
            range: "> 191 cm (Tall)",
            recommended: getSizeByHeight(195, category, gender),
          },
        ]
      : gender === "female"
        ? [
            {
              range: "< 155 cm (Petite)",
              recommended: getSizeByHeight(152, category, gender),
            },
            {
              range: "155–162 cm",
              recommended: getSizeByHeight(159, category, gender),
            },
            {
              range: "163–170 cm",
              recommended: getSizeByHeight(167, category, gender),
            },
            {
              range: "171–178 cm",
              recommended: getSizeByHeight(175, category, gender),
            },
            {
              range: "> 178 cm (Tall)",
              recommended: getSizeByHeight(182, category, gender),
            },
          ]
        : [
            { range: "< 100 cm", recommended: "2T" },
            { range: "100–109 cm", recommended: "4T" },
            { range: "110–119 cm", recommended: "6" },
            { range: "120–129 cm", recommended: "8" },
            { range: "130–139 cm", recommended: "10" },
            { range: "140–149 cm", recommended: "12" },
            { range: "> 149 cm", recommended: "14" },
          ];
  return ranges;
};

// ============================================================
// MOCK DATA — ALL GENDERS + CATEGORIES + HEIGHT CHARTS
// ============================================================
const mockRecommendations = [
  // ──────────────── MEN'S CLOTHING ────────────────

  {
    name: "Premium Cotton Dress Shirt",
    category: "shirts",
    gender: "male",
    brand: "Taylor & Wright",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    price: "$89.99",
    image:
      "https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "100% Cotton",
    rating: 4.8,
    reviews: 1247,
    heightSizing: buildHeightSizingChart("male", "shirts"),
    tags: ["formal", "office", "cotton"],
  },
  {
    name: "Slim Fit Business Shirt",
    category: "shirts",
    gender: "male",
    brand: "Modern Fit Co.",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$69.99",
    image:
      "https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Slim",
    material: "Cotton Blend",
    rating: 4.6,
    reviews: 892,
    heightSizing: buildHeightSizingChart("male", "shirts"),
    tags: ["slim", "business", "modern"],
  },
  {
    name: "Casual Linen Shirt",
    category: "shirts",
    gender: "male",
    brand: "Coastal Living",
    sizes: ["S", "M", "L", "XL", "XXL"],
    price: "$54.99",
    image:
      "https://images.pexels.com/photos/769749/pexels-photo-769749.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Relaxed",
    material: "100% Linen",
    rating: 4.5,
    reviews: 634,
    heightSizing: buildHeightSizingChart("male", "shirts"),
    tags: ["casual", "summer", "linen"],
  },
  {
    name: "Classic Chino Pants",
    category: "pants",
    gender: "male",
    brand: "Urban Essentials",
    sizes: ["28x28", "30x30", "32x30", "34x32", "36x32", "38x34"],
    price: "$79.99",
    image:
      "https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Cotton Twill",
    rating: 4.7,
    reviews: 1156,
    heightSizing: buildHeightSizingChart("male", "pants"),
    tags: ["chino", "casual", "versatile"],
  },
  {
    name: "Slim Fit Dress Pants",
    category: "pants",
    gender: "male",
    brand: "Executive Style",
    sizes: ["28x28", "30x30", "32x30", "34x32", "36x32", "38x34"],
    price: "$99.99",
    image:
      "https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Slim",
    material: "Wool Blend",
    rating: 4.5,
    reviews: 743,
    heightSizing: buildHeightSizingChart("male", "pants"),
    tags: ["formal", "slim", "wool"],
  },
  {
    name: "Jogger Track Pants",
    category: "pants",
    gender: "male",
    brand: "ActiveWear Pro",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    price: "$44.99",
    image:
      "https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Relaxed",
    material: "Polyester Blend",
    rating: 4.4,
    reviews: 521,
    heightSizing: buildHeightSizingChart("male", "pants"),
    tags: ["sport", "casual", "jogger"],
  },
  {
    name: "Tailored Blazer",
    category: "jackets",
    gender: "male",
    brand: "Gentleman's Choice",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    price: "$249.99",
    image:
      "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Wool",
    rating: 4.9,
    reviews: 567,
    heightSizing: buildHeightSizingChart("male", "jackets"),
    tags: ["blazer", "formal", "wool"],
  },
  {
    name: "Puffer Winter Jacket",
    category: "jackets",
    gender: "male",
    brand: "NorthStyle",
    sizes: ["S", "M", "L", "XL", "XXL"],
    price: "$179.99",
    image:
      "https://images.pexels.com/photos/3622608/pexels-photo-3622608.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Nylon + Down Fill",
    rating: 4.7,
    reviews: 889,
    heightSizing: buildHeightSizingChart("male", "jackets"),
    tags: ["winter", "warm", "outdoor"],
  },
  {
    name: "Two-Piece Business Suit",
    category: "suits",
    gender: "male",
    brand: "Executive Collection",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    price: "$399.99",
    image:
      "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Wool Blend",
    rating: 4.8,
    reviews: 234,
    heightSizing: buildHeightSizingChart("male", "suits"),
    tags: ["suit", "formal", "business"],
  },
  {
    name: "Three-Piece Slim Suit",
    category: "suits",
    gender: "male",
    brand: "Prestige Tailors",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$549.99",
    image:
      "https://images.pexels.com/photos/3755706/pexels-photo-3755706.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Slim",
    material: "Premium Wool",
    rating: 4.9,
    reviews: 178,
    heightSizing: buildHeightSizingChart("male", "suits"),
    tags: ["3-piece", "slim", "premium"],
  },

  // ──────────────── WOMEN'S CLOTHING ────────────────

  {
    name: "Floral Wrap Dress",
    category: "dresses",
    gender: "female",
    brand: "BloomStyle",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$74.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Viscose",
    rating: 4.7,
    reviews: 1342,
    heightSizing: buildHeightSizingChart("female", "dresses"),
    tags: ["floral", "casual", "summer"],
  },
  {
    name: "Office Pencil Dress",
    category: "dresses",
    gender: "female",
    brand: "CorporateChic",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$109.99",
    image:
      "https://images.pexels.com/photos/3622614/pexels-photo-3622614.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Fitted",
    material: "Ponte",
    rating: 4.8,
    reviews: 876,
    heightSizing: buildHeightSizingChart("female", "dresses"),
    tags: ["office", "formal", "pencil"],
  },
  {
    name: "Casual Maxi Dress",
    category: "dresses",
    gender: "female",
    brand: "BohoVibes",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    price: "$64.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Relaxed",
    material: "Cotton",
    rating: 4.5,
    reviews: 1102,
    heightSizing: buildHeightSizingChart("female", "dresses"),
    tags: ["maxi", "boho", "casual"],
  },
  {
    name: "Classic White Blouse",
    category: "tops",
    gender: "female",
    brand: "PureElegance",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$49.99",
    image:
      "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Cotton",
    rating: 4.6,
    reviews: 965,
    heightSizing: buildHeightSizingChart("female", "tops"),
    tags: ["blouse", "formal", "classic"],
  },
  {
    name: "Ribbed Crop Top",
    category: "tops",
    gender: "female",
    brand: "TrendSet",
    sizes: ["XS", "S", "M", "L"],
    price: "$29.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Fitted",
    material: "Ribbed Cotton",
    rating: 4.4,
    reviews: 723,
    heightSizing: buildHeightSizingChart("female", "tops"),
    tags: ["crop", "casual", "trendy"],
  },
  {
    name: "High-Waist Skinny Jeans",
    category: "pants",
    gender: "female",
    brand: "DenimLux",
    sizes: ["2 (XS)", "4 (S)", "6 (M)", "8 (L)", "10 (XL)"],
    price: "$89.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Skinny",
    material: "Denim Stretch",
    rating: 4.8,
    reviews: 2341,
    heightSizing: buildHeightSizingChart("female", "pants"),
    tags: ["jeans", "highwaist", "skinny"],
  },
  {
    name: "Pleated Midi Skirt",
    category: "skirts",
    gender: "female",
    brand: "ElegantFlow",
    sizes: ["2 (XS)", "4 (S)", "6 (M)", "8 (L)", "10 (XL)"],
    price: "$59.99",
    image:
      "https://images.pexels.com/photos/3622614/pexels-photo-3622614.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Chiffon",
    rating: 4.7,
    reviews: 645,
    heightSizing: buildHeightSizingChart("female", "skirts"),
    tags: ["skirt", "midi", "elegant"],
  },
  {
    name: "Women's Blazer Jacket",
    category: "jackets",
    gender: "female",
    brand: "PowerDress",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: "$189.99",
    image:
      "https://images.pexels.com/photos/3622608/pexels-photo-3622608.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Fitted",
    material: "Polyester Blend",
    rating: 4.8,
    reviews: 432,
    heightSizing: buildHeightSizingChart("female", "jackets"),
    tags: ["blazer", "formal", "power"],
  },

  // ──────────────── KIDS CLOTHING ────────────────

  {
    name: "Kids Graphic T-Shirt",
    category: "shirts",
    gender: "kids",
    brand: "KiddoStyle",
    sizes: ["2T", "4T", "6", "8", "10", "12", "14"],
    price: "$19.99",
    image:
      "https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "100% Cotton",
    rating: 4.6,
    reviews: 876,
    heightSizing: buildHeightSizingChart("kids", "shirts"),
    tags: ["kids", "graphic", "fun"],
  },
  {
    name: "Kids Jogger Set",
    category: "pants",
    gender: "kids",
    brand: "PlayTime Co.",
    sizes: ["2T", "4T", "6", "8", "10", "12", "14"],
    price: "$34.99",
    image:
      "https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Relaxed",
    material: "Fleece",
    rating: 4.7,
    reviews: 543,
    heightSizing: buildHeightSizingChart("kids", "pants"),
    tags: ["kids", "sport", "comfortable"],
  },
  {
    name: "Girls Floral Dress",
    category: "dresses",
    gender: "kids",
    brand: "LittleBloom",
    sizes: ["2T", "4T", "6", "8", "10", "12"],
    price: "$29.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Cotton",
    rating: 4.8,
    reviews: 312,
    heightSizing: buildHeightSizingChart("kids", "dresses"),
    tags: ["girls", "floral", "cute"],
  },
  {
    name: "Boys School Uniform Shirt",
    category: "shirts",
    gender: "kids",
    brand: "SchoolReady",
    sizes: ["4T", "6", "8", "10", "12", "14"],
    price: "$24.99",
    image:
      "https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Poly-Cotton",
    rating: 4.5,
    reviews: 789,
    heightSizing: buildHeightSizingChart("kids", "shirts"),
    tags: ["school", "uniform", "boys"],
  },

  // ──────────────── UNISEX / PLUS SIZE ────────────────

  {
    name: "Unisex Oversized Hoodie",
    category: "jackets",
    gender: "unisex",
    brand: "StreetWear Co.",
    sizes: ["S", "M", "L", "XL", "XXL", "3XL", "4XL"],
    price: "$59.99",
    image:
      "https://images.pexels.com/photos/3622608/pexels-photo-3622608.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Oversized",
    material: "Fleece Cotton",
    rating: 4.9,
    reviews: 3421,
    heightSizing: [
      { range: "< 160 cm", recommended: "S" },
      { range: "160–170 cm", recommended: "M" },
      { range: "171–180 cm", recommended: "L–XL" },
      { range: "181–190 cm", recommended: "XL–XXL" },
      { range: "> 190 cm", recommended: "XXL–3XL" },
    ],
    tags: ["unisex", "hoodie", "streetwear", "oversized"],
  },
  {
    name: "Plus Size Wrap Dress",
    category: "dresses",
    gender: "female",
    brand: "CurveConfidence",
    sizes: ["1X", "2X", "3X", "4X", "5X"],
    price: "$84.99",
    image:
      "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Jersey",
    rating: 4.8,
    reviews: 1203,
    heightSizing: [
      { range: "< 155 cm (Petite Plus)", recommended: "1X" },
      { range: "155–165 cm", recommended: "2X" },
      { range: "166–175 cm", recommended: "3X" },
      { range: "> 175 cm (Tall Plus)", recommended: "4X–5X" },
    ],
    tags: ["plus-size", "wrap", "curvy"],
  },
  {
    name: "Plus Size Men's Polo Shirt",
    category: "shirts",
    gender: "male",
    brand: "BigStride",
    sizes: ["XL", "XXL", "3XL", "4XL", "5XL"],
    price: "$49.99",
    image:
      "https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=300",
    fit: "Regular",
    material: "Pique Cotton",
    rating: 4.6,
    reviews: 678,
    heightSizing: [
      { range: "170–180 cm", recommended: "XL" },
      { range: "181–188 cm", recommended: "XXL" },
      { range: "189–195 cm", recommended: "3XL" },
      { range: "> 195 cm", recommended: "4XL–5XL" },
    ],
    tags: ["plus-size", "polo", "comfortable"],
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================
const seedDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn("[seed] MONGODB_URI missing. Skipping database seeding.");
    return;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("✅ MongoDB connected for seeding");
    }

    const count = await ClothingItem.countDocuments();

    if (count > 0) {
      console.log(`🗑️ Clearing ${count} existing clothing items from DB...`);
      await ClothingItem.deleteMany({});
    }

    console.log("📦 Inserting mock clothing items into DB...");
    await ClothingItem.insertMany(mockRecommendations);
    console.log(
      `✅ ${mockRecommendations.length} items inserted successfully!`,
    );
    printSummary();
  } catch (error) {
    console.error("❌ Seeding error:", error.message || error);
  }
};

// ============================================================
// HELPER — Print summary of seeded data to console
// ============================================================
const printSummary = () => {
  console.log("\n📊 SEEDED DATA SUMMARY:");
  console.log("─".repeat(50));

  const genderCount = {};
  const categoryCount = {};

  mockRecommendations.forEach((item) => {
    genderCount[item.gender] = (genderCount[item.gender] || 0) + 1;
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
  });

  console.log("\n👤 By Gender:");
  Object.entries(genderCount).forEach(([g, c]) =>
    console.log(`   ${g.padEnd(10)} → ${c} items`),
  );

  console.log("\n👗 By Category:");
  Object.entries(categoryCount).forEach(([cat, c]) =>
    console.log(`   ${cat.padEnd(12)} → ${c} items`),
  );

  console.log("\n📏 Height-Based Size Chart Example (Male Shirts):");
  console.log("─".repeat(50));
  buildHeightSizingChart("male", "shirts").forEach((row) =>
    console.log(`   ${row.range.padEnd(25)} → Size: ${row.recommended}`),
  );

  console.log("\n📏 Height-Based Size Chart Example (Female Dresses):");
  console.log("─".repeat(50));
  buildHeightSizingChart("female", "dresses").forEach((row) =>
    console.log(`   ${row.range.padEnd(30)} → Size: ${row.recommended}`),
  );

  console.log("\n📏 Height-Based Size Chart Example (Kids):");
  console.log("─".repeat(50));
  buildHeightSizingChart("kids", "shirts").forEach((row) =>
    console.log(`   ${row.range.padEnd(20)} → Size: ${row.recommended}`),
  );

  console.log("\n✅ Seeding complete!\n");
};

// ============================================================
// EXPORTED UTILITY — Get recommendation by height at runtime
// Usage: getRecommendedSize(175, "shirts", "male")
// ============================================================
const getRecommendedSize = (heightCm, category, gender = "male") => {
  return getSizeByHeight(heightCm, category, gender);
};

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("✅ Seed script finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed script failed:", err);
      process.exit(1);
    });
}

module.exports = seedDatabase;
module.exports.getRecommendedSize = getRecommendedSize;
module.exports.mockRecommendations = mockRecommendations;
