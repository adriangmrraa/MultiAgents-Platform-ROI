import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import {
    FileText, Trash, Upload, Database, CheckCircle, Clock,
    AlertCircle, Key, ChevronRight, Folder, FolderPlus,
    Search, User, Lock, BookOpen
} from 'lucide-react';

interface KnowledgeFile {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    status: string;
    created_at: string;
    meta?: string;
    collection?: string;
}

const COLLECTIONS = [
    { id: 'General', label: 'General', icon: Database },
    { id: 'ADN Personal', label: 'ADN Personal', icon: User },
    { id: 'Legal', label: 'Legal / Reglas', icon: Lock },
    { id: 'Catalogo', label: 'Catálogo', icon: BookOpen },
];

export const Knowledge: React.FC = () => {
    const { fetchApi } = useApi();
    const navigate = useNavigate();

    // Data State
    const [files, setFiles] = useState<KnowledgeFile[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<KnowledgeFile[]>([]);

    // UI State
    const [activeCollection, setActiveCollection] = useState('General');
    const [uploading, setUploading] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    // Modals
    const [showCredModal, setShowCredModal] = useState(false);
    const [showHeroModal, setShowHeroModal] = useState(false);
    const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
    const [heroName, setHeroName] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Loading & Filtering ---

    const loadFiles = async () => {
        try {
            const data = await fetchApi('/admin/knowledge/list');
            if (Array.isArray(data)) {
                // Parse meta to extract collection if present (v5.49 backend stores it in metadata)
                // However, the listing endpoint might not return metadata details or flat collection column.
                // Assuming backend returns it or we fallback to 'General'
                // Ideally, backend v5.49 should populate 'collection' field if we added it to DB/Schema.
                // If not, we might need to parse. Let's assume 'General' default for now.
                setFiles(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    useEffect(() => {
        // Client-side filtering
        const filtered = files.filter(f => {
            // If backend doesn't return collection, we assume General
            // Or we check metadata if available
            let col = f.collection || 'General';
            try {
                if (f.meta) {
                    const m = JSON.parse(f.meta);
                    if (m.collection) col = m.collection;
                }
            } catch { }

            return col === activeCollection;
        });
        setFilteredFiles(filtered);
    }, [files, activeCollection]);

    // --- Actions ---

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];

        // Smart Upload Logic (v5.50)
        if (activeCollection === 'ADN Personal' && file.name.endsWith('.txt')) {
            setPendingUploadFile(file);
            setShowHeroModal(true);
        } else {
            // Standard Upload
            performUpload(file, activeCollection);
        }

        // Reset input for re-selection
        e.target.value = '';
    };

    const performUpload = async (file: File, collection: string, hero?: string) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        // Nexus v5.69: Strict Collection Binding
        // Ensure we never send partial/undefined values
        const targetCollection = collection || 'General';
        formData.append('collection', targetCollection);

        if (hero) formData.append('hero_name', hero); // v5.49 Support

        try {
            await fetchApi('/admin/knowledge/upload', {
                method: 'POST',
                body: formData,
            });
            await loadFiles();
        } catch (e: any) {
            const errorMsg = e.message || '';
            if (errorMsg.includes('Missing AI Credentials')) {
                setShowCredModal(true);
            } else {
                alert('Upload failed: ' + errorMsg);
            }
        } finally {
            setUploading(false);
            setPendingUploadFile(null);
            setShowHeroModal(false);
            setHeroName('');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this file from the knowledge base?')) return;

        // Optimistic UI Feedback
        setDeletingIds(prev => new Set(prev).add(id));

        try {
            await fetchApi(`/admin/knowledge/${id}`, { method: 'DELETE' });
            setFiles(prev => prev.filter(f => f.id !== id));
        } catch (e) {
            alert('Delete failed');
        } finally {
            setDeletingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- Render ---

    return (
        <div className="view active flex h-full gap-6">
            {/* Sidebar Navigation */}
            <div className="w-64 flex-shrink-0 flex flex-col gap-2">
                <div className="mb-4">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Database className="text-cyan-400" />
                        Knowledge
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">Sovereign RAG Engine v5.50</p>
                </div>

                <div className="flex flex-col gap-1">
                    {COLLECTIONS.map(col => (
                        <button
                            key={col.id}
                            onClick={() => setActiveCollection(col.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeCollection === col.id
                                ? 'bg-slate-800 text-cyan-400 shadow-lg shadow-black/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <col.icon size={18} />
                            {col.label}
                            {/* Optional Counter */}
                            {/* <span className="ml-auto text-xs opacity-50 bg-black/20 px-2 py-0.5 rounded">
                                {files.filter(f => (f.collection || 'General') === col.id).length}
                            </span> */}
                        </button>
                    ))}

                    <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-500 hover:text-cyan-400 hover:bg-white/5 border border-dashed border-slate-800 hover:border-cyan-500/30 mt-2 transition-all">
                        <FolderPlus size={18} />
                        Nueva Colección...
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Folder size={20} className="text-slate-500" />
                            {activeCollection}
                            <span className="text-slate-600 font-normal">/</span>
                            <span className="text-slate-400 text-sm font-normal">
                                {filteredFiles.length} documentos
                            </span>
                        </h2>
                    </div>
                    <div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.txt,.docx,.md,.csv"
                        />
                        <button
                            className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-2 px-4 rounded flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? <Clock className="animate-spin" size={18} /> : <Upload size={18} />}
                            {uploading ? 'Indexando...' : 'Subir Archivo'}
                        </button>
                    </div>
                </div>

                {/* Empty State */}
                {filteredFiles.length === 0 && !uploading && (
                    <div
                        className="flex-1 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400 transition-colors cursor-pointer bg-slate-900/20"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={48} className="mb-4 opacity-50" />
                        <p className="font-medium">Esta colección está vacía</p>
                        <p className="text-sm opacity-70 mt-1">Arrastra archivos o haz clic para subir</p>
                    </div>
                )}

                {/* File Grid */}
                {filteredFiles.length > 0 && (
                    <div className="bg-slate-900/50 border border-white/10 rounded-lg overflow-hidden flex-1 overflow-auto">
                        <table className="w-full text-left text-sm relative">
                            <thead className="bg-slate-900 text-slate-400 uppercase text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="p-4">Documento</th>
                                    <th className="p-4">Tamaño</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredFiles.map((file: KnowledgeFile) => (
                                    <tr key={file.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 flex items-center gap-3">
                                            <div className="bg-slate-800 p-2 rounded text-cyan-400 group-hover:text-cyan-300 group-hover:bg-slate-700 transition-colors">
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
                                                <span
                                                    className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs flex items-center gap-1 w-fit cursor-help"
                                                    title={(() => {
                                                        try {
                                                            const meta = JSON.parse(file.meta || '{}');
                                                            return meta.error_detail || 'Unknown error occurred during ingestion.';
                                                        } catch (e) {
                                                            return file.meta || 'Failed to process document.';
                                                        }
                                                    })()}
                                                >
                                                    <AlertCircle size={12} /> Failed
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-400">
                                            {new Date(file.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            {deletingIds.has(file.id) ? (
                                                <Clock className="animate-spin text-red-500 ml-auto" size={16} />
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(file.id)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                                    title="Borrar vector"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Credentials Modal */}
            <Modal isOpen={showCredModal} onClose={() => setShowCredModal(false)} title="Configuración Requerida">
                {/* ... existing credential modal content ... */}
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Key size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Faltan Credenciales de IA</h3>
                    <p className="text-slate-400 mb-6">
                        Para procesar y vectorizar tus documentos, necesitamos que configures una API Key de <strong>OpenAI</strong> o <strong>Google Gemini</strong> en tu bóveda soberana.
                    </p>
                    <button
                        onClick={() => navigate('/credentials')}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        Configurar Credenciales Ahora
                        <ChevronRight size={18} />
                    </button>
                </div>
            </Modal>

            {/* Smart Upload Hero Modal (v5.50) */}
            <Modal isOpen={showHeroModal} onClose={() => setShowHeroModal(false)} title="Configuración de Estilo (WhatsApp)">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-6 bg-slate-800/50 p-4 rounded-lg">
                        <div className="bg-green-500/20 text-green-400 p-3 rounded-full">
                            <User size={24} />
                        </div>
                        <div>
                            <h4 className="font-medium text-white">Extracción de Identidad</h4>
                            <p className="text-sm text-slate-400">
                                Detectamos que estás subiendo un chat (.txt). Para entrenar el estilo, necesitamos saber quién es el "Héroe" (tu cliente/agente) en la conversación.
                            </p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Nombre exacto en el chat (Ej: "Juan Perez", "Ventas")
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            placeholder="Ej: +54 9 11..."
                            value={heroName}
                            onChange={(e) => setHeroName(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Si lo dejas vacío, se importará como conocimiento general (cronológico).
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => performUpload(pendingUploadFile!, activeCollection, heroName)}
                            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 rounded-lg transition-all"
                        >
                            Confirmar Subida
                        </button>
                        <button
                            onClick={() => {
                                // Fallback to simple upload
                                performUpload(pendingUploadFile!, activeCollection);
                            }}
                            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-all"
                        >
                            Saltar (Modo General)
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
