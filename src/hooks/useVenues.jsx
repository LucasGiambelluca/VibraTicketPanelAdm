import { useState, useEffect, useCallback } from 'react';
import { venuesApi } from '../services/apiService';
import { message } from 'antd';

export function useVenues(initialParams = {}) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadVenues = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const mergedParams = { ...initialParams, ...params };
      const response = await venuesApi.getVenues(mergedParams);

      // Helper para extraer arrays (reutilizado)
      const extractArray = (res, key) => {
        const payload = res.data || res;
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload[key])) return payload[key];
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.rows)) return payload.rows;
        if (payload.data && typeof payload.data === 'object') {
          if (Array.isArray(payload.data[key])) return payload.data[key];
          if (Array.isArray(payload.data.rows)) return payload.data.rows;
        }
        return [];
      };

      const venuesList = extractArray(response, 'venues');
      setVenues(venuesList);

    } catch (err) {
      console.error('Error loading venues:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error al cargar venues';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  const deleteVenue = async (venueId) => {
    try {
      await venuesApi.deleteVenue(venueId);
      message.success('Venue eliminado');
      loadVenues();
    } catch (err) {
      message.error('Error al eliminar venue');
    }
  };

  return { 
    venues, 
    loading, 
    error, 
    setVenues, 
    refetch: loadVenues,
    deleteVenue,
    loadVenues 
  };
}
