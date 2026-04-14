import axios from 'axios';
import FormData from 'form-data';

const PYTHON_URL = process.env.PYTHON_SIDECAR_URL || 'http://localhost:8000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

if (!INTERNAL_SECRET) {
  console.warn('[warning] INTERNAL_API_SECRET not set. Using fallback for local dev.');
}

const client = axios.create({
  baseURL: PYTHON_URL,
  timeout: 45000, // Pre-loading models might take time on first request
  headers: { 
    'x-internal-token': INTERNAL_SECRET || 'bodyfit_internal_fallback_secret_32' 
  },
});

/**
 * Communicates with the Python FastAPI sidecar to process body measurements.
 * 
 * @param {Buffer} imageBuffer - Raw image data
 * @param {string} mimeType - image/jpeg, image/png, etc.
 * @param {{ type: string, value: number, unit?: string }} calibration - Scaling data
 * @param {'m'|'f'|'n'} gender - Anthropometric biasing
 * @returns {Promise<Object>} The measurement response from the Python engine
 */
export async function callPythonMeasure(imageBuffer, mimeType, calibration, gender = 'n') {
  const form = new FormData();
  form.append('image', imageBuffer, {
    filename: 'upload.jpg',
    contentType: mimeType,
  });

  // Normalize units to cm for the Python service
  const valueCm = calibration.unit === 'inches' || calibration.unit === 'in'
    ? calibration.value * 2.54
    : calibration.value;

  form.append('calibration_type', calibration.type);
  form.append('calibration_value', String(valueCm));
  form.append('gender', gender);

  try {
    const { data } = await client.post('/measure', form, {
      headers: form.getHeaders(),
    });
    return data;
  } catch (err) {
    console.error('[pythonClient] Error during measurement call:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Checks the health status of the Python AI sidecar.
 * @returns {Promise<boolean>}
 */
export async function checkPythonHealth() {
  try {
    const { data } = await client.get('/health', { timeout: 3000 });
    return data.models_loaded === true;
  } catch {
    return false;
  }
}
