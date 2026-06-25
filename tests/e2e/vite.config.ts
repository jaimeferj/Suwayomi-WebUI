import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
    root: path.resolve(__dirname),
    publicDir: path.resolve(__dirname, 'public'),
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../../src'),
        },
    },
    server: {
        port: Number(process.env.PORT ?? 4173),
        strictPort: true,
        host: '127.0.0.1',
    },
    build: {
        outDir: path.resolve(__dirname, '../../.tmp-e2e-build'),
        emptyOutDir: true,
    },
    plugins: [react({ plugins: [['@lingui/swc-plugin', {}]] })],
});
