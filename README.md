# OneTech Document Extractor

A powerful web application for extracting and managing data tables from document images using AI. Built with Next.js, MongoDB, and modern web technologies.

![OneTech Logo](./public/logo-onetech.jpg)

## Features

### ✨ Core Features
- **Multi-Document Support**: Handles 3 document types (Rebut, NPT, Kosu)
- **AI-Powered Extraction**: Extract data from images using API endpoints
- **Real-time Editing**: Update cell data with inline editing capabilities
- **Database Integration**: Save AI-extracted and user-modified data to MongoDB
- **History Tracking**: Track all changes with detailed edit history
- **Export Functionality**: Export data in CSV, XLSX, and JSON formats
- **Beautiful UI**: Clean, professional design with OneTech branding

### 🔧 Technical Features
- **Next.js 15**: Modern React framework with App Router
- **MongoDB**: Cloud database with Mongoose ODM
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icons
- **Drag & Drop**: File upload with drag and drop support

## Document Types

### 1. Rebut Documents
- Track material waste and scrap data
- Items with references, quantities, and scrap amounts
- Header information with production details

### 2. NPT (Non-Productive Time) Documents
- Downtime event tracking
- Time intervals and cause analysis
- Production line monitoring

### 3. Kosu Documents
- Team productivity tracking
- Production targets and achievements
- Work hour monitoring

## Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd onetech-document-extractor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   NEXTAUTH_SECRET=your_secret_key_here
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### 1. Document Type Selection
- Choose from Rebut, NPT, or Kosu document types
- Each type has specific data structures and fields

### 2. Upload Documents
- **Drag & Drop**: Drag image files directly onto the upload area
- **File Browser**: Click "Choose File" to browse and select images
- Supported formats: JPG, PNG, GIF, etc.

### 3. AI Processing
- Files are automatically processed by the AI extraction service
- Processing status is shown with loading indicators
- Extracted data is automatically saved to the database

### 4. Review and Edit Data
- View extracted data in organized tables
- Click the edit icon (✏️) next to any cell to modify values
- Save changes with the check icon (✓) or cancel with X
- All edits are tracked in the document history

### 5. Export Data
- **CSV Export**: Click "Export CSV" for spreadsheet-compatible format
- **JSON Export**: Click "Export JSON" for developer-friendly format
- **XLSX**: Available through the API endpoints

### 6. View History
- Click the history icon (🕒) to view document details
- See all edit history with timestamps
- Track changes from AI extraction to user modifications

## API Endpoints

### Document Management
- `GET /api/documents?type={type}` - Get all documents of a type
- `GET /api/documents?type={type}&id={id}` - Get specific document
- `POST /api/documents` - Save new document
- `PUT /api/documents` - Update document field
- `DELETE /api/documents?id={id}&type={type}` - Delete document

### Data Extraction
- `POST /api/extract` - Extract data from uploaded image
  - Form data: `file` (image) and `documentType` (string)

### Export
- `GET /api/documents?type={type}&export=csv` - Export as CSV
- `GET /api/documents?type={type}&export=json` - Export as JSON

## Database Schema

### Collections
- `rebuts` - Rebut document data
- `npts` - NPT document data
- `kosus` - Kosu document data

### Document Structure
```typescript
{
  id: string;
  data: DocumentTypeData; // Specific to document type
  metadata: {
    filename: string;
    document_type: string;
    processed_at: string;
    file_size: number;
  };
  remark: string;
  created_at: Date;
  updated_at: Date;
  updated_by_user: boolean;
  history: EditHistoryEntry[];
}
```

## Development

### Project Structure
```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard
├── lib/                   # Utility libraries
│   ├── mongodb.ts         # Database connection
│   ├── documentUtils.ts   # Document operations
│   └── utils.ts           # General utilities
├── models/                # MongoDB models
│   └── Document.ts        # Document schemas
├── data/                  # Sample data
├── public/                # Static assets
└── scripts/               # Database scripts
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run seed` - Seed database with sample data

## MongoDB Atlas Setup

1. **Create Account**: Sign up at [MongoDB Atlas](https://cloud.mongodb.com)
2. **Create Cluster**: Choose a free tier cluster
3. **Create Database User**: Add a user with read/write permissions
4. **Network Access**: Add your IP address (or 0.0.0.0/0 for development)
5. **Get Connection String**: Copy the connection string and add to `.env.local`

Example connection string:
```
mongodb+srv://username:password@cluster0.mongodb.net/document-extractor?retryWrites=true&w=majority
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software owned by OneTech.

## Support

For support or questions, please contact the OneTech development team.

---

**Built with ❤️ by OneTech**
