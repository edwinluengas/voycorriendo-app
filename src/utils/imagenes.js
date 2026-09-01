/**
 * Elegir una imagen (cámara o galería) con permisos y errores VISIBLES.
 *
 * Por qué existe: cada pantalla llamaba a expo-image-picker por su cuenta y
 * solo una pedía el permiso de galería. En Android, abrir la galería sin ese
 * permiso no truena con un mensaje: simplemente no pasa nada. El usuario
 * toca "Elegir de galería", no se abre nada y no hay forma de saber por qué
 * — que es exactamente lo que se reportó al dar de alta un repartidor.
 *
 * Además, ninguna llamada estaba envuelta en try/catch, así que cualquier
 * error del selector se perdía en silencio.
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

const OPCIONES_BASE = { base64: true, quality: 0.6, allowsEditing: false };

// Cuando el permiso está denegado "para siempre", pedirlo otra vez no hace
// nada: hay que mandarlo a los ajustes del sistema.
const avisarPermiso = (queEs) => {
  Alert.alert(
    'Permiso necesario',
    `VoyCorriendo necesita acceso a ${queEs} para subir tus documentos. `
    + 'Actívalo en los ajustes del teléfono.',
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir ajustes', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
};

/**
 * Abre la cámara. Devuelve el asset o null.
 * @param {object} extra opciones adicionales de expo-image-picker
 */
export const tomarFoto = async (extra = {}) => {
  try {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) { avisarPermiso('la cámara'); return null; }

    const r = await ImagePicker.launchCameraAsync({ ...OPCIONES_BASE, ...extra });
    if (r.canceled || !r.assets?.length) return null;
    return r.assets[0];
  } catch (e) {
    Alert.alert('No se pudo abrir la cámara', e?.message || 'Intenta de nuevo.');
    return null;
  }
};

/**
 * Abre la galería. Devuelve el asset o null.
 */
export const elegirDeGaleria = async (extra = {}) => {
  try {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) { avisarPermiso('tus fotos'); return null; }

    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      ...OPCIONES_BASE,
      ...extra,
    });
    if (r.canceled || !r.assets?.length) return null;
    return r.assets[0];
  } catch (e) {
    Alert.alert('No se pudo abrir la galería', e?.message || 'Intenta de nuevo.');
    return null;
  }
};

/**
 * Pregunta cámara o galería y devuelve el asset elegido (o null).
 * Se resuelve como promesa para poder hacer `const foto = await pedirImagen()`
 * en vez de anidar callbacks dentro del Alert.
 */
export const pedirImagen = ({ titulo = 'Seleccionar imagen', extra = {} } = {}) =>
  new Promise((resolve) => {
    Alert.alert(titulo, '¿De dónde quieres subir la foto?', [
      { text: '📷 Tomar foto',       onPress: async () => resolve(await tomarFoto(extra)) },
      { text: '🖼️ Elegir de galería', onPress: async () => resolve(await elegirDeGaleria(extra)) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
