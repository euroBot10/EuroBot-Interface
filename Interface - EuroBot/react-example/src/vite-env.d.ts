/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
    // Você pode definir os tipos mínimos que você usa.
    // Exemplo simples:
    export function registerSW(options?: {
      immediate?: boolean;
      onRegistered?(registration: ServiceWorkerRegistration): void;
      onRegisterError?(error: unknown): void;
    }): void;
  }
  
