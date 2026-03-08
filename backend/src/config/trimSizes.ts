import { TrimSize } from '../types';

export const TRIM_SIZES: Record<string, TrimSize> = {
  '5x8': {
    w: '5in',
    h: '8in',
    inner: '0.7in',
    hcInner: '0.85in',
    outer: '0.5in',
    top: '0.7in',
    bottom: '0.7in',
  },
  '5.25x8': {
    w: '5.25in',
    h: '8in',
    inner: '0.75in',
    hcInner: '0.9in',
    outer: '0.5in',
    top: '0.7in',
    bottom: '0.7in',
  },
  '5.5x8.5': {
    w: '5.5in',
    h: '8.5in',
    inner: '0.8in',
    hcInner: '0.95in',
    outer: '0.55in',
    top: '0.75in',
    bottom: '0.75in',
  },
  '6x9': {
    w: '6in',
    h: '9in',
    inner: '0.85in',
    hcInner: '1.0in',
    outer: '0.6in',
    top: '0.8in',
    bottom: '0.8in',
  },
};

export const VALID_FORMATS = ['pdf', 'epub', 'all'];
export const VALID_FONT_SIZES = ['10pt', '11pt', '12pt'];
