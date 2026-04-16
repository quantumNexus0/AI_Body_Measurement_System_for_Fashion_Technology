from typing import List, Dict, Optional
import numpy as np

class SizeRecommendationEngine:
    """
    BodyFit AI's size recommendation engine.
    Implements business rules for sizing, brand adjustments, and garment types.
    """

    # Standard size charts (Centimeters)
    # format: {size: {measurement_type: [min, max]}}
    SIZE_CHARTS = {
        "standard_top": {
            "XS": {"chest": [81, 86], "waist": [66, 71]},
            "S":  {"chest": [86, 96], "waist": [71, 81]},
            "M":  {"chest": [96, 106], "waist": [81, 91]},
            "L":  {"chest": [106, 116], "waist": [91, 101]},
            "XL": {"chest": [116, 126], "waist": [101, 111]},
            "XXL":{"chest": [126, 136], "waist": [111, 121]},
        },
        "standard_bottom": {
            "XS": {"waist": [66, 71], "hips": [81, 86]},
            "S":  {"waist": [71, 81], "hips": [86, 96]},
            "M":  {"waist": [81, 91], "hips": [96, 106]},
            "L":  {"waist": [91, 101], "hips": [106, 116]},
            "XL": {"waist": [101, 111], "hips": [116, 126]},
            "XXL":{"waist": [111, 121], "hips": [126, 136]},
        }
    }

    INDIAN_BRANDS = ["FabIndia", "Biba", "W", "Allen Solly", "Louis Philippe", "Lifestyle", "Max", "Westside"]

    def __init__(self):
        pass

    def recommend(self, measurements: Dict[str, float], brand: str = "standard", garment_type: str = "top") -> Dict:
        """
        Recommend primary and alternative sizes based on measurements.
        """
        is_indian = any(b.lower() in brand.lower() for b in self.INDIAN_BRANDS)
        
        # Select base chart
        chart_key = "standard_bottom" if garment_type in ["bottom", "jeans"] else "standard_top"
        chart = self.SIZE_CHARTS[chart_key]

        # Prioritization
        primary_measure = "chest" if garment_type in ["top", "dress", "suit"] else "waist"
        secondary_measure = "waist" if garment_type in ["top", "dress", "suit"] else "hips"

        val_primary = measurements.get(primary_measure, 0)
        val_secondary = measurements.get(secondary_measure, 0)

        # Find matching size
        primary_size = None
        alternative_size = None
        fit_notes = []
        recommendations = []

        sizes = list(chart.keys())
        
        # 1. Basic primary size matching
        for i, (size, ranges) in enumerate(chart.items()):
            low, high = ranges[primary_measure]
            if low <= val_primary < high:
                primary_size = size
                
                # Check for "between sizes"
                margin = (high - low) * 0.15 # 15% margin for "between"
                if val_primary > (high - margin) and i < len(sizes) - 1:
                    alternative_size = sizes[i+1]
                    fit_notes.append(f"Measurements for {primary_measure} fall between {primary_size} and {alternative_size}.")
                elif val_primary < (low + margin) and i > 0:
                    alternative_size = sizes[i-1]
                    fit_notes.append(f"Measurements for {primary_measure} fall between {alternative_size} and {primary_size}.")
                break
        
        if not primary_size:
            primary_size = "XXL" if val_primary >= 136 else "XS"
            fit_notes.append("Measurements are outside standard size charts.")

        # 2. Secondary measure check (Prioritization rule)
        sec_ranges = chart[primary_size].get(secondary_measure)
        if sec_ranges:
            s_low, s_high = sec_ranges
            if val_secondary > s_high:
                fit_notes.append(f"Higher {secondary_measure} suggested. Consider {primary_size} in regular or relaxed fit.")
                recommendations.append(f"Look for '{garment_type}' with relaxed {secondary_measure} cut.")
            elif val_secondary < s_low:
                fit_notes.append(f"Narrower {secondary_measure} detected. Slim fit recommended.")

        # 3. Indian brand adjustment
        if is_indian:
            old_primary = primary_size
            idx = sizes.index(primary_size)
            if idx < len(sizes) - 1:
                primary_size = sizes[idx + 1]
                fit_notes.append(f"Indian brand detected. Sizing adjusted +1 from Western standard ({old_primary} → {primary_size}).")
            else:
                fit_notes.append("Indian brand detected, but already at maximum size.")

        # 4. Fit notes and specific recommendations
        if garment_type == "jeans":
            waist_in = round(measurements.get("waist", 0) / 2.54)
            inseam_in = round(measurements.get("inseam", 0) / 2.54)
            recommendations.append(f"Consider {waist_in}/{inseam_in} jeans for accurate fit.")
        
        if not alternative_size:
            idx = sizes.index(primary_size)
            if idx < len(sizes) - 1: alternative_size = sizes[idx+1]
            elif idx > 0: alternative_size = sizes[idx-1]
            else: alternative_size = primary_size

        if not recommendations:
            recommendations.append(f"{primary_size} in most {brand.capitalize() if brand != 'standard' else 'Western'} brands.")

        # Formatting size chart for output
        formatted_chart = {s: f"{primary_measure}: {r[primary_measure][0]}-{r[primary_measure][1]} cm" for s, r in chart.items()}

        return {
            "primary_size": primary_size,
            "alternative_size": alternative_size,
            "fit_notes": ". ".join(fit_notes) if fit_notes else "Standard fit recommended.",
            "specific_recommendations": recommendations,
            "size_chart": formatted_chart,
            "confidence": 0.85 # Base logic confidence
        }
