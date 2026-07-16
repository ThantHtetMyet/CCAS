//const BACKEND_API_OVERRIDE_IP = 'localhost';
const BACKEND_API_OVERRIDE_IP = '192.3.70.3';
export function getBackendHost() {
  return BACKEND_API_OVERRIDE_IP || window.location.hostname;
}

export function getBackendBaseUrl() {
  return `http://${getBackendHost()}:5000`;
}

export const backendApiBaseUrl = getBackendBaseUrl();
