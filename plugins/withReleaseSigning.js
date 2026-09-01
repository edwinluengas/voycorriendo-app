const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Añade un signingConfig `release` a android/app/build.gradle.
 *
 * Las credenciales NO viven en el repo: se leen de propiedades de Gradle
 * (C:\Users\<tu-usuario>\.gradle\gradle.properties). Si no están definidas,
 * el build de release cae al keystore de debug — igual que el template de Expo —
 * para que `expo run:android` siga funcionando sin configurar nada.
 *
 * Este plugin se re-aplica solo en cada `expo prebuild`, así que sobrevive
 * a `--clean`.
 */

const SIGNING_ANCHOR = `            keyPassword 'android'
        }
    }`;

const SIGNING_REPLACEMENT = `            keyPassword 'android'
        }
        release {
            if (project.hasProperty('VOYCORRIENDO_STORE_FILE')) {
                storeFile file(VOYCORRIENDO_STORE_FILE)
                storePassword VOYCORRIENDO_STORE_PASSWORD
                keyAlias VOYCORRIENDO_KEY_ALIAS
                keyPassword VOYCORRIENDO_KEY_PASSWORD
            }
        }
    }`;

const BUILDTYPE_ANCHOR = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const BUILDTYPE_REPLACEMENT = `            // Firma de release inyectada por plugins/withReleaseSigning.js
            signingConfig project.hasProperty('VOYCORRIENDO_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('VOYCORRIENDO_STORE_FILE')) {
      return cfg; // ya aplicado
    }

    if (!gradle.includes(SIGNING_ANCHOR)) {
      throw new Error(
        '[withReleaseSigning] No encontré el bloque signingConfigs.debug del template de Expo. ' +
          'Revisa android/app/build.gradle — el template cambió y hay que actualizar este plugin.'
      );
    }
    if (!gradle.includes(BUILDTYPE_ANCHOR)) {
      throw new Error(
        '[withReleaseSigning] No encontré el buildType release del template de Expo. ' +
          'Revisa android/app/build.gradle — el template cambió y hay que actualizar este plugin.'
      );
    }

    gradle = gradle.replace(SIGNING_ANCHOR, SIGNING_REPLACEMENT);
    gradle = gradle.replace(BUILDTYPE_ANCHOR, BUILDTYPE_REPLACEMENT);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
