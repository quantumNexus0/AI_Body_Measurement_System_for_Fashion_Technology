import React, { useState } from 'react';
import { Ruler, Smartphone, CreditCard, FileText, X } from 'lucide-react';

interface CalibrationData {
  type: 'height' | 'reference';
  value: number;
  unit: 'cm' | 'inches';
  referenceObject?: string;
}

interface CalibrationModalProps {
  onComplete: (data: CalibrationData) => void;
  onCancel: () => void;
}

const CalibrationModal: React.FC<CalibrationModalProps> = ({ onComplete, onCancel }) => {
  const [calibrationType, setCalibrationType] = useState<'height' | 'reference'>('height');
  const [heightValue, setHeightValue] = useState<string>('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'inches'>('cm');
  const [referenceObject, setReferenceObject] = useState<string>('phone');
  const [referenceValue, setReferenceValue] = useState<string>('');

  const referenceObjects = [
    { id: 'phone', name: 'Smartphone', icon: Smartphone, sizes: { cm: 15.5, inches: 6.1 } },
    { id: 'creditcard', name: 'Credit Card', icon: CreditCard, sizes: { cm: 8.5, inches: 3.35 } },
    { id: 'a4paper', name: 'A4 Paper', icon: FileText, sizes: { cm: 29.7, inches: 11.7 } },
  ];

  const handleSubmit = () => {
    if (calibrationType === 'height') {
      const value = parseFloat(heightValue) || 170; // Default height if invalid
      onComplete({
        type: 'height',
        value,
        unit: heightUnit
      });
    } else {
      const customValue = parseFloat(referenceValue);
      const selectedRef = referenceObjects.find(obj => obj.id === referenceObject);
      
      if (customValue > 0) {
        onComplete({
          type: 'reference',
          value: customValue,
          unit: heightUnit,
          referenceObject
        });
      } else if (selectedRef) {
        onComplete({
          type: 'reference',
          value: selectedRef.sizes[heightUnit],
          unit: heightUnit,
          referenceObject
        });
      } else {
        // Default reference if nothing selected
        onComplete({
          type: 'reference',
          value: 15.5,
          unit: 'cm',
          referenceObject: 'phone'
        });
      }
    }
  };

  const selectedRef = referenceObjects.find(obj => obj.id === referenceObject);
  const isValid = true; // Always valid

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Calibration Required</h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm sm:text-base text-gray-600 mb-6">
          To get accurate measurements, we need a reference scale. Choose one of the options below:
        </p>

        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={() => setCalibrationType('height')}
              className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                calibrationType === 'height'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Ruler className="w-5 h-5 text-teal-600" />
                <span className="font-medium text-sm sm:text-base">Your Height</span>
              </div>
            </button>
            <button
              onClick={() => setCalibrationType('reference')}
              className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                calibrationType === 'reference'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-teal-600" />
                <span className="font-medium text-sm sm:text-base">Reference Object</span>
              </div>
            </button>
          </div>

          {calibrationType === 'height' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your height:
                </label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    type="number"
                    value={heightValue}
                    onChange={(e) => setHeightValue(e.target.value)}
                    placeholder="170"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  />
                  <select
                    value={heightUnit}
                    onChange={(e) => setHeightUnit(e.target.value as 'cm' | 'inches')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  >
                    <option value="cm">cm</option>
                    <option value="inches">inches</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference object in the photo:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {referenceObjects.map((obj) => {
                    const Icon = obj.icon;
                    return (
                      <button
                        key={obj.id}
                        onClick={() => setReferenceObject(obj.id)}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          referenceObject === obj.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-1 text-teal-600" />
                        <div className="text-xs font-medium">{obj.name}</div>
                        <div className="text-xs text-gray-500">
                          {obj.sizes.cm}cm
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or enter custom size (optional):
                </label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    type="number"
                    value={referenceValue}
                    onChange={(e) => setReferenceValue(e.target.value)}
                    placeholder="Custom size"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  />
                  <select
                    value={heightUnit}
                    onChange={(e) => setHeightUnit(e.target.value as 'cm' | 'inches')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  >
                    <option value="cm">cm</option>
                    <option value="inches">inches</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalibrationModal;