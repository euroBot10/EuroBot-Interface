// service-setup.js
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstrói __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const svc = new Service({
  name: 'NetworkTablesServer',
  description: 'Servidor para conectar com NetworkTables via pynetworktables2js',
  script: path.join(__dirname, 'server.js'),
  // opcional: logOnAs, workingDirectory, etc.
});

svc.on('install', () => {
  svc.start();
  console.log('Serviço instalado e iniciado.');
});

svc.install();
