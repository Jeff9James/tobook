import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

interface JobOutput {
  filename: string;
  size: number;
  type: string;
}

interface Config {
  formats: string[];
  trimSizes: string[];
  fontSizes: string[];
  trimDetails: Record<string, {
    w: string;
    h: string;
    inner: string;
    hcInner: string;
    outer: string;
    top: string;
    bottom: string;
  }>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    subtitle: '',
    format: 'all',
    trim: '5x8',
    toc: false,
    fontSize: '11pt',
    openRight: false,
    year: new Date().getFullYear().toString(),
    isbn: '',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobOutputs, setJobOutputs] = useState<JobOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    // Check server health
    checkHealth();
    // Load config
    loadConfig();
  }, []);

  useEffect(() => {
    if (jobId && jobStatus?.status === 'processing') {
      const interval = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId, jobStatus?.status]);

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/health`);
      setServerReady(response.data.ready);
    } catch {
      setServerReady(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/config`);
      setConfig(response.data);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/status/${id}`);
      setJobStatus(response.data);
      
      if (response.data.status === 'completed') {
        const jobResponse = await axios.get(`${API_URL}/api/jobs/${id}`);
        setJobOutputs(jobResponse.data.outputs);
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const onCoverDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCoverImage(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
    },
  });

  const { getRootProps: getCoverRootProps, getInputProps: getCoverInputProps } = useDropzone({
    onDrop: onCoverDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
    },
    maxFiles: 1,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setJobId(null);
    setJobStatus(null);
    setJobOutputs(null);

    if (files.length === 0) {
      setError('Please upload at least one markdown file');
      return;
    }

    try {
      setUploading(true);

      // Upload files first
      const uploadFormData = new FormData();
      files.forEach(file => {
        uploadFormData.append('markdown', file);
      });
      if (coverImage) {
        uploadFormData.append('cover', coverImage);
      }

      const uploadResponse = await axios.post(`${API_URL}/api/upload`, uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Start conversion
      const convertResponse = await axios.post(`${API_URL}/api/convert`, {
        files: uploadResponse.data.files,
        coverFile: uploadResponse.data.coverFile,
        ...formData,
      });

      setJobId(convertResponse.data.jobId);
      setJobStatus({
        status: 'processing',
        progress: 0,
        message: 'Starting conversion...',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = (filename: string) => {
    if (jobId) {
      window.open(`${API_URL}/api/download/${jobId}/${filename}`, '_blank');
    }
  };

  const downloadAll = () => {
    if (jobId) {
      window.open(`${API_URL}/api/download/${jobId}/all`, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (serverReady === null) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (serverReady === false) {
    return (
      <div className="error-screen">
        <h1>Server Unavailable</h1>
        <p>The conversion server is not ready. Please try again later.</p>
        <button onClick={checkHealth}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📚 ToBook</h1>
        <p>Convert Markdown to KDP-ready books (Paperback PDF, Hardcover PDF, Kindle EPUB)</p>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="form">
          {/* File Upload */}
          <section className="section">
            <h2>1. Upload Markdown Files</h2>
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop files here...</p>
              ) : (
                <p>Drag & drop markdown files, or click to select</p>
              )}
            </div>

            {files.length > 0 && (
              <ul className="file-list">
                {files.map((file, index) => (
                  <li key={index} className="file-item">
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)} className="remove-btn">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cover Image */}
          <section className="section">
            <h2>2. Cover Image (Optional)</h2>
            <div {...getCoverRootProps()} className="dropzone cover-dropzone">
              <input {...getCoverInputProps()} />
              {coverImage ? (
                <div className="cover-preview">
                  <img src={URL.createObjectURL(coverImage)} alt="Cover preview" />
                  <p>{coverImage.name}</p>
                  <button type="button" onClick={() => setCoverImage(null)} className="remove-btn">
                    Remove
                  </button>
                </div>
              ) : (
                <p>Drag & drop cover image, or click to select (for EPUB)</p>
              )}
            </div>
          </section>

          {/* Book Metadata */}
          <section className="section">
            <h2>3. Book Details</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Book Title"
                />
              </div>

              <div className="form-group">
                <label>Author</label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={e => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Author Name"
                />
              </div>

              <div className="form-group">
                <label>Subtitle</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Subtitle (optional)"
                />
              </div>

              <div className="form-group">
                <label>ISBN</label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={e => setFormData({ ...formData, isbn: e.target.value })}
                  placeholder="ISBN (optional)"
                />
              </div>

              <div className="form-group">
                <label>Copyright Year</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={e => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                />
              </div>
            </div>
          </section>

          {/* Output Options */}
          <section className="section">
            <h2>4. Output Options</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Output Format</label>
                <select
                  value={formData.format}
                  onChange={e => setFormData({ ...formData, format: e.target.value })}
                >
                  <option value="all">All Formats (PDF + EPUB)</option>
                  <option value="pdf">PDF Only</option>
                  <option value="epub">EPUB Only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Trim Size</label>
                <select
                  value={formData.trim}
                  onChange={e => setFormData({ ...formData, trim: e.target.value })}
                >
                  {config?.trimSizes.map(size => (
                    <option key={size} value={size}>
                      {size} ({config.trimDetails[size].w} × {config.trimDetails[size].h})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Font Size</label>
                <select
                  value={formData.fontSize}
                  onChange={e => setFormData({ ...formData, fontSize: e.target.value })}
                >
                  <option value="10pt">10pt</option>
                  <option value="11pt">11pt (default)</option>
                  <option value="12pt">12pt</option>
                </select>
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.toc}
                    onChange={e => setFormData({ ...formData, toc: e.target.checked })}
                  />
                  Include Table of Contents (PDF only)
                </label>
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.openRight}
                    onChange={e => setFormData({ ...formData, openRight: e.target.checked })}
                  />
                  Start chapters on right pages (PDF only)
                </label>
              </div>
            </div>
          </section>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={uploading || files.length === 0}
          >
            {uploading ? 'Uploading...' : 'Convert to Book'}
          </button>
        </form>

        {/* Progress / Results */}
        {jobStatus && (
          <section className="section results">
            <h2>Conversion Status</h2>
            
            <div className="status-card">
              <div className={`status-badge ${jobStatus.status}`}>
                {jobStatus.status.toUpperCase()}
              </div>
              
              <p className="status-message">{jobStatus.message}</p>
              
              {jobStatus.status === 'processing' && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
              )}

              {jobStatus.error && (
                <div className="error-details">
                  Error: {jobStatus.error}
                </div>
              )}
            </div>

            {jobOutputs && jobOutputs.length > 0 && (
              <div className="outputs">
                <h3>Generated Files</h3>
                <div className="output-list">
                  {jobOutputs.map(output => (
                    <div key={output.filename} className="output-item">
                      <div className="output-info">
                        <span className="output-type">{output.type}</span>
                        <span className="output-name">{output.filename}</span>
                        <span className="output-size">{formatFileSize(output.size)}</span>
                      </div>
                      <button
                        onClick={() => downloadFile(output.filename)}
                        className="download-btn"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
                
                {jobOutputs.length > 1 && (
                  <button onClick={downloadAll} className="download-all-btn">
                    Download All (ZIP)
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Built with TinyTeX + Pandoc • Deployed on Railway</p>
      </footer>
    </div>
  );
}

export default App;
