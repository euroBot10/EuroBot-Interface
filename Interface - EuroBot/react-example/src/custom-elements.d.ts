// src/custom-elements.d.ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'frc-gyro': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          'source-key'?: string;
          /** Valor bruto do giroscópio em graus */
          value?: number | string;
          /** casas decimais */
          precision?: string;
        },
        HTMLElement
      >;

      'frc-gauge': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          /** Chave de origem para o gauge */
          'source-key'?: string;
          /** Valor atual a exibir */
          value?: number | string;
          /** Valor mínimo do gauge */
          min?: number | string;
          /** Valor máximo do gauge */
          max?: number | string;
          /** Casas decimais */
          precision?: string;
        },
        HTMLElement
      >;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'frc-gyro': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          'source-key'?: string;
          value?: number | string;
          precision?: string;
        },
        HTMLElement
      >;
      'frc-gauge': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          'source-key'?: string;
          value?: number | string;
          min?: number | string;
          max?: number | string;
          precision?: string;
        },
        HTMLElement
      >;
    }
  }
}

