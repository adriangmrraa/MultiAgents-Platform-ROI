import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { FileText, Trash, Upload, Database, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface KnowledgeFile {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    status: string;
    created_at: string;
    storage_url?: string;
}

export const Knowledge: React.FC = () => {
    const { fetchApi } = useApi();
    const [files, setFiles] = useState<KnowledgeFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        try {
            const data = await fetchApi('/admin/knowledge/list');
            if (Array.isArray(data)) setFiles(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            await fetchApi('/admin/knowledge/upload', {
                method: 'POST',
                body: formData,
                headers: {} // Let browser set Content-Type for FormData
            });
            await loadFiles();
        } catch (e) {
            alert('Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this file from the knowledge base?')) return;
        try {
            await fetchApi(`/admin/knowledge/${id}`, { method: 'DELETE' });
            setFiles(files.filter(f => f.id !== id));
        } catch (e) {
            alert('Delete failed');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="view active">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="text-cyan-400" />
                        Private Knowledge Base
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Upload PDF, TXT, or DOCX files to train your specific agent.</p>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.txt,.docx,.md,.csv"
                    />
                    <button
                        className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-2 px-4 rounded flex items-center gap-2 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? <Clock className="animate-spin" size={18} /> : <Upload size={18} />}
                        {uploading ? 'Processing...' : 'Upload Document'}
                    </button>
                </div>
            </div>

            {/* Drag & Drop Area (Optional Visual) */}
            {files.length === 0 && !uploading && (
                <div
                    className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center text-slate-500 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Click or Drag files here to vectorize</p>
                </div>
            )}

            {files.length > 0 && (
                <div className="bg-slate-900/50 border border-white/10 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                            <tr>
                                <th className="p-4">Document</th>
                                <th className="p-4">Size</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {files.map(file => (
                                <tr key={file.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 flex items-center gap-3">
                                        <div className="bg-slate-800 p-2 rounded text-cyan-400">
                                            <FileText size={20} />
                                        </div>
                                        <span className="font-medium text-white">{file.filename}</span>
                                    </td>
                                    <td className="p-4 text-slate-400">{formatSize(file.file_size)}</td>
                                    <td className="p-4">
                                        {file.status === 'active' && (
                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs flex items-center gap-1 w-fit">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        )}
                                        {file.status === 'processing' && (
                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs flex items-center gap-1 w-fit">
                                                <Clock size={12} className="animate-spin" /> Indexing...
                                            </span>
                                        )}
                                        {file.status === 'error' && (
                                            <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs flex items-center gap-1 w-fit">
                                                <AlertCircle size={12} /> Failed
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-400">
                                        {new Date(file.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDelete(file.id)}
                                            className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                            title="Remove from knowledge base"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
