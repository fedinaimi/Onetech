declare module 'pdf-poppler' {
  interface ConvertOptions {
    format: 'jpeg' | 'png' | 'svg' | 'ps' | 'eps' | 'pdf';
    out_dir?: string;
    out_prefix?: string;
    page?: number | null;
    first_page?: number | null;
    last_page?: number | null;
    scale?: number;
    hdpi?: number;
    vdpi?: number;
    width?: number;
    height?: number;
    crop?: boolean;
    mono?: boolean;
    gray?: boolean;
    antialias?: 'default' | 'none' | 'gray' | 'subpix';
    print_command?: boolean;
  }

  interface ConvertResult {
    name: string;
    size: number;
    path: string;
    page: number;
  }

  function convert(pdfPath: string, opts: ConvertOptions): Promise<ConvertResult[]>;

  export = { convert };
}
