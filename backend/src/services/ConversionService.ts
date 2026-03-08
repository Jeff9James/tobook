import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { TinyTeXService } from './TinyTeXService';
import { PandocService } from './PandocService';
import { TRIM_SIZES } from '../config/trimSizes';
import { ConversionOptions, Target, PandocArgs, TrimSize } from '../types';

const execFileAsync = promisify(execFile);

export class ConversionService {
  private tinytexService: TinyTeXService;
  private pandocService: PandocService;
  private templateDir: string;
  private filterDir: string;

  constructor() {
    this.tinytexService = TinyTeXService.getInstance();
    this.pandocService = PandocService.getInstance();
    this.templateDir = path.join(__dirname, '..', 'templates');
    this.filterDir = path.join(__dirname, '..', 'filters');
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.tinytexService.initialize(),
      this.pandocService.initialize(),
    ]);
  }

  async convert(
    files: string[],
    options: ConversionOptions,
    outputDir: string,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{ outputs: Array<{ filename: string; path: string; type: string }> }> {
    const trim = TRIM_SIZES[options.trim];
    if (!trim) {
      throw new Error(`Invalid trim size: ${options.trim}`);
    }

    const targets = this.getTargets(options.format, trim);
    const outputs: Array<{ filename: string; path: string; type: string }> = [];

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = Math.round(((i) / targets.length) * 100);
      
      if (onProgress) {
        onProgress(`Generating ${target.label}...`, progress);
      }

      try {
        const result = await this.runPandoc(files, target, trim, options, outputDir);
        outputs.push(result);
      } catch (error) {
        console.error(`Failed to generate ${target.label}:`, error);
        throw new Error(`Failed to generate ${target.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (onProgress) {
      onProgress('Conversion complete', 100);
    }

    return { outputs };
  }

  private getTargets(format: string, trim: TrimSize): Target[] {
    const PAPERBACK: Target = {
      label: 'Paperback PDF',
      ext: 'pdf',
      suffix: '-paperback',
      innerMargin: trim.inner,
      openRight: false,
    };

    const HARDCOVER: Target = {
      label: 'Hardcover PDF',
      ext: 'pdf',
      suffix: '-hardcover',
      innerMargin: trim.hcInner,
      openRight: true,
    };

    const KINDLE: Target = {
      label: 'Kindle EPUB',
      ext: 'epub',
      suffix: '',
      innerMargin: null,
      openRight: false,
    };

    switch (format) {
      case 'all':
        return [PAPERBACK, HARDCOVER, KINDLE];
      case 'pdf':
        return [{ ...PAPERBACK, suffix: '' }];
      case 'epub':
        return [KINDLE];
      default:
        throw new Error(`Invalid format: ${format}`);
    }
  }

  private async runPandoc(
    files: string[],
    target: Target,
    trim: TrimSize,
    options: ConversionOptions,
    outputDir: string
  ): Promise<{ filename: string; path: string; type: string }> {
    const baseName = this.getBaseName(files, options);
    const outputFile = `${baseName}${target.suffix}.${target.ext}`;
    const outputPath = path.join(outputDir, outputFile);

    const { args } = this.buildPandocArgs(files, target, trim, options, outputPath);

    const pandocPath = this.pandocService.getPandocPath();
    const tinytexBin = this.tinytexService.getBinDir();

    const env = {
      ...process.env,
      PATH: `${tinytexBin}:${process.env.PATH}`,
    };

    await execFileAsync(pandocPath, args, {
      env,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    // Verify output was created
    if (!await fs.pathExists(outputPath)) {
      throw new Error('Output file was not created');
    }

    const type = target.suffix.includes('paperback') ? 'paperback' : 
                 target.suffix.includes('hardcover') ? 'hardcover' : 'epub';

    return {
      filename: outputFile,
      path: outputPath,
      type,
    };
  }

  private buildPandocArgs(
    files: string[],
    target: Target,
    trim: TrimSize,
    options: ConversionOptions,
    outputPath: string
  ): PandocArgs {
    const args: string[] = [...files];

    args.push('-o', outputPath);
    args.push('--from', 'markdown');
    args.push('--top-level-division=chapter');
    args.push('-M', 'lang=en');

    if (options.title) {
      args.push('-M', `title=${options.title}`);
    }
    if (options.author) {
      args.push('-M', `author=${options.author}`);
    }
    if (options.subtitle) {
      args.push('-V', `subtitle=${options.subtitle}`);
    }
    if (options.year) {
      args.push('-V', `year=${options.year}`);
    }
    if (options.isbn) {
      args.push('-V', `isbn=${options.isbn}`);
    }

    // Lua filter
    const sceneFilter = path.join(this.filterDir, 'scene-break.lua');
    if (fs.existsSync(sceneFilter)) {
      args.push('--lua-filter', sceneFilter);
    }

    if (target.ext === 'pdf') {
      if (options.toc) {
        args.push('--toc', '--toc-depth=1');
      }
      
      const template = path.join(this.templateDir, 'kdp-print.tex');
      args.push('--template', template);
      args.push('--pdf-engine=xelatex');
      
      args.push('-V', `fontsize=${options.fontSize}`);
      args.push('-V', `paperwidth=${trim.w}`);
      args.push('-V', `paperheight=${trim.h}`);
      
      if (target.innerMargin) {
        args.push('-V', `inner-margin=${target.innerMargin}`);
      }
      args.push('-V', `outer-margin=${trim.outer}`);
      args.push('-V', `top-margin=${trim.top}`);
      args.push('-V', `bottom-margin=${trim.bottom}`);
      
      if (target.openRight || options.openRight) {
        args.push('-V', 'open-right=true');
      }
    }

    if (target.ext === 'epub') {
      args.push('--epub-title-page=false');
      
      const css = path.join(this.templateDir, 'epub.css');
      if (fs.existsSync(css)) {
        args.push('--css', css);
      }
      
      if (options.cover) {
        const coverSrc = path.resolve(options.cover);
        if (fs.existsSync(coverSrc)) {
          const coverExt = path.extname(coverSrc);
          const safeCover = path.join(os.tmpdir(), `cover-${Date.now()}${coverExt}`);
          fs.copyFileSync(coverSrc, safeCover);
          args.push('--epub-cover-image', safeCover);
        }
      }
    }

    return { args, output: outputPath };
  }

  private getBaseName(files: string[], options: ConversionOptions): string {
    if (options.title) {
      return options.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    if (files.length === 1) {
      return path.basename(files[0], '.md');
    }

    return 'book';
  }

  getStatus(): { pandoc: boolean; tinytex: boolean; ready: boolean } {
    const pandocStatus = this.pandocService.getStatus();
    const tinytexStatus = this.tinytexService.getStatus();
    
    return {
      pandoc: pandocStatus.installed,
      tinytex: tinytexStatus.installed,
      ready: pandocStatus.installed && tinytexStatus.installed,
    };
  }
}
