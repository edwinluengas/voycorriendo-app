/**
 * Elegir una imagen (cámara o galería) con errores VISIBLES.
 *
 * Por qué existe: cada pantalla llamaba a expo-image-picker por su cuenta y
 * ninguna llamada estaba envuelta en try/catch, así que cualquier error del
 * selector se perdía en silencio — el usuario tocaba "Elegir de galería",
 * no pasaba nada y no había forma de saber por qué.
 *
 * GALERÍA SIN PERMISOS: `launchImageLibraryAsync` abre el **selector de fotos
 * del sistema** de Android (ActivityResultContracts.PickVisualMedia). Ese
 * selector corre fuera de la app y solo nos devuelve lo que el usuario eligió,
 * así que NO requiere READ_MEDIA_IMAGES / READ_MEDIA_VIDEO ni
 * READ_EXTERNAL_STORAGE. Pedir esos permisos además viola la política de
 * Google Play para apps con target API 33+ (bloqueo de revisión en el
 * versionCode 3). No vuelvas a meter un requestMediaLibraryPermissionsAsync()
 * aquí: en Android 13+ no pide nada y en versiones viejas solo reintroduce el
 * permiso de almacenamiento que Play rechaza.
 *
 * La cámara SÍ necesita permiso (CAMERA) porque ahí sí grabamos nosotros.
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

const OPCIONES_BASE = { base64: true, quality: 0.6, allowsEditing: false };

// Cuando el permiso está denegado "para siempre", pedirlo otra vez no hace
// nada: hay que mandarlo a los ajustes del sistema.
const avisarPermiso = (queEs) => {
  Alert.alert(
    'Permiso necesario',
    `VoyCorriendo necesita acceso a ${queEs} para tomar la foto. `
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
    // Sin permisos: el selector de fotos del sistema los hace innecesarios.
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
