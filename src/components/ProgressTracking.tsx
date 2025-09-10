import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, BarChart3, Download, Plus, Trash2 } from 'lucide-react';

interface MeasurementRecord {
  id: string;
  date: string;
  measurements: {
    shoulder_width: number;
    chest: number;
    waist: number;
    hips: number;
    arm_length: number;
    leg_length: number;
    inseam: number;
    neck: number;
  };
  notes?: string;
  weight?: number;
}

interface ProgressTrackingProps {
  currentMeasurements?: any;
  onAddRecord?: (record: MeasurementRecord) => void;
}

const ProgressTracking: React.FC<ProgressTrackingProps> = ({ 
  currentMeasurements, 
  onAddRecord 
}) => {
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('waist');
  const [timeRange, setTimeRange] = useState<string>('6months');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<MeasurementRecord>>({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    weight: undefined
  });

  const metrics = [
    { key: 'waist', label: 'Waist', unit: 'cm', color: 'text-blue-600' },
    { key: 'chest', label: 'Chest', unit: 'cm', color: 'text-green-600' },
    { key: 'hips', label: 'Hips', unit: 'cm', color: 'text-purple-600' },
    { key: 'shoulder_width', label: 'Shoulders', unit: 'cm', color: 'text-orange-600' },
    { key: 'arm_length', label: 'Arms', unit: 'cm', color: 'text-red-600' },
    { key: 'leg_length', label: 'Legs', unit: 'cm', color: 'text-indigo-600' },
    { key: 'inseam', label: 'Inseam', unit: 'cm', color: 'text-pink-600' },
    { key: 'neck', label: 'Neck', unit: 'cm', color: 'text-teal-600' }
  ];

  const timeRanges = [
    { key: '1month', label: '1 Month' },
    { key: '3months', label: '3 Months' },
    { key: '6months', label: '6 Months' },
    { key: '1year', label: '1 Year' },
    { key: 'all', label: 'All Time' }
  ];

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    const mockRecords: MeasurementRecord[] = [
      {
        id: '1',
        date: '2024-01-15',
        measurements: {
          shoulder_width: 46.2,
          chest: 98.5,
          waist: 82.1,
          hips: 102.3,
          arm_length: 66.7,
          leg_length: 96.4,
          inseam: 81.9,
          neck: 39.2
        },
        notes: 'Starting measurements',
        weight: 75
      },
      {
        id: '2',
        date: '2024-02-15',
        measurements: {
          shoulder_width: 46.0,
          chest: 97.2,
          waist: 80.8,
          hips: 101.5,
          arm_length: 66.5,
          leg_length: 96.2,
          inseam: 81.7,
          neck: 38.9
        },
        notes: 'After 1 month of training',
        weight: 74
      },
      {
        id: '3',
        date: '2024-03-15',
        measurements: {
          shoulder_width: 45.8,
          chest: 96.1,
          waist: 79.2,
          hips: 100.8,
          arm_length: 66.3,
          leg_length: 96.0,
          inseam: 81.5,
          neck: 38.5
        },
        notes: 'Continued progress',
        weight: 72.5
      },
      {
        id: '4',
        date: '2024-04-15',
        measurements: {
          shoulder_width: 45.5,
          chest: 95.8,
          waist: 78.1,
          hips: 100.2,
          arm_length: 66.1,
          leg_length: 95.8,
          inseam: 81.3,
          neck: 38.2
        },
        notes: 'Great results!',
        weight: 71
      }
    ];
    setRecords(mockRecords);
  };

  const addRecord = () => {
    if (!currentMeasurements) return;

    const record: MeasurementRecord = {
      id: Date.now().toString(),
      date: newRecord.date || new Date().toISOString().split('T')[0],
      measurements: {
        shoulder_width: parseFloat(currentMeasurements.shoulder_width.split(' ')[0]),
        chest: parseFloat(currentMeasurements.chest.split(' ')[0]),
        waist: parseFloat(currentMeasurements.waist.split(' ')[0]),
        hips: parseFloat(currentMeasurements.hips.split(' ')[0]),
        arm_length: parseFloat(currentMeasurements.arm_length.split(' ')[0]),
        leg_length: parseFloat(currentMeasurements.leg_length.split(' ')[0]),
        inseam: parseFloat(currentMeasurements.inseam.split(' ')[0]),
        neck: parseFloat(currentMeasurements.neck.split(' ')[0])
      },
      notes: newRecord.notes,
      weight: newRecord.weight
    };

    const updatedRecords = [...records, record].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    setRecords(updatedRecords);
    setShowAddForm(false);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      notes: '',
      weight: undefined
    });

    if (onAddRecord) {
      onAddRecord(record);
    }
  };

  const deleteRecord = (id: string) => {
    setRecords(records.filter(record => record.id !== id));
  };

  const getFilteredRecords = () => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case '1month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return records;
    }
    
    return records.filter(record => new Date(record.date) >= cutoffDate);
  };

  const calculateChange = (metric: string) => {
    const filteredRecords = getFilteredRecords();
    if (filteredRecords.length < 2) return null;
    
    const latest = filteredRecords[0].measurements[metric];
    const earliest = filteredRecords[filteredRecords.length - 1].measurements[metric];
    const change = latest - earliest;
    const percentage = ((change / earliest) * 100);
    
    return { absolute: change, percentage };
  };

  const selectedMetricData = metrics.find(m => m.key === selectedMetric);
  const change = calculateChange(selectedMetric);
  const filteredRecords = getFilteredRecords();

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-8 h-8 text-teal-600" />
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Progress Tracking</h3>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm sm:text-base"
        >
          <Plus className="w-4 h-4" />
          <span>Add Record</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {metrics.map(metric => (
              <option key={metric.key} value={metric.key}>{metric.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Time Range:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {timeRanges.map(range => (
              <option key={range.key} value={range.key}>{range.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Summary */}
      {change && selectedMetricData && (
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {selectedMetricData.label} Progress
              </h4>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="text-2xl sm:text-3xl font-bold text-teal-600">
                  {change.absolute > 0 ? '+' : ''}{change.absolute.toFixed(1)} {selectedMetricData.unit}
                </div>
                <div className={`text-base sm:text-lg font-medium ${
                  change.percentage > 0 ? 'text-red-500' : 'text-green-500'
                }`}>
                  {change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-sm text-gray-600">Over {timeRanges.find(r => r.key === timeRange)?.label}</div>
              <div className="text-sm text-gray-500">{filteredRecords.length} measurements</div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Visualization */}
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900 text-base sm:text-lg">
            {selectedMetricData?.label} Trend
          </h4>
        </div>
        
        <div className="relative h-48 sm:h-64">
          {filteredRecords.length > 0 ? (
            <div className="flex items-end justify-between h-full space-x-1 sm:space-x-2">
              {filteredRecords.slice().reverse().map((record, index) => {
                const value = record.measurements[selectedMetric];
                const maxValue = Math.max(...filteredRecords.map(r => r.measurements[selectedMetric]));
                const minValue = Math.min(...filteredRecords.map(r => r.measurements[selectedMetric]));
                const height = ((value - minValue) / (maxValue - minValue)) * (window.innerWidth < 640 ? 150 : 200) + 20;
                
                return (
                  <div key={record.id} className="flex flex-col items-center flex-1">
                    <div className="text-xs text-gray-600 mb-1 sm:mb-2 font-medium">
                      {value.toFixed(1)}
                    </div>
                    <div
                      className="bg-teal-500 rounded-t-lg w-full transition-all duration-300 hover:bg-teal-600"
                      style={{ height: `${height}px` }}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1 sm:mt-2 transform -rotate-45 origin-left">
                      {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm sm:text-base px-4 text-center">
              No data available for the selected time range
            </div>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Date</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Waist</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Chest</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 hidden sm:table-cell">Hips</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 hidden sm:table-cell">Weight</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 hidden md:table-cell">Notes</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 sm:py-3 px-2 sm:px-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                    <span className="whitespace-nowrap">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{record.measurements.waist.toFixed(1)}</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{record.measurements.chest.toFixed(1)}</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">{record.measurements.hips.toFixed(1)}</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">{record.weight ? `${record.weight}` : '-'}</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-xs truncate hidden md:table-cell">{record.notes || '-'}</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Record Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 max-h-screen overflow-y-auto">
            <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Add New Record</h4>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newRecord.weight || ''}
                  onChange={(e) => setNewRecord({ ...newRecord, weight: parseFloat(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  placeholder="Optional"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-base"
                  rows={3}
                  placeholder="Optional notes about this measurement..."
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addRecord}
                disabled={!currentMeasurements}
                className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-center sm:justify-end mt-6">
        <button
          onClick={() => {
            const csvContent = "data:text/csv;charset=utf-8," + 
              "Date,Shoulder Width,Chest,Waist,Hips,Arm Length,Leg Length,Inseam,Neck,Weight,Notes\n" +
              filteredRecords.map(record => 
                `${record.date},${record.measurements.shoulder_width},${record.measurements.chest},${record.measurements.waist},${record.measurements.hips},${record.measurements.arm_length},${record.measurements.leg_length},${record.measurements.inseam},${record.measurements.neck},${record.weight || ''},${record.notes || ''}`
              ).join("\n");
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "body_measurements.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};

export default ProgressTracking;