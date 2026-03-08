export interface TrimSize {
  w: string;
  h: string;
  inner: string;
  hcInner: string;
  outer: string;
  top: string;
  bottom: string;
}

export interface Target {
  label: string;
  ext: string;
  suffix: string;
  innerMargin: string | null;
  openRight: boolean;
}

export interface ConversionOptions {
  title?: string;
  author?: string;
  subtitle?: string;
  format: 'pdf' | 'epub' | 'all';
  trim: string;
  toc: boolean;
  cover?: string;
  fontSize: string;
  openRight: boolean;
  year: string;
  isbn?: string;
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  options: ConversionOptions;
  files: string[];
  coverFile?: string;
  outputs: JobOutput[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface JobOutput {
  filename: string;
  path: string;
  size: number;
  type: 'paperback' | 'hardcover' | 'epub';
}

export interface PandocArgs {
  args: string[];
  output: string;
}

export interface BinaryStatus {
  pandoc: boolean;
  tinytex: boolean;
  ready: boolean;
  message: string;
}
