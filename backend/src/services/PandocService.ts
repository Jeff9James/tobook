import * as path from 'path';
import * as fs from 'fs-extra';
import * as tar from 'tar';
import fetch from 'node-fetch';
import { execFileSync } from 'child_process';

export class PandocService {
  private static instance: PandocService;
  private readonly installDir: string;
  private readonly pandocPath: string;
  private isInstalled: boolean = false;
  private isInstalling: boolean = false;
  private installError: string | null = null;

  private constructor() {
    this.installDir = process.env.PANDOC_DIR || path.join(process.cwd(), '.pandoc');
    this.pandocPath = path.join(this.installDir, 'bin', 'pandoc');
  }

  static getInstance(): PandocService {
    if (!PandocService.instance) {
      PandocService.instance = new PandocService();
    }
    return PandocService.instance;
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
      // Check if pandoc is already available system-wide
      if (await this.checkSystemPandoc()) {
        console.log('Using system Pandoc');
        this.isInstalled = true;
        this.isInstalling = false;
        return;
      }

      // Check if we already have it installed locally
      if (await this.checkLocalInstallation()) {
        console.log('Using local Pandoc');
        this.isInstalled = true;
        this.isInstalling = false;
        return;
      }

      console.log('Installing Pandoc...');
      await this.downloadAndInstall();
      
      this.isInstalled = true;
      console.log('Pandoc installation complete');
    } catch (error) {
      this.installError = error instanceof Error ? error.message : 'Unknown error';
      console.error('Pandoc installation failed:', this.installError);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  private async checkSystemPandoc(): Promise<boolean> {
    try {
      execFileSync('which', ['pandoc'], { stdio: 'pipe' });
      execFileSync('pandoc', ['--version'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkLocalInstallation(): Promise<boolean> {
    try {
      if (!await fs.pathExists(this.pandocPath)) {
        return false;
      }
      execFileSync(this.pandocPath, ['--version'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async downloadAndInstall(): Promise<void> {
    const pandocVersion = '3.9';
    const pandocUrl = `https://github.com/jgm/pandoc/releases/download/${pandocVersion}/pandoc-${pandocVersion}-linux-amd64.tar.gz`;
    const downloadPath = path.join(this.installDir, 'pandoc.tar.gz');

    // Ensure install directory exists
    await fs.ensureDir(this.installDir);

    // Download Pandoc
    console.log(`Downloading Pandoc from ${pandocUrl}...`);
    const response = await fetch(pandocUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download Pandoc: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    await fs.writeFile(downloadPath, buffer);
    console.log('Download complete, extracting...');

    // Extract Pandoc
    await tar.extract({
      file: downloadPath,
      cwd: this.installDir,
      strip: 1,
    });

    // Clean up
    await fs.remove(downloadPath);

    // Make executable
    await fs.chmod(this.pandocPath, 0o755);
  }

  getPandocPath(): string {
    // If system pandoc is available, use it
    try {
      execFileSync('which', ['pandoc'], { stdio: 'pipe' });
      return 'pandoc';
    } catch {
      return this.pandocPath;
    }
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
