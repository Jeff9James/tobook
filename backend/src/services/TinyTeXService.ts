import * as path from 'path';
import * as fs from 'fs-extra';
import * as tar from 'tar';
import fetch from 'node-fetch';
import { execFileSync, execSync } from 'child_process';

export class TinyTeXService {
  private static instance: TinyTeXService;
  private readonly tinytexDir: string;
  private readonly installDir: string;
  private isInstalled: boolean = false;
  private isInstalling: boolean = false;
  private installError: string | null = null;

  private constructor() {
    this.installDir = process.env.TINYTEX_DIR || path.join(process.cwd(), '.tinytex');
    this.tinytexDir = path.join(this.installDir, 'bin', 'x86_64-linux');
  }

  static getInstance(): TinyTeXService {
    if (!TinyTeXService.instance) {
      TinyTeXService.instance = new TinyTeXService();
    }
    return TinyTeXService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInstalled) {
      return;
    }

    if (this.isInstalling) {
      // Wait for installation to complete
      while (this.isInstalling) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (this.installError) {
        throw new Error(this.installError);
      }
      return;
    }

    this.isInstalling = true;

    try {
      // Check if already installed
      if (await this.checkInstallation()) {
        console.log('TinyTeX already installed');
        this.isInstalled = true;
        this.isInstalling = false;
        return;
      }

      console.log('Installing TinyTeX...');
      await this.downloadAndInstall();
      
      console.log('Installing required LaTeX packages...');
      await this.installPackages();
      
      this.isInstalled = true;
      console.log('TinyTeX installation complete');
    } catch (error) {
      this.installError = error instanceof Error ? error.message : 'Unknown error';
      console.error('TinyTeX installation failed:', this.installError);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  private async checkInstallation(): Promise<boolean> {
    try {
      const xelatexPath = path.join(this.tinytexDir, 'xelatex');
      if (!await fs.pathExists(xelatexPath)) {
        return false;
      }

      // Test xelatex
      execFileSync(xelatexPath, ['--version'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async downloadAndInstall(): Promise<void> {
    const tinytexUrl = 'https://github.com/yihui/tinytex-releases/releases/download/v2026.03.02/TinyTeX-1-v2026.03.02.tar.gz';
    const downloadPath = path.join(this.installDir, 'tinytex.tar.gz');

    // Ensure install directory exists
    await fs.ensureDir(this.installDir);

    // Download TinyTeX
    console.log(`Downloading TinyTeX from ${tinytexUrl}...`);
    const response = await fetch(tinytexUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download TinyTeX: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    await fs.writeFile(downloadPath, buffer);
    console.log('Download complete, extracting...');

    // Extract TinyTeX
    await tar.extract({
      file: downloadPath,
      cwd: this.installDir,
      strip: 1,
    });

    // Clean up
    await fs.remove(downloadPath);
  }

  private async installPackages(): Promise<void> {
    const packages = [
      'geometry',
      'fancyhdr',
      'titlesec',
      'setspace',
      'microtype',
      'fontspec',
      'xetex',
      'ebgaramond',
      'hyperref',
      'graphicx',
    ];

    const tlmgrPath = path.join(this.tinytexDir, 'tlmgr');

    // Update tlmgr first
    try {
      execFileSync(tlmgrPath, ['update', '--self', '--all'], {
        stdio: 'pipe',
        env: { ...process.env, PATH: `${this.tinytexDir}:${process.env.PATH}` },
      });
    } catch (error) {
      console.warn('tlmgr update failed, continuing anyway:', error);
    }

    // Install packages
    for (const pkg of packages) {
      try {
        console.log(`Installing ${pkg}...`);
        execFileSync(tlmgrPath, ['install', pkg], {
          stdio: 'pipe',
          env: { ...process.env, PATH: `${this.tinytexDir}:${process.env.PATH}` },
        });
      } catch (error) {
        console.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  getXelatexPath(): string {
    return path.join(this.tinytexDir, 'xelatex');
  }

  getTlmgrPath(): string {
    return path.join(this.tinytexDir, 'tlmgr');
  }

  getBinDir(): string {
    return this.tinytexDir;
  }

  isReady(): boolean {
    return this.isInstalled;
  }

  getStatus(): { installed: boolean; installing: boolean; error: string | null } {
    return {
      installed: this.isInstalled,
      installing: this.isInstalling,
      error: this.installError,
    };
  }
}
