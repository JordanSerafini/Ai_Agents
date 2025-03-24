import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    osxSign: {}
  },
  makers: [
    new MakerSquirrel({
      authors: 'Electron contributors'
    }, ['win32']),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}, ['linux']),
    new MakerRpm({}, ['linux']),
  ],
  plugins: [
    new VitePlugin({
      // `build` peut spécifier plusieurs entrées de build, qui peuvent être
      // le processus principal, les scripts de préchargement, le processus de travail, etc.
      build: [
        {
          // `entry` est un alias pour `build.lib.entry`
          // dans le fichier correspondant de `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main'
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts'
        }
      ]
    })
  ]
};

export default config;