import { useState, useEffect, useCallback } from 'react';
import { eventsApi } from '../services/apiService';
import { message } from 'antd';

export function useEvents(initialParams = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const loadEvents = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const mergedParams = { ...initialParams, ...params };
      
      const response = await eventsApi.getEvents(mergedParams);

      // Helper para extraer arrays de diferentes estructuras de respuesta
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

      const eventsList = extractArray(response, 'events');
      
      if (!Array.isArray(eventsList)) {
        console.error('CRITICAL: eventsList is not an array:', eventsList);
        throw new Error('Error de formato en respuesta del servidor');
      }

      setEvents(eventsList);
      
      // Intentar extraer paginación
      const payload = response.data || response;
      if (payload.pagination) {
        setPagination(payload.pagination);
      } else if (payload.data?.pagination) {
        setPagination(payload.data.pagination);
      }

    } catch (err) {
      console.error('Error loading events:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error al cargar eventos';
      setError(errorMsg);
      // message.error(errorMsg); // Opcional: evitar spam si ya se muestra en UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const deleteEvent = async (eventId) => {
    try {
      await eventsApi.deleteEvent(eventId);
      message.success('Evento eliminado');
      loadEvents();
    } catch (err) {
      message.error('Error al eliminar evento');
    }
  };

  return { 
    events, 
    loading, 
    error, 
    setEvents, 
    refetch: loadEvents,
    deleteEvent,
    pagination
  };
}
