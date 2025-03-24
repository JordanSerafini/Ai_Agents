import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Externes les modules natifs de Node 
      // pour éviter des problèmes potentiels lors de la construction
      external: [
        'electron',
        'electron-squirrel-startup'
      ]
    }
  }
});
