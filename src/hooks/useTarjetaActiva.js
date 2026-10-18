import { useState, useEffect } from 'react';
import { pedidosAPI } from '../api/client';
import { METODOS_PAGO_ACTIVOS_DEFAULT } from '../config/businessRules';

// ¿Se acepta tarjeta hoy? El backend manda la verdad en /api/config-publica
// (se prende/apaga sin compilar un APK nuevo). Para textos informativos —
// Soporte, términos — que no deben quedarse diciendo "solo efectivo" cuando
// la tarjeta ya está activa.
export default function useTarjetaActiva() {
  const [activos, setActivos] = useState(METODOS_PAGO_ACTIVOS_DEFAULT);
  useEffect(() => {
    let vivo = true;
    pedidosAPI.configPublica()
      .then(({ data }) => {
        const lista = data?.data?.metodos_pago_activos;
        if (vivo && Array.isArray(lista) && lista.length) setActivos(lista);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return activos.includes('tarjeta');
}
